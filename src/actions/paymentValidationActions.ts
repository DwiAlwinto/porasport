"use server"

import { prisma } from '@/lib/prisma'
import { runOCRValidation, OCRValidationResult } from '@/lib/ocr'
import { uploadPaymentProof } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import { verifyAdminOrSuperAdmin } from './adminActions'
import { getCurrentUserSession } from '@/lib/userAuth'
import { getAdminSession } from './authActions'
import { rateLimit } from '@/lib/rateLimit'
import { toPublicMessage, UserFacingError } from '@/lib/userFacingError'

/**
 * Batas pemanggilan OCR.
 *
 * Setiap pemanggilan membayar biaya Google Vision API. Tanpa pembatas, siapa
 * pun yang bisa menyebut `bookingId` bisa menguras kuota dengan mengulang
 * permintaan.
 */
const OCR_LIMIT_PER_HOUR = 20
const OCR_WINDOW_MS = 60 * 60 * 1000

function ocrRateLimitKey(bookingId: string, actor: string): string {
  return `ocr:${actor}:${bookingId}`
}

export interface ValidationResult {
  success: boolean
  bookingId?: string
  ocrResult?: OCRValidationResult
  newStatus?: string
  error?: string
}

/**
 * Pastikan pemanggil berhak atas booking tersebut.
 *
 * Aturan: admin boleh melakukan apa pun; pengguna biasa hanya boleh
 * booking miliknya sendiri. Tanpa cek ini, siapa pun bisa mengoper
 * `bookingId` milik orang lain dan memicu auto-approval OCR.
 */
async function assertBookingAccess(bookingId: string, bookingUserId: string) {
  const admin = await getAdminSession()
  if (admin && (admin.role === 'ADMIN' || admin.role === 'SUPERADMIN')) return

  const session = await getCurrentUserSession()
  if (!session) {
    throw new UserFacingError('Anda harus login untuk memproses bukti pembayaran.')
  }
  if (session.userId !== bookingUserId) {
    throw new UserFacingError('Anda tidak berhak mengakses booking ini.')
  }
}

/** Batas unggah bukti bayar: 5 MB. */
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Periksa magic bytes bukti bayar.
 *
 * `mimeType` berasal dari client dan bisa dipalsukan, jadi isi file yang jadi
 * acuan. Tanpa ini, HTML/SVG berisi skrip bisa tersimpan di bucket publik dan
 * dijalankan di origin aplikasi.
 */
function looksLikeImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return true;
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return true;
  return false;
}

/**
 * Server Action upload bukti bayar menggunakan native FormData.
 * Lebih andal dan standar untuk transfer berkas antar browser dan server action.
 */
