"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { SportCategory, UserCategory } from '@prisma/client';
import { resolveFieldPrice } from '../lib/pricing';
import { toDateKey, parseDateKey, getWibTodayKey } from '../lib/dateKeys';
import { getCurrentUserSession } from '../lib/userAuth';
import { rateLimit } from '../lib/rateLimit';
import { toPublicMessage, UserFacingError } from '../lib/userFacingError';
import { getSignedProofUrl } from '../lib/storage';
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
  bookingId?: string | null;
  bookedByUserId?: string | null;
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
        bookingId: r.bookingId,
        bookedByUserId: r.bookedByUserId,
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

    // PENTING (SOLUSI ANTI MONOPOLI / SLOT-HOGGING DoS):
    // Batasi jumlah pesanan aktif berstatus PENDING_PAYMENT (holding slots) per akun warga.
    // Mencegah 1 orang / bot mengunci puluhan jadwal sekaligus dalam waktu 10 menit tanpa membayar,
    // yang dapat melumpuhkan operasional GOR/Stadion Pemda (Denial-of-Service).
    const now = new Date();

    // 1. Bersihkan booking PENDING_PAYMENT milik user ini yang sudah kedaluwarsa secara mandiri
    const expiredUserBookings = await prisma.booking.findMany({
      where: {
        userId,
        status: 'PENDING_PAYMENT',
        expiresAt: { lte: now },
      },
      include: { items: true },
    });

    for (const exp of expiredUserBookings) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const it of exp.items) {
            const slot = await tx.fieldSlot.findFirst({
              where: {
                fieldId: it.fieldId,
                date: it.date,
                timeStart: it.timeStart,
              },
            });
            if (slot) {
              const qty = it.quantity || 1;
              const newBooked = Math.max(0, slot.bookedCapacity - qty);
              const isFull = newBooked >= slot.maxCapacity;
              const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (isFull ? 'BOOKED' : 'AVAILABLE');
              await tx.fieldSlot.update({
                where: { id: slot.id },
                data: {
                  bookedCapacity: newBooked,
                  status: newStatus,
                  bookingId: newBooked === 0 ? null : (slot.bookingId === exp.id ? null : slot.bookingId),
                  bookedByUserId: newBooked === 0 ? null : (slot.bookedByUserId === exp.userId ? null : slot.bookedByUserId),
                },
              });
            }
          }
          await tx.booking.update({
            where: { id: exp.id },
            data: {
              status: 'CANCELLED',
              adminNotes: 'Kedaluwarsa otomatis (Batas waktu pembayaran 10 menit berakhir)',
            },
          });
        }, { maxWait: 3000, timeout: 5000 });
      } catch (err) {
        console.warn(`[createBooking] Gagal membersihkan pesanan kedaluwarsa ${exp.id}:`, err);
      }
    }

    // 2. Cek jumlah pesanan aktif yang masih dalam rentang masa berlaku (expiresAt > now)
    const activePendingBookings = await prisma.booking.findMany({
      where: {
        userId,
        status: 'PENDING_PAYMENT',
        expiresAt: { gt: now },
      },
      select: { id: true, grandTotal: true, expiresAt: true },
    });

    const MAX_ACTIVE_PENDING_BOOKINGS = 2; // Batas wajar: maksimal 2 pesanan aktif belum bayar
    if (activePendingBookings.length >= MAX_ACTIVE_PENDING_BOOKINGS && session.role !== 'SUPERADMIN' && session.role !== 'ADMIN') {
      return {
        success: false,
        error: `Anda masih memiliki ${activePendingBookings.length} pesanan aktif yang belum diselesaikan pembayarannya (Batas maksimal: ${MAX_ACTIVE_PENDING_BOOKINGS} pesanan). Silakan selesaikan pembayaran QRIS atau batalkan pesanan sebelumnya di Dashboard akun Anda sebelum membuat pesanan baru.`,
      };
    }

    if (!data.items.length) {
      return { success: false, error: 'Pilih minimal satu slot jadwal.' };
    }

    // Validasi ketat tanggal dan jam: cegah pemesanan slot di masa lalu
    const todayWib = getWibTodayKey();
    const nowTime = Date.now();
    for (const item of data.items) {
      if (!item.date || item.date < todayWib) {
        return {
          success: false,
          error: `Tanggal ${item.date} sudah lewat. Pemesanan hanya dapat dilakukan untuk hari ini (${todayWib}) atau tanggal mendatang.`,
        };
      }
      const slotStartTime = new Date(`${item.date}T${item.timeStart}:00+07:00`);
      if (!Number.isNaN(slotStartTime.getTime()) && slotStartTime.getTime() <= nowTime) {
        return {
          success: false,
          error: `Slot jam ${item.timeStart} pada tanggal ${item.date} sudah lewat dan tidak dapat dipesan lagi.`,
        };
      }
    }

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

    // VALIDASI KONTINUITAS PAKET SEHARIAN & MULTI-JAM (ANTI SLOT BOLONG)
    if (selectedRate && selectedRate.unit === 'PER_HARI') {
      const startH = selectedRate.timeStart ? parseInt(selectedRate.timeStart.split(':')[0], 10) : 8;
      const endH = selectedRate.timeEnd ? parseInt(selectedRate.timeEnd.split(':')[0], 10) : 20;
      const requiredSlotsCount = endH - startH;

      if (pricedItems.length < requiredSlotsCount) {
        throw new UserFacingError(
          `Pemesanan Paket Seharian harus mencakup seluruh ${requiredSlotsCount} jam operasional (${startH.toString().padStart(2, '0')}:00 - ${endH.toString().padStart(2, '0')}:00). Anda hanya memesan ${pricedItems.length} jam (terdapat slot bolong).`
        );
      }

      const sortedHours = pricedItems.map((it) => parseInt(it.timeStart.split(':')[0], 10)).sort((a, b) => a - b);
      for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] !== sortedHours[i - 1] + 1) {
          throw new UserFacingError(
            `Jadwal Paket Seharian harus berurutan secara kontinu tanpa ada jeda/slot bolong di tengahnya.`
          );
        }
      }
    } else if (
      selectedRate &&
      (selectedRate.unit === 'PER_2_JAM' || selectedRate.unit === 'PER_3_JAM' || selectedRate.unit === 'PER_4_JAM')
    ) {
      const packageDuration =
        selectedRate.unit === 'PER_2_JAM' ? 2 : selectedRate.unit === 'PER_3_JAM' ? 3 : 4;

      if (pricedItems.length % packageDuration !== 0) {
        throw new UserFacingError(
          `Jumlah jam untuk Paket ${packageDuration} Jam harus kelipatan dari ${packageDuration} jam. Anda memilih ${pricedItems.length} jam.`
        );
      }

      const sortedHours = pricedItems.map((it) => parseInt(it.timeStart.split(':')[0], 10)).sort((a, b) => a - b);
      for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] !== sortedHours[i - 1] + 1) {
          throw new UserFacingError(
            `Jadwal Paket ${packageDuration} Jam harus berurutan secara kontinu tanpa jeda waktu (slot bolong).`
          );
        }
      }
    }

    let serverTotal: number;
    if (selectedRate && selectedRate.unit === 'PER_HARI') {
      serverTotal = selectedRate.price;
      const perSlot = Math.round(selectedRate.price / pricedItems.length);
      pricedItems.forEach((i) => {
        i.price = perSlot;
      });
      const sumItems = pricedItems.reduce((acc, curr) => acc + curr.price, 0);
      const diff = serverTotal - sumItems;
      if (diff !== 0 && pricedItems.length > 0) {
        pricedItems[pricedItems.length - 1].price += diff;
      }
    } else if (
      selectedRate &&
      (selectedRate.unit === 'PER_2_JAM' || selectedRate.unit === 'PER_3_JAM' || selectedRate.unit === 'PER_4_JAM')
    ) {
      const packageDuration =
        selectedRate.unit === 'PER_2_JAM' ? 2 : selectedRate.unit === 'PER_3_JAM' ? 3 : 4;
      serverTotal = Math.round((pricedItems.length / packageDuration) * selectedRate.price);
      const perSlot = Math.round(serverTotal / pricedItems.length);
      pricedItems.forEach((i) => {
        i.price = perSlot;
      });
      const sumItems = pricedItems.reduce((acc, curr) => acc + curr.price, 0);
      const diff = serverTotal - sumItems;
      if (diff !== 0 && pricedItems.length > 0) {
        pricedItems[pricedItems.length - 1].price += diff;
      }
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
          expiresAt: new Date(Date.now() + 10 * 60000), // 10 menit untuk transfer & upload bukti
          nik: data.nik || null,
          npwp: data.npwp || null,
          senderName: data.senderName || null,
          senderPhone: data.senderPhone || null,
          paymentProofUrl: data.paymentProofUrl || null,
          adminNotes: data.userCategory ? `KATEGORI:${data.userCategory}` : null,
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

      // 2. Kunci kuota slot yang dipesan secara atomik (Pessimistic Conditional Lock)
      // PENTING (SOLUSI ANTI-DEADLOCK): Lakukan pengurutan deterministik berdasar slotId (ID ascending).
      // Mengunci baris tabel fieldSlot selalu dengan urutan yang sama persis mencegah circular wait (PostgreSQL Error 40P01)
      // ketika 2 atau lebih pemesan memilih kombinasi slot yang bersinggungan di milidetik yang sama.
      const deterministicItemsToLock = [...pricedItems].sort((a, b) => (a.slotId || '').localeCompare(b.slotId || ''));
      for (const item of deterministicItemsToLock) {
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

        // Conditional atomic update untuk mencegah race condition di tingkat database
        const updateResult = await tx.fieldSlot.updateMany({
          where: {
            id: slot.id,
            bookedCapacity: { lte: maxCap - addQty },
            status: { not: 'MAINTENANCE' },
          },
          data: {
            bookedCapacity: newBooked,
            status: isFull ? 'BOOKED' : 'AVAILABLE',
            bookingId: slot.bookingId ? slot.bookingId : newBooking.id,
            bookedByUserId: slot.bookedByUserId ? slot.bookedByUserId : userId,
          },
        });

        if (updateResult.count === 0) {
          throw new Error(
            `Slot jam ${item.timeStart} baru saja terisi oleh pemesan lain. Silakan pilih jadwal lain.`
          );
        }
      }

      return newBooking;
    }, { maxWait: 3000, timeout: 5000 });

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

    const nik = String(proofData.nik || '').trim().replace(/[^a-zA-Z0-9-]/g, '');
    if (nik.length < 8 || nik.length > 20) {
      return { success: false, error: 'Nomor identitas (NIK / NISN / NIM / NPSN) harus terdiri dari 8-20 karakter.' };
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

/**
 * Mengambil seluruh riwayat pesanan (booking) milik user yang sedang aktif login.
 * Menghubungkan langsung data PostgreSQL ke antarmuka dashboard customer secara real-time.
 */
export async function getMyBookingsAction() {
  try {
    const session = await getCurrentUserSession();
    if (!session || !session.userId) {
      return { success: false, bookings: [], error: 'Sesi login tidak ditemukan.' };
    }

    const bookings = await prisma.booking.findMany({
      where: { userId: session.userId },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            images: true,
          },
        },
        items: {
          include: {
            field: {
              select: {
                id: true,
                name: true,
                sportType: true,
              },
            },
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 1. Auto-complete: Jika waktu jadwal bermain sudah lewat, otomatis update ke COMPLETED di PostgreSQL
    const now = Date.now();
    const toCompleteIds: string[] = [];

    for (const b of bookings) {
      if (b.status === 'PAID_SUCCESS' && b.items.length > 0) {
        let latestEndTime = 0;
        for (const item of b.items) {
          try {
            const dateStr = item.date.toISOString().split('T')[0];
            const endMs = new Date(`${dateStr}T${item.timeEnd}:00+07:00`).getTime();
            if (endMs > latestEndTime) {
              latestEndTime = endMs;
            }
          } catch {
            // abaikan format gagal
          }
        }
        if (latestEndTime > 0 && now >= latestEndTime) {
          toCompleteIds.push(b.id);
          b.status = 'COMPLETED';
        }
      }
    }

    if (toCompleteIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: toCompleteIds } },
        data: { status: 'COMPLETED' },
      });
    }

    // 2. Ambil daftar venueId yang sudah pernah diulas oleh user ini
    const userReviews = await prisma.review.findMany({
      where: { userId: session.userId },
      select: { venueId: true },
    });
    const reviewedVenueIds = new Set(userReviews.map((r) => r.venueId));

    const mapped = await Promise.all(
      bookings.map(async (b) => {
        let signedUrl: string | undefined = undefined;
        if (b.paymentProofUrl) {
          try {
            signedUrl = (await getSignedProofUrl(b.paymentProofUrl)) || undefined;
          } catch {
            signedUrl = undefined;
          }
        }

        return {
          id: b.id,
          userId: b.userId,
          venueId: b.venueId,
          venueName: b.venue?.name || 'Venue Olahraga',
          venueAddress: b.venue?.address || b.venue?.city || 'Bekasi',
          venueImage: b.venue?.images?.[0] || '',
          sportCategory: b.sportCategory,
          items: b.items.map((i) => ({
            slotId: i.slotId || '',
            fieldId: i.fieldId,
            fieldName: i.field?.name,
            date: i.date.toISOString().split('T')[0],
            timeStart: i.timeStart,
            timeEnd: i.timeEnd,
            price: i.price,
            isPeakHour: i.isPeakHour,
            quantity: i.quantity,
          })),
          totalPrice: b.totalPrice,
          serviceFee: b.serviceFee,
          grandTotal: b.grandTotal,
          status: b.status as any,
          paymentMethod: b.paymentMethod as any,
          createdAt: b.createdAt.toISOString(),
          expiresAt: b.expiresAt.toISOString(),
          qrCodeToken: b.qrCodeToken,
          hasReviewed: reviewedVenueIds.has(b.venueId),
          nik: b.nik || undefined,
          npwp: b.npwp || undefined,
          senderName: b.senderName || undefined,
          senderPhone: b.senderPhone || undefined,
          paymentProofUrl: signedUrl || b.paymentProofUrl || undefined,
          adminNotes: b.adminNotes || undefined,
          ocrExtractedText: b.ocrExtractedText || undefined,
          ocrValidationResult: (b.ocrValidationResult as any) || undefined,
          ocrProcessedAt: b.ocrProcessedAt ? b.ocrProcessedAt.toISOString() : undefined,
          rescheduleStatus: (b.rescheduleStatus as any) || undefined,
          rescheduleReason: b.rescheduleReason || undefined,
          rescheduleNoticeDate: b.rescheduleNoticeDate ? b.rescheduleNoticeDate.toISOString() : undefined,
          rescheduleOriginalDate: b.rescheduleOriginalDate ? b.rescheduleOriginalDate.toISOString().split('T')[0] : undefined,
          rescheduleOriginalTime: b.rescheduleOriginalTime || undefined,
          rescheduleTargetDate: b.rescheduleTargetDate ? b.rescheduleTargetDate.toISOString().split('T')[0] : undefined,
          rescheduleTargetTime: b.rescheduleTargetTime || undefined,
          rescheduleCustomerNotes: b.rescheduleCustomerNotes || undefined,
        };
      })
    );

    return { success: true, bookings: mapped };
  } catch (error: any) {
    console.error('[getMyBookingsAction] Gagal mengambil pesanan user:', error);
    return {
      success: false,
      bookings: [],
      error: toPublicMessage(error, 'Gagal memuat daftar pesanan.'),
    };
  }
}

