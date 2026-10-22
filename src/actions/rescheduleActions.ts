"use server";

import { prisma } from '../lib/prisma';
import { getAdminSession } from './authActions';
import { getCurrentUserSession } from '../lib/userAuth';
import { toPublicMessage, UserFacingError } from '../lib/userFacingError';
import { revalidatePath } from 'next/cache';
import { parseDateKey, toDateKey } from '../lib/dateKeys';
import { getPublicFieldSlots } from './venueActions';

/**
 * 1. Admin/Superadmin Menginisiasi Penyesuaian Jadwal Pemda (Reschedule)
 * Mengalihkan jadwal warga karena fasilitas akan digunakan untuk agenda kedinasan Pemkab Bekasi.
 */
export async function initiatePemdaRescheduleAction(params: {
  bookingId: string;
  reason: string;
  adminNotes?: string;
}) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return { success: false, error: 'Akses ditolak: Hanya petugas Admin / Superadmin yang diizinkan.' };
    }

    const { bookingId, reason, adminNotes } = params;
    if (!bookingId || !reason?.trim()) {
      return { success: false, error: 'ID pesanan dan alasan agenda kedinasan Pemda wajib diisi.' };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: true,
        user: { select: { name: true, email: true, phone: true } },
        venue: { select: { name: true } },
      },
    });

    if (!booking) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    if (booking.status !== 'PAID_SUCCESS') {
      return {
        success: false,
        error: `Hanya pesanan yang sudah lunas (PAID_SUCCESS) yang dapat dialihkan jadwalnya. Status saat ini: ${booking.status}.`,
      };
    }

    const firstItem = booking.items[0];
    const originalDate = firstItem?.date ? new Date(firstItem.date) : new Date();
    const originalTime = booking.items
      .map((i) => `${i.timeStart}-${i.timeEnd}`)
      .join(', ') + ' WIB';

    // 1. Lepaskan kuota slot lama pada FieldSlot agar fasilitas dapat digunakan oleh Pemda
    await prisma.$transaction(async (tx) => {
      for (const item of booking.items) {
        const slot = await tx.fieldSlot.findFirst({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
        });

        if (slot) {
          const qty = item.quantity || 1;
          const newBooked = Math.max(0, slot.bookedCapacity - qty);
          const newStatus =
            slot.status === 'MAINTENANCE'
              ? 'MAINTENANCE'
              : newBooked >= slot.maxCapacity
              ? 'BOOKED'
              : 'AVAILABLE';

          await tx.fieldSlot.update({
            where: { id: slot.id },
            data: {
              bookedCapacity: newBooked,
              status: newStatus,
              bookingId: newBooked === 0 ? null : slot.bookingId,
              bookedByUserId: newBooked === 0 ? null : slot.bookedByUserId,
            },
          });
        }
      }

      // 2. Perbarui data Booking dengan status pergeseran jadwal Pemda
      const updatedNotes = adminNotes?.trim()
        ? `${booking.adminNotes ? booking.adminNotes + ' | ' : ''}Agenda Pemda: ${adminNotes.trim()}`
        : booking.adminNotes;

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          rescheduleStatus: 'PENDING_CUSTOMER',
          rescheduleReason: reason.trim(),
          rescheduleNoticeDate: new Date(),
          rescheduleOriginalDate: originalDate,
          rescheduleOriginalTime: originalTime,
          adminNotes: updatedNotes,
        },
      });
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/ticket/verify');
    revalidatePath('/admin/bookings');
    revalidatePath('/admin/schedule');

    return {
      success: true,
      message: `Pemberitahuan penyesuaian jadwal dinas Pemda berhasil diaktifkan untuk pesanan #${booking.id} (${booking.user?.name}). Warga dapat memilih tanggal pengganti di dashboard.`,
    };
  } catch (error: any) {
    console.error('Failed to initiate Pemda reschedule:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal menginisiasi pergeseran jadwal Pemda.') };
  }
}

/**
 * 2. Ambil Informasi Detail Booking Khusus Reschedule
 */