export async function uploadPaymentProofAction(formData: FormData): Promise<ValidationResult> {
  try {
    const bookingId = formData.get('bookingId');
    const file = formData.get('file');

    if (!bookingId || typeof bookingId !== 'string') {
      return { success: false, error: 'ID Pesanan wajib disertakan.' };
    }

    if (!file || !(file instanceof File) || file.size === 0) {
      return { success: false, error: 'Berkas bukti transfer tidak ditemukan atau kosong.' };
    }

    if (file.size > MAX_PROOF_BYTES) {
      return { success: false, error: 'Ukuran berkas maksimal 5 MB.' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await validateAndProcessPaymentProof(bookingId, buffer, file.name, file.type);
  } catch (err: unknown) {
    console.error('[UploadPaymentProofAction] Error:', err);
    return {
      success: false,
      error: toPublicMessage(err, 'Terjadi kendala saat mengunggah berkas bukti bayar.'),
    };
  }
}

export async function validateAndProcessPaymentProof(
  bookingId: string,
  proofFile: Buffer | Uint8Array | ArrayBuffer | any,
  fileName: string,
  mimeType: string
): Promise<ValidationResult> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: true, payment: true },
    })

    if (!booking) {
      return { success: false, error: 'Booking tidak ditemukan' }
    }

    await assertBookingAccess(bookingId, booking.userId)

    const session = await getCurrentUserSession()
    const actor = session?.userId ?? 'anon'
    const ocrLimit = rateLimit(ocrRateLimitKey(bookingId, actor), OCR_LIMIT_PER_HOUR, OCR_WINDOW_MS)
    if (!ocrLimit.ok) {
      return {
        success: false,
        error: `Batas verifikasi otomatis tercapai. Coba lagi dalam ${Math.ceil(ocrLimit.retryAfterSeconds / 60)} menit.`,
      }
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      return { success: false, error: `Booking sudah berstatus ${booking.status}` }
    }

    // Pastikan berkas diubah ke Node.js Buffer asli
    let buffer: Buffer;
    if (Buffer.isBuffer(proofFile)) {
      buffer = proofFile;
    } else if (proofFile instanceof Uint8Array || proofFile instanceof ArrayBuffer) {
      buffer = Buffer.from(proofFile as any);
    } else if (typeof proofFile === 'object' && proofFile !== null && 'data' in proofFile && Array.isArray((proofFile as any).data)) {
      buffer = Buffer.from((proofFile as any).data);
    } else {
      return { success: false, error: 'Format berkas tidak valid.' };
    }

    if (!buffer || buffer.length === 0) {
      return { success: false, error: 'Berkas bukti pembayaran kosong.' }
    }
    if (buffer.length > MAX_PROOF_BYTES) {
      return { success: false, error: 'Ukuran berkas maksimal 5 MB.' }
    }
    if (!ALLOWED_PROOF_MIME.includes(String(mimeType).toLowerCase())) {
      return { success: false, error: 'Format berkas harus JPG, PNG, atau WEBP.' }
    }
    if (!looksLikeImageBuffer(buffer)) {
      return { success: false, error: 'Isi berkas bukan gambar yang valid (harus JPG, PNG, atau WEBP asli).' }
    }

    const uploadResult = await uploadPaymentProof(buffer, fileName, bookingId)

    // Yang disimpan ke database adalah PATH di dalam bucket, bukan URL publik.
    // URL bertanda tangan dibuatkan server saat admin membuka daftar booking.
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentProofUrl: uploadResult.path },
    })

    let ocrResult: OCRValidationResult | null = null;
    try {
      ocrResult = await runOCRValidation(
        uploadResult.path,
        booking.grandTotal
      );
    } catch (ocrErr: unknown) {
      console.warn('[OCR Validation skipped or failed]:', ocrErr);
    }

    const newStatus = ocrResult?.passed ? 'PAID_SUCCESS' : 'MENUNGGU_VALIDASI';

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: newStatus as any,
          ocrExtractedText: ocrResult?.extractedText || null,
          ocrValidationResult: (ocrResult as any) || null,
          ocrProcessedAt: ocrResult ? new Date() : null,
        },
      });

      await tx.paymentProof.upsert({
        where: { bookingId },
        create: {
          bookingId,
          fileUrl: uploadResult.path,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
          ocrStatus: ocrResult?.passed ? 'PASSED' : 'FAILED',
        },
        update: {
          fileUrl: uploadResult.path,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
          ocrStatus: ocrResult?.passed ? 'PASSED' : 'FAILED',
          uploadedAt: new Date(),
        },
      });

      if (ocrResult?.passed) {
        await tx.payment.upsert({
          where: { bookingId },
          update: {
            status: 'PAID',
            paidAt: new Date(),
            paymentGatewayRef: 'OCR-AUTO-VERIFIED',
          },
          create: {
            bookingId,
            amount: booking.grandTotal,
            paymentMethod: booking.paymentMethod,
            status: 'PAID',
            paidAt: new Date(),
            paymentGatewayRef: 'OCR-AUTO-VERIFIED',
          },
        })

        for (const item of booking.items) {
          const slot = await tx.fieldSlot.findFirst({
            where: {
              fieldId: item.fieldId,
              date: item.date,
              timeStart: item.timeStart,
            },
          });

          if (slot) {
            const isFull = slot.bookedCapacity >= slot.maxCapacity;
            const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (isFull ? 'BOOKED' : 'AVAILABLE');
            await tx.fieldSlot.update({
              where: { id: slot.id },
              data: {
                status: newStatus,
                bookingId: slot.bookingId ? slot.bookingId : booking.id,
                bookedByUserId: slot.bookedByUserId ? slot.bookedByUserId : booking.userId,
              },
            });
          }
        }
      }
    })

    revalidatePath('/')
    revalidatePath('/admin/bookings')

    return {
      success: true,
      bookingId,
      ocrResult: ocrResult || undefined,
      newStatus,
    }
  } catch (error: any) {
    console.error('[Validation] Error:', error)
    return {
      success: false,
      error: toPublicMessage(error, 'Terjadi kesalahan saat memvalidasi bukti pembayaran'),
    }
  }
}