/**
 * Batalkan pesanan mandiri oleh user penyewa (hanya jika masih PENDING_PAYMENT atau MENUNGGU_VALIDASI).
 */
export async function cancelUserBookingAction(bookingId: string) {
  try {
    const session = await getCurrentUserSession();
    if (!session || !session.userId) {
      return { success: false, error: 'Silakan login terlebih dahulu.' };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: true },
    });

    if (!booking) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    if (booking.userId !== session.userId) {
      return { success: false, error: 'Akses ditolak.' };
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      return { success: false, error: 'Pesanan yang sudah memiliki bukti bayar atau sedang divalidasi tidak dapat dibatalkan secara otomatis.' };
    }

    if (booking.paymentProofUrl) {
      return { success: false, error: 'Pesanan yang sudah mengunggah bukti bayar tidak dapat dibatalkan secara otomatis.' };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Bebaskan kuota slot
      // PENTING (SOLUSI ANTI-DEADLOCK): Ambil slot terlebih dahulu lalu urutkan secara deterministik berdasar ID
      const slotsToRelease: { slot: any; item: any }[] = [];
      for (const item of booking.items) {
        const slot = await tx.fieldSlot.findFirst({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
        });
        if (slot) {
          slotsToRelease.push({ slot, item });
        }
      }

      slotsToRelease.sort((a, b) => a.slot.id.localeCompare(b.slot.id));

      for (const { slot, item } of slotsToRelease) {
        const qty = item.quantity || 1;
        const newBooked = Math.max(0, slot.bookedCapacity - qty);
        const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (newBooked >= slot.maxCapacity ? 'BOOKED' : 'AVAILABLE');
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

      // 2. Update status booking menjadi CANCELLED
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          adminNotes: booking.adminNotes || 'Dibatalkan oleh pemesan',
        },
      });
    }, { maxWait: 3000, timeout: 5000 });

    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('[cancelUserBookingAction] Gagal membatalkan pesanan:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal membatalkan pesanan.') };
  }
}