export async function getBookingForRescheduleAction(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        venue: { select: { id: true, name: true, city: true, address: true, slug: true } },
        items: {
          include: {
            field: { select: { id: true, name: true, sportType: true } },
          },
        },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!booking) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    const firstItem = booking.items[0];

    return {
      success: true,
      booking: {
        id: booking.id,
        status: booking.status,
        rescheduleStatus: booking.rescheduleStatus,
        rescheduleReason: booking.rescheduleReason,
        rescheduleNoticeDate: booking.rescheduleNoticeDate,
        rescheduleOriginalDate: booking.rescheduleOriginalDate,
        rescheduleOriginalTime: booking.rescheduleOriginalTime,
        rescheduleTargetDate: booking.rescheduleTargetDate,
        rescheduleTargetTime: booking.rescheduleTargetTime,
        venueName: booking.venue?.name,
        venueAddress: booking.venue?.address,
        venueCity: booking.venue?.city,
        fieldName: firstItem?.field?.name || 'Lapangan Utama',
        fieldId: firstItem?.fieldId,
        sportCategory: booking.sportCategory,
        quantity: firstItem?.quantity || 1,
        grandTotal: booking.grandTotal,
        paymentMethod: booking.paymentMethod,
        userName: booking.user?.name || booking.senderName,
        userPhone: booking.user?.phone || booking.senderPhone,
        userEmail: booking.user?.email,
      },
    };
  } catch (error: any) {
    console.error('Failed to get booking for reschedule:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal memuat data pesanan.') };
  }
}

/**
 * 3. Ambil Ketersediaan Slot Lapangan untuk Tanggal Tertentu (Customer Reschedule Picker)
 */
export async function getRescheduleAvailableSlotsAction(fieldId: string, dateStr: string) {
  try {
    const res = await getPublicFieldSlots({
      fieldId,
      date: dateStr,
    });

    if (!res.ok) {
      return { success: false, slots: [], error: res.error || 'Gagal memuat slot.' };
    }

    return { success: true, slots: res.slots };
  } catch (error: any) {
    console.error('Failed to get reschedule slots:', error);
    return { success: false, slots: [], error: toPublicMessage(error, 'Gagal memuat slot lapangan.') };
  }
}

/**
 * 4. Warga / Admin Mengonfirmasi Tanggal & Jam Pengganti Baru
 * Mengalokasikan slot baru secara atomik tanpa biaya tambahan (Kompensasi Agenda Pemda Rp 0)
 */
