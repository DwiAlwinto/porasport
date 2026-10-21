"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { SportCategory, UserCategory } from '@prisma/client';
import { resolveFieldPrice } from '../lib/pricing';
import { toDateKey, parseDateKey } from '../lib/dateKeys';
import { getCurrentUserSession } from '../lib/userAuth';
import { rateLimit } from '../lib/rateLimit';
import { toPublicMessage, UserFacingError } from '../lib/userFacingError';
import crypto from 'crypto';

export async function getVenues() {
  try {
    const venues = await prisma.venue.findMany({
      include: {
        fields: {
          include: {
            rates: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
      orderBy: {
        isPopular: 'desc'
      }
    });
    
    // Map to frontend interface
    return venues.map((v) => ({
      ...v,
      // Prisma mengembalikan Date; tipe Venue memakai string agar serialisable
      // lewat server action dan bisa dibandingkan di client.
      createdAt: v.createdAt.toISOString(),
      sportTypes: Array.from(new Set(v.fields.map((f) => f.sportType))),
      mapsUrl: `https://maps.google.com/?q=${v.lat},${v.lng}`,
    }));
  } catch (error) {
    console.error("Failed to fetch venues:", error);
    return [];
  }
}

export async function getVenueBySlug(slug: string) {
  try {
    const venue = await prisma.venue.findUnique({
      where: { slug },
      include: {
        fields: {
          include: {
            rates: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    return venue;
  } catch (error) {
    console.error(`Failed to fetch venue ${slug}:`, error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Slot jadwal publik                                                 */
/* ------------------------------------------------------------------ */

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 21; // exclusive (08:00 - 21:00 WIB, slot terakhir adalah 20:00 - 21:00)

/**
 * Buat slot jadwal untuk tanggal yang dituju jika belum tersedia (jam 08:00 - 21:00).
 */
async function generateSlotsForDate(field: {
  id: string;
  sportType: SportCategory;
  maxCapacity: number;
  priceNonPeak: number;
  pricePeak: number;
  rates: any[];
}, target: Date) {
  const key = toDateKey(target);
  const defaultCapacity = field.maxCapacity || (field.sportType === 'RENANG' ? 30 : 1);

  const rows: {
    id: string;
    fieldId: string;
    date: Date;
    hour: number;
    timeStart: string;
    timeEnd: string;
    price: number;
    isPeakHour: boolean;
    status: 'AVAILABLE';
    maxCapacity: number;
    bookedCapacity: number;
  }[] = [];

  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour++) {
    const { price } = resolveFieldPrice({
      rates: field.rates,
      priceNonPeak: field.priceNonPeak,
      pricePeak: field.pricePeak,
      hour,
    });
    rows.push({
      id: `${field.id}-${key}-${hour}`,
      fieldId: field.id,
      date: target,
      hour,
      timeStart: `${String(hour).padStart(2, '0')}:00`,
      timeEnd: `${String(hour + 1).padStart(2, '0')}:00`,
      price,
      isPeakHour: hour >= 16,
      status: 'AVAILABLE',
      maxCapacity: defaultCapacity,
      bookedCapacity: 0,
    });
  }

  if (rows.length) {
    await prisma.fieldSlot.createMany({ data: rows, skipDuplicates: true });
  }
}

export type PublicSlot = {
  id: string;
  fieldId: string;
  date: string;
  hour: number;
  timeStart: string;
  timeEnd: string;
  price: number;
  isPeakHour: boolean;
  status: 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE';
  maxCapacity: number;
  bookedCapacity: number;
  remainingCapacity: number;
};

/**
 * Slot jadwal untuk halaman detail venue (HANYA jam 08:00 - 20:00 WIB).
 *
 * Mengambil slot secara efisien (1 round-trip paralel) untuk tanggal yang diminta.
 */
export async function getPublicFieldSlots(params: {
  fieldId: string;
  date: string;
  userCategory?: UserCategory | null;
}): Promise<{ ok: boolean; slots: PublicSlot[]; error?: string }> {
  try {
    const { fieldId, date, userCategory } = params;

    const target = parseDateKey(date);
    if (Number.isNaN(target.getTime())) {
      return { ok: false, slots: [], error: 'Tanggal tidak valid.' };
    }

    // Ambil data lapangan dan slot yang ada secara paralel (hanya jam 08:00 s.d. 20:00)
    const [field, existingSlots] = await Promise.all([
      prisma.venueField.findUnique({
        where: { id: fieldId },
        include: { rates: { orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.fieldSlot.findMany({
        where: {
          fieldId,
          date: target,
          hour: { gte: SLOT_START_HOUR, lt: SLOT_END_HOUR },
        },
        orderBy: { hour: 'asc' },
      }),
    ]);

    if (!field) {
      return { ok: false, slots: [], error: 'Lapangan tidak ditemukan.' };
    }

    let rows = existingSlots;
    if (rows.length === 0) {
      await generateSlotsForDate(field, target);
      rows = await prisma.fieldSlot.findMany({
        where: {
          fieldId,
          date: target,
          hour: { gte: SLOT_START_HOUR, lt: SLOT_END_HOUR },
        },
        orderBy: { hour: 'asc' },
      });
    }

    // Pastikan hanya slot dalam rentang 08:00 s.d. 20:00 yang diproses
    const filteredRows = rows.filter(
      (r) => r.hour >= SLOT_START_HOUR && r.hour < SLOT_END_HOUR
    );

    const slots: PublicSlot[] = filteredRows.map((r) => {
      // Harga ikut mengikuti kategori yang dipilih user, sehingga yang tampil
      // selalu sama dengan yang akan ditagihkan.
      const { price } = resolveFieldPrice({
        rates: field.rates,
        priceNonPeak: field.priceNonPeak,
        pricePeak: field.pricePeak,
        category: userCategory ?? null,
        hour: r.hour,
        isPeak: r.isPeakHour,
      });

      const maxCap = r.maxCapacity || (field.sportType === 'RENANG' ? 30 : 1);
      const bookedCap = r.bookedCapacity || 0;
      const remainingCap = Math.max(0, maxCap - bookedCap);
      const computedStatus =
        r.status === 'MAINTENANCE'
          ? 'MAINTENANCE'
          : bookedCap >= maxCap
          ? 'BOOKED'
          : 'AVAILABLE';

      return {
        id: r.id,
        fieldId: r.fieldId,
        date,
        hour: r.hour,
        timeStart: r.timeStart,
        timeEnd: r.timeEnd,
        price,
        isPeakHour: r.isPeakHour,
        status: computedStatus,
        maxCapacity: maxCap,
        bookedCapacity: bookedCap,
        remainingCapacity: remainingCap,
      };
    });

    return { ok: true, slots };
  } catch (error: unknown) {
    console.error('Failed to fetch public field slots:', error);
    return {
      ok: false,
      slots: [],
      error: toPublicMessage(error, 'Gagal memuat jadwal.'),
    };
  }
}

export async function createBooking(data: {
  venueId: string;
  totalAmount: number;
  paymentMethod: string;
  sportCategory: SportCategory;
  userCategory?: UserCategory | null;
  rateId?: string | null;
  nik?: string;
  npwp?: string;
  senderName?: string;
  senderPhone?: string;
  paymentProofUrl?: string;
  items: {
    slotId: string;
    fieldId: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    price: number;
    isPeakHour: boolean;
    quantity?: number;
  }[];
}) {
  try {
    // Identitas pemesan SELALU diambil dari sesi server, tidak pernah dari
    // parameter yang dikirim browser. Sebelumnya `userId` diterima dari client,
    // sehingga booking bisa dibuat atas nama user lain.
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: 'Silakan login sebelum membuat pesanan.' };
    }
    const userId = session.userId;

    // Pembatas laju: menahan spam pemesanan yang mengunci-nyazepil slot.
    const bookingLimit = rateLimit(`create-booking:${userId}`, 20, 60 * 60 * 1000);
    if (!bookingLimit.ok) {
      return {
        success: false,
        error: `Terlalu banyak permintaan pemesanan. Coba lagi dalam ${Math.ceil(bookingLimit.retryAfterSeconds / 60)} menit.`,
      };
    }

    if (!data.items.length) {
      return { success: false, error: 'Pilih minimal satu slot jadwal.' };
    }

    // Validasi waktu: dibuka sementara untuk testing user
    // const nowTime = Date.now();
    // for (const item of data.items) {
    //   const slotStartTime = new Date(`${item.date}T${item.timeStart}:00+07:00`);
    //   if (!Number.isNaN(slotStartTime.getTime()) && slotStartTime.getTime() <= nowTime) {
    //     return {
    //       success: false,
    //       error: `Slot jam ${item.timeStart} pada tanggal ${item.date} sudah lewat dan tidak dapat dipesan lagi.`,
    //     };
    //   }
    // }

    // Harga SELALU dihitung ulang di server dari tabel field_rates.
    const fields = await prisma.venueField.findMany({
      where: { id: { in: data.items.map((i) => i.fieldId) } },
      include: { rates: true, venue: true },
    });
    const fieldById = new Map(fields.map((f) => [f.id, f]));

    const pricedItems = data.items.map((item) => {
      const field = fieldById.get(item.fieldId);
      if (!field) {
        throw new UserFacingError(`Lapangan dengan id ${item.fieldId} tidak ditemukan.`);
      }
      if (field.venueId !== data.venueId) {
        throw new UserFacingError('Lapangan yang dipilih bukan bagian dari venue ini.');
      }
      const hour = parseInt(item.timeStart.split(':')[0], 10) || 0;
      const resolved = resolveFieldPrice({
        rates: field.rates,
        priceNonPeak: field.priceNonPeak,
        pricePeak: field.pricePeak,
        category: data.userCategory,
        hour,
        isPeak: item.isPeakHour,
      });

      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const isPerPerson = field.sportType === 'RENANG' && data.userCategory !== 'PERTANDINGAN';
      const itemPrice = isPerPerson ? resolved.price * qty : resolved.price;

      return { ...item, price: itemPrice, quantity: qty };
    });

    const allRates = fields.flatMap((f) => f.rates);
    const selectedRate = data.rateId ? allRates.find((r) => r.id === data.rateId) : null;

    let serverTotal: number;
    if (selectedRate && selectedRate.unit === 'PER_HARI') {
      serverTotal = selectedRate.price;
      const perSlot = Math.round(selectedRate.price / pricedItems.length);
      pricedItems.forEach((i) => {
        i.price = perSlot;
      });
    } else {
      serverTotal = pricedItems.reduce((sum, i) => sum + i.price, 0);
    }

    const serviceFee = 0;
    const grandTotal = serverTotal;

    // Jalankan dalam transaksi aman anti overbooking
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Buat Booking Header
      const newBooking = await tx.booking.create({
        data: {
          id: `GLR-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
          venueId: data.venueId,
          userId,
          sportCategory: data.sportCategory,
          status: 'PENDING_PAYMENT',
          paymentMethod: data.paymentMethod,
          totalPrice: serverTotal,
          serviceFee,
          grandTotal,
          qrCodeToken: `QR-${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`,
          expiresAt: new Date(Date.now() + 60 * 60000), // 60 menit untuk transfer & upload bukti
          nik: data.nik || null,
          npwp: data.npwp || null,
          senderName: data.senderName || null,
          senderPhone: data.senderPhone || null,
          paymentProofUrl: data.paymentProofUrl || null,
          items: {
            create: pricedItems.map(item => ({
              fieldId: item.fieldId,
              slotId: item.slotId,
              quantity: item.quantity,
              date: new Date(item.date),
              timeStart: item.timeStart,
              timeEnd: item.timeEnd,
              price: item.price,
              isPeakHour: item.isPeakHour
            }))
          },
          payment: {
            create: {
              amount: grandTotal,
              paymentMethod: data.paymentMethod,
              status: 'PENDING',
              paymentGatewayRef: 'QRIS-DISBUDPORA-MANUAL-VERIFICATION',
            }
          }
        },
        include: {
          items: true,
          payment: true,
        }
      });

      // 2. Kunci kuota slot yang dipesan secara atomik
      for (const item of pricedItems) {
        const slot = await tx.fieldSlot.findUnique({
          where: { id: item.slotId },
        });

        if (!slot) {
          throw new Error(`Slot jam ${item.timeStart} tidak ditemukan.`);
        }

        if (slot.status === 'MAINTENANCE') {
          throw new Error(`Slot jam ${item.timeStart} sedang ditutup untuk pemeliharaan/acara dinas.`);
        }

        const maxCap = slot.maxCapacity || 1;
        const currentBooked = slot.bookedCapacity || 0;
        const requestedQty = item.quantity || 1;
        const isExclusive = data.userCategory === 'PERTANDINGAN' || selectedRate?.unit === 'PER_HARI';

        if (isExclusive && currentBooked > 0) {
          throw new Error(
            `Slot jam ${item.timeStart} tidak dapat disewa penuh (kejuaraan/event) karena sudah terisi sebagian oleh pengunjung umum.`
          );
        }

        const addQty = isExclusive ? maxCap : requestedQty;
        const newBooked = currentBooked + addQty;

        if (newBooked > maxCap) {
          const sisa = Math.max(0, maxCap - currentBooked);
          throw new Error(
            `Slot jam ${item.timeStart} hanya tersisa ${sisa} kuota orang, Anda meminta ${requestedQty} orang.`
          );
        }

        const isFull = newBooked >= maxCap;

        await tx.fieldSlot.update({
          where: { id: slot.id },
          data: {
            bookedCapacity: newBooked,
            status: isFull ? 'BOOKED' : 'AVAILABLE',
            bookingId: slot.bookingId ? slot.bookingId : newBooking.id,
            bookedByUserId: slot.bookedByUserId ? slot.bookedByUserId : userId,
          },
        });
      }

      return newBooking;
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/'); // Memastikan data terbaru diambil dari server
    
    return { success: true, booking };
  } catch (error: unknown) {
    console.error("Failed to create booking:", error);
    return {
      success: false,
      error: toPublicMessage(error, "Gagal membuat pesanan."),
    };
  }
}

/**
 * Hanya path di dalam bucket bukti pembayaran milik aplikasi sendiri yang
 * diterima.
 *
 * Nilai ini akhirnya dipakai `lib/ocr.ts` untuk mengunduh berkas lewat service
 * role. Karena sekarang isinya path, bukan URL, kelas serangan SSRF hilang
 * permintaan ke jaringan internal.
 * permintaan ke jaringan internal.
 */
function isAllowedProofRef(value: string): boolean {
  return /^payment-proofs\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(value);
}

/**
 * Upload & submit bukti transfer QRIS + NIK + NPWP
 */
export async function submitPaymentProofAction(bookingId: string, proofData: {
  nik: string;
  npwp?: string;
  senderName?: string;
  paymentProofUrl: string;
}) {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: 'Silakan login sebelum mengirim bukti pembayaran.' };
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return { success: false, error: 'Booking tidak ditemukan.' };
    }
    if (booking.userId !== session.userId) {
      return { success: false, error: 'Anda tidak berhak mengubah booking ini.' };
    }
    // Booking yang sudah dibayar/dibatalkan tidak boleh dihidupkan kembali
    // hanya dengan mengunggah bukti baru.
    if (booking.status !== 'PENDING_PAYMENT') {
      return {
        success: false,
        error: `Booking sudah berstatus ${booking.status} dan tidak bisa diubah.`,
      };
    }

    if (!isAllowedProofRef(proofData.paymentProofUrl || '')) {
      return { success: false, error: 'Referensi bukti pembayaran tidak valid.' };
    }

    const nik = String(proofData.nik || '').replace(/\D/g, '');
    if (nik.length < 10 || nik.length > 20) {
      return { success: false, error: 'NIK harus terdiri dari 10-20 digit angka.' };
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        nik,
        npwp: proofData.npwp ? String(proofData.npwp).replace(/\D/g, '').slice(0, 20) : null,
        senderName: proofData.senderName ? String(proofData.senderName).slice(0, 120) : null,
        paymentProofUrl: proofData.paymentProofUrl,
        status: 'PENDING_PAYMENT',
      },
    });

    revalidatePath('/');
    return { success: true, booking: updated };
  } catch (error: unknown) {
    console.error("Failed to submit payment proof:", error);
    return {
      success: false,
      error:
        toPublicMessage(error, "Gagal menyimpan bukti pembayaran."),
    };
  }
}