/**
 * Selesaikan pesanan mandiri oleh user penyewa (untuk pesanan yang sudah PAID_SUCCESS).
 */
export async function completeUserBookingAction(bookingId: string) {
  try {
    const session = await getCurrentUserSession();
    if (!session || !session.userId) {
      return { success: false, error: 'Silakan login terlebih dahulu.' };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    if (booking.userId !== session.userId) {
      return { success: false, error: 'Akses ditolak.' };
    }

    if (booking.status !== 'PAID_SUCCESS') {
      return { success: false, error: 'Hanya pesanan yang sudah lunas yang dapat diselesaikan.' };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED' },
    });

    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('[completeUserBookingAction] Gagal menyelesaikan pesanan:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal menyelesaikan pesanan.') };
  }
}

/**
 * Simpan ulasan dan rating venue ke PostgreSQL dan hitung ulang rating venue.
 */
export async function submitVenueReviewAction(data: {
  bookingId?: string;
  venueId: string;
  rating: number;
  comment: string;
  sportType: string;
}) {
  try {
    const session = await getCurrentUserSession();
    if (!session || !session.userId) {
      return { success: false, error: 'Silakan login terlebih dahulu untuk memberikan ulasan.' };
    }

    const { venueId, rating, comment, sportType } = data;
    if (!venueId || !rating || !comment?.trim()) {
      return { success: false, error: 'Mohon lengkapi rating bintang dan ulasan komentar Anda.' };
    }

    const validRating = Math.max(1, Math.min(5, Math.round(rating)));

    // 1. Simpan review ke database PostgreSQL
    await prisma.review.create({
      data: {
        venueId,
        userId: session.userId,
        rating: validRating,
        comment: comment.trim(),
        sportType: sportType || 'UMUM',
      },
    });

    // 2. Hitung ulang rata-rata rating venue
    const allReviews = await prisma.review.findMany({
      where: { venueId },
      select: { rating: true },
    });

    const totalStars = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = allReviews.length > 0 ? Number((totalStars / allReviews.length).toFixed(1)) : 5.0;

    await prisma.venue.update({
      where: { id: venueId },
      data: {
        rating: avgRating,
        reviewCount: allReviews.length,
      },
    });

    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('[submitVenueReviewAction] Gagal menyimpan ulasan:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal mengirimkan ulasan.') };
  }
}