export async function triggerOCRValidation(bookingId: string): Promise<ValidationResult> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: true },
    })

    if (!booking) {
      return { success: false, error: 'Booking tidak ditemukan' }
    }

    await assertBookingAccess(bookingId, booking.userId)

    const session = await getCurrentUserSession()
    const actor = session?.userId ?? 'anon'
    const limit = rateLimit(ocrRateLimitKey(bookingId, actor), OCR_LIMIT_PER_HOUR, OCR_WINDOW_MS)
    if (!limit.ok) {
      return {
        success: false,
        error: `Batas verifikasi otomatis tercapai. Coba lagi dalam ${Math.ceil(limit.retryAfterSeconds / 60)} menit.`,
      }
    }

    if (!booking || !booking.paymentProofUrl) {
      return { success: false, error: 'Bukti pembayaran tidak ditemukan' }
    }

    const ocrResult = await runOCRValidation(booking.paymentProofUrl, booking.grandTotal)
    const newStatus = ocrResult.passed ? 'PAID_SUCCESS' : 'MENUNGGU_VALIDASI'

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: newStatus as any,
          ocrExtractedText: ocrResult.extractedText,
          ocrValidationResult: ocrResult as any,
          ocrProcessedAt: new Date(),
        },
      })

      await tx.paymentProof.upsert({
        where: { bookingId },
        update: {
          ocrStatus: ocrResult.passed ? 'PASSED' : 'FAILED',
        },
        create: {
          bookingId,
          fileUrl: booking.paymentProofUrl!,
          fileName: 'payment-proof.jpg',
          fileSize: 0,
          mimeType: 'image/jpeg',
          ocrStatus: ocrResult.passed ? 'PASSED' : 'FAILED',
        },
      })

      if (ocrResult.passed) {
        await tx.payment.upsert({
          where: { bookingId },
          update: {
            status: 'PAID',
            paidAt: new Date(),
            paymentGatewayRef: 'OCR-AUTO-VERIFIED',
          },
          create: {
            bookingId,
            amount: booking.grandTotal,
            paymentMethod: booking.paymentMethod,
            status: 'PAID',
            paidAt: new Date(),
            paymentGatewayRef: 'OCR-AUTO-VERIFIED',
          },
        })

        const slotsToUpdate: any[] = [];
        for (const item of booking.items) {
          const slot = await tx.fieldSlot.findFirst({
            where: {
              fieldId: item.fieldId,
              date: item.date,
              timeStart: item.timeStart,
            },
          });
          if (slot) slotsToUpdate.push(slot);
        }

        slotsToUpdate.sort((a, b) => a.id.localeCompare(b.id));

        for (const slot of slotsToUpdate) {
          const isFull = slot.bookedCapacity >= slot.maxCapacity;
          const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (isFull ? 'BOOKED' : 'AVAILABLE');
          await tx.fieldSlot.update({
            where: { id: slot.id },
            data: {
              status: newStatus,
              bookingId: slot.bookingId ? slot.bookingId : booking.id,
              bookedByUserId: slot.bookedByUserId ? slot.bookedByUserId : booking.userId,
            },
          });
        }
      }
    })

    revalidatePath('/')
    revalidatePath('/admin/bookings')

    return { success: true, bookingId, ocrResult, newStatus }
  } catch (error: any) {
    console.error('[Validation] Trigger OCR error:', error)
    return { success: false, error: toPublicMessage(error, 'Gagal menjalankan validasi OCR') }
  }
}

export async function manualApproveBooking(
  bookingId: string,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  // Persetujuan manual hanya untuk staf DISBUDPORA. Tanpa baris ini, siapa pun
  // bisa menandai booking sebagai lunas tanpa transfer sama sekali.
  await verifyAdminOrSuperAdmin();
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: true },
    })

    if (!booking) {
      return { success: false, error: 'Booking tidak ditemukan' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'PAID_SUCCESS',
          adminNotes: adminNotes || 'Disetujui manual oleh admin',
        },
      })

      await tx.payment.upsert({
        where: { bookingId },
        update: {
          status: 'PAID',
          paidAt: new Date(),
          paymentGatewayRef: adminNotes ? `MANUAL-${adminNotes}` : `MANUAL-ADMIN-${Date.now()}`,
        },
        create: {
          bookingId,
          amount: booking.grandTotal,
          paymentMethod: booking.paymentMethod,
          status: 'PAID',
          paidAt: new Date(),
          paymentGatewayRef: adminNotes ? `MANUAL-${adminNotes}` : `MANUAL-ADMIN-${Date.now()}`,
        },
      })

      await tx.paymentProof.upsert({
        where: { bookingId },
        update: { ocrStatus: 'MANUAL_REVIEW' },
        create: {
          bookingId,
          fileUrl: booking.paymentProofUrl || '',
          fileName: 'payment-proof.jpg',
          fileSize: 0,
          mimeType: 'image/jpeg',
          ocrStatus: 'MANUAL_REVIEW',
        },
      })

      const slotsToUpdate: any[] = [];
      for (const item of booking.items) {
        const slot = await tx.fieldSlot.findFirst({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
        });
        if (slot) slotsToUpdate.push(slot);
      }

      slotsToUpdate.sort((a, b) => a.id.localeCompare(b.id));

      for (const slot of slotsToUpdate) {
        const isFull = slot.bookedCapacity >= slot.maxCapacity;
        const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (isFull ? 'BOOKED' : 'AVAILABLE');
        await tx.fieldSlot.update({
          where: { id: slot.id },
          data: {
            status: newStatus,
            bookingId: slot.bookingId ? slot.bookingId : booking.id,
            bookedByUserId: slot.bookedByUserId ? slot.bookedByUserId : booking.userId,
          },
        });
      }
    })

    revalidatePath('/')
    revalidatePath('/admin/bookings')

    return { success: true }
  } catch (error: any) {
    console.error('[Validation] Manual approve error:', error)
    return { success: false, error: toPublicMessage(error, 'Gagal menyetujui pembayaran') }
  }
}

export async function reTriggerOCRValidation(bookingId: string): Promise<ValidationResult> {
  await verifyAdminOrSuperAdmin();
  return triggerOCRValidation(bookingId)
}