export async function confirmCustomerRescheduleAction(params: {
  bookingId: string;
  newDateStr: string; // "YYYY-MM-DD"
  slotHour: number;
  timeStart: string;  // "HH:mm"
  timeEnd: string;    // "HH:mm"
  customerNotes?: string;
}) {
  try {
    const { bookingId, newDateStr, slotHour, timeStart, timeEnd, customerNotes } = params;

    if (!bookingId || !newDateStr || slotHour === undefined || !timeStart || !timeEnd) {
      return { success: false, error: 'Data pemilihan jadwal pengganti tidak lengkap.' };
    }

    // 1. Verifikasi kepemilikan sesi (User pemilik pesanan atau Petugas Admin)
    const userSession = await getCurrentUserSession();
    const adminSession = await getAdminSession();

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: true,
        user: true,
      },
    });

    if (!booking) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    const isOwner = userSession && userSession.userId === booking.userId;
    const isAdmin = adminSession && (adminSession.role === 'ADMIN' || adminSession.role === 'SUPERADMIN');

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Akses ditolak: Anda tidak memiliki wewenang untuk pesanan ini.' };
    }

    if (booking.rescheduleStatus !== 'PENDING_CUSTOMER' && !isAdmin) {
      return { success: false, error: 'Pesanan ini tidak sedang dalam status menunggu jadwal pengganti.' };
    }

    const firstItem = booking.items[0];
    if (!firstItem) {
      return { success: false, error: 'Item pesanan tidak valid.' };
    }

    const fieldId = firstItem.fieldId;
    const targetDate = parseDateKey(newDateStr);

    if (Number.isNaN(targetDate.getTime())) {
      return { success: false, error: 'Format tanggal baru tidak valid.' };
    }

    // Pastikan tanggal baru minimal hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(targetDate);
    checkDate.setHours(0, 0, 0, 0);
    if (checkDate < today) {
      return { success: false, error: 'Tanggal pengganti tidak boleh di masa lalu.' };
    }

    const qty = firstItem.quantity || 1;

    // 2. Transaksi atomik: pastikan slot baru tersedia dan alokasikan
    await prisma.$transaction(async (tx) => {
      // Cari slot untuk tanggal dan jam tersebut
      let targetSlot = await tx.fieldSlot.findFirst({
        where: {
          fieldId,
          date: targetDate,
          hour: slotHour,
        },
      });

      // Jika slot belum pernah dibuat di database, inisialisasi dari VenueField
      if (!targetSlot) {
        const field = await tx.venueField.findUnique({
          where: { id: fieldId },
        });
        if (!field) throw new UserFacingError('Data lapangan tidak ditemukan.');

        const isPool = field.sportType === 'RENANG';
        const maxCap = isPool ? 30 : 1;

        targetSlot = await tx.fieldSlot.create({
          data: {
            fieldId,
            date: targetDate,
            hour: slotHour,
            timeStart,
            timeEnd,
            price: firstItem.price,
            maxCapacity: maxCap,
            bookedCapacity: 0,
            status: 'AVAILABLE',
          },
        });
      }

      // Validasi kapasitas slot baru
      if (targetSlot.status === 'MAINTENANCE') {
        throw new UserFacingError('Slot jadwal yang Anda pilih sedang dalam masa pemeliharaan (Maintenance). Silakan pilih jam lain.');
      }

      const availableCapacity = targetSlot.maxCapacity - targetSlot.bookedCapacity;
      if (availableCapacity < qty) {
        throw new UserFacingError('Kapasitas slot pada jam yang Anda pilih sudah terisi penuh oleh pengguna lain. Silakan pilih jam atau tanggal lainnya.');
      }

      // Update kapasitas slot baru
      const newBookedCap = targetSlot.bookedCapacity + qty;
      const newStatus = newBookedCap >= targetSlot.maxCapacity ? 'BOOKED' : 'AVAILABLE';

      await tx.fieldSlot.update({
        where: { id: targetSlot.id },
        data: {
          bookedCapacity: newBookedCap,
          status: newStatus,
          bookingId: booking.id,
          bookedByUserId: booking.userId,
        },
      });

      // Update seluruh BookingItem dengan tanggal & jam baru
      for (const item of booking.items) {
        await tx.bookingItem.update({
          where: { id: item.id },
          data: {
            date: targetDate,
            timeStart,
            timeEnd,
            slotId: targetSlot.id,
          },
        });
      }

      // Update Booking: Tandai pergeseran jadwal selesai (RESOLVED)
      const targetTimeFormatted = `${timeStart} - ${timeEnd} WIB`;
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          rescheduleStatus: 'RESOLVED',
          rescheduleTargetDate: targetDate,
          rescheduleTargetTime: targetTimeFormatted,
          rescheduleCustomerNotes: customerNotes?.trim() || null,
        },
      });
    }, { maxWait: 15000, timeout: 30000 });

    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/ticket/verify');
    revalidatePath('/admin/bookings');
    revalidatePath('/admin/schedule');

    return {
      success: true,
      message: `Jadwal baru berhasil dikonfirmasi! Jadwal Anda telah dipindahkan ke ${newDateStr} pukul ${timeStart}-${timeEnd} WIB. E-Ticket Anda telah aktif kembali.`,
    };
  } catch (error: any) {
    console.error('Failed to confirm customer reschedule:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal mengonfirmasi jadwal pengganti.') };
  }
}

/**
 * 5. Warga Menolak Jadwal Pengganti dan Mengajukan Pengembalian Dana (Refund)
 */
export async function requestRescheduleRefundAction(bookingId: string, refundNotes?: string) {
  try {
    const userSession = await getCurrentUserSession();
    if (!userSession) {
      return { success: false, error: 'Silakan login terlebih dahulu.' };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    if (booking.userId !== userSession.userId) {
      return { success: false, error: 'Akses ditolak.' };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        rescheduleStatus: 'REJECTED_REFUND',
        adminNotes: `${booking.adminNotes ? booking.adminNotes + ' | ' : ''}Pengajuan Refund oleh Warga: ${refundNotes?.trim() || 'Berhalangan di tanggal lain'}`,
      },
    });

    revalidatePath('/dashboard');
    revalidatePath('/admin/bookings');

    return {
      success: true,
      message: 'Pengajuan pengembalian dana telah tercatat. Tim keuangan DISBUDPORA akan menghubungi Anda atau Anda dapat langsung konfirmasi via WhatsApp resmi.',
    };
  } catch (error: any) {
    console.error('Failed to request refund:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal memproses pengajuan refund.') };
  }
}