/**
 * Pre-Hold Real: Mengunci slot jadwal di database selama 10 menit saat user masuk checkout.
 * Mencegah phantom lock & race condition di milidetik yang sama.
 */
export async function reserveTemporaryBookingAction(data: {
  venueId: string;
  sportCategory: SportCategory;
  userCategory?: UserCategory | null;
  rateId?: string | null;
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
  return createBooking({
    venueId: data.venueId,
    totalAmount: data.items.reduce((sum, item) => sum + item.price, 0),
    paymentMethod: 'QRIS',
    sportCategory: data.sportCategory,
    userCategory: data.userCategory,
    rateId: data.rateId,
    items: data.items,
  });
}

/**
 * Memperbarui data identitas pemesan (NIK, NPWP, nama, nomor telepon) pada pesanan yang sudah di-prehold.
 */
export async function updateBookingCustomerDetailsAction(data: {
  bookingId: string;
  nik?: string;
  npwp?: string;
  senderName?: string;
  senderPhone?: string;
  customerNote?: string;
}) {
  try {
    const session = await getCurrentUserSession();
    if (!session || !session.userId) {
      return { success: false, error: 'Silakan login terlebih dahulu.' };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
    });

    if (!booking) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    if (booking.userId !== session.userId) {
      return { success: false, error: 'Akses ditolak.' };
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      return { success: false, error: 'Pesanan sudah diproses atau dibatalkan.' };
    }

    await prisma.booking.update({
      where: { id: data.bookingId },
      data: {
        nik: data.nik || null,
        npwp: data.npwp || null,
        senderName: data.senderName || null,
        senderPhone: data.senderPhone || null,
        adminNotes: data.customerNote ? `Catatan: ${data.customerNote}` : booking.adminNotes,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('[updateBookingCustomerDetailsAction] Gagal memperbarui data:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal memperbarui data pemesan.') };
  }
}

/**
 * Fitur Ghost Draft Recovery:
 * Mengambil pesanan aktif berstatus PENDING_PAYMENT milik user pada venue ini (jika ada).
 * Memungkinkan pemulihan checkout ketika sinyal internet warga drop / terputus di tengah jalan.
 */
export async function getUserActivePendingBookingForVenue(venueId: string) {
  try {
    const session = await getCurrentUserSession();
    if (!session || !session.userId) return null;

    const now = new Date();
    const booking = await prisma.booking.findFirst({
      where: {
        userId: session.userId,
        venueId,
        status: 'PENDING_PAYMENT',
        expiresAt: { gt: now },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!booking) return null;

    return {
      id: booking.id,
      venueId: booking.venueId,
      sportCategory: booking.sportCategory,
      grandTotal: booking.grandTotal,
      expiresAt: booking.expiresAt ? booking.expiresAt.toISOString() : null,
      items: booking.items.map((it) => ({
        slotId: it.slotId || '',
        fieldId: it.fieldId,
        date: it.date instanceof Date ? it.date.toISOString().split('T')[0] : String(it.date).split('T')[0],
        timeStart: it.timeStart,
        timeEnd: it.timeEnd,
        price: it.price,
        isPeakHour: it.isPeakHour,
        quantity: it.quantity || 1,
      })),
    };
  } catch (err) {
    console.error('Failed to get user active pending booking for venue:', err);
    return null;
  }
}


