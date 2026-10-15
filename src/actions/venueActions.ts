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
            slots: {
              where: {
                // Hanya ambil slot mulai dari hari ini ke depan
                date: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
              },
              orderBy: [
                { date: 'asc' },
                { hour: 'asc' }
              ]
            }
          }
        }
      }
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

const SLOT_START_HOUR = 6;
const SLOT_END_HOUR = 23; // exclusive
/** Berapa hari ke depan slot dijaga agar selalu tersedia. */
const SLOT_ROLL_FORWARD_DAYS = 45;

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/**
 * Pastikan slot untuk N hari ke depan tersedia.
 *
 * Sebelumnya slot hanya dibuat 7 hari saat lapangan dibuat, lalu tidak pernah
 * digulirkan — sehingga tanggal yang lebih jauh selalu kosong. Sekarang setiap
 * kali slot diambil, hari yang belum ada akan dibuat lengkap.
 */
async function ensureSlotsForField(fieldId: string, daysAhead = SLOT_ROLL_FORWARD_DAYS) {
  const field = await prisma.venueField.findUnique({
    where: { id: fieldId },
    include: { rates: true },
  });
  if (!field) return null;

  const today = startOfDay(new Date());
  const until = addDays(today, daysAhead);

  const existing = await prisma.fieldSlot.findMany({
    where: { fieldId, date: { gte: today, lt: until } },
    select: { date: true },
    distinct: ['date'],
  });
  const have = new Set(existing.map((r) => toDateKey(r.date)));

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
  }[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const d = addDays(today, i);
    const key = toDateKey(d);
    if (have.has(key)) continue;

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
        date: d,
        hour,
        timeStart: `${String(hour).padStart(2, '0')}:00`,
        timeEnd: `${String(hour + 1).padStart(2, '0')}:00`,
        price,
        isPeakHour: hour >= 16,
        status: 'AVAILABLE',
      });
    }
  }

  if (rows.length) {
    await prisma.fieldSlot.createMany({ data: rows, skipDuplicates: true });
  }
  return field;
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
};

/**
 * Slot jadwal untuk halaman detail venue.
 *
 * Harga dihitung ulang di server dari `field_rates` untuk kategori yang dipilih,
 * sehingga angka yang dilihat pengguna identik dengan yang tersimpan saat booking.
 * Data pemesan / booking TIDAK ikut dikembalikan.
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

    const field = await ensureSlotsForField(fieldId);
    if (!field) {
      return { ok: false, slots: [], error: 'Lapangan tidak ditemukan.' };
    }

    const rows = await prisma.fieldSlot.findMany({
      where: { fieldId, date: target },
      orderBy: { hour: 'asc' },
    });

    const slots: PublicSlot[] = rows.map((r) => {
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
      return {
        id: r.id,
        fieldId: r.fieldId,
        date,
        hour: r.hour,
        timeStart: r.timeStart,
        timeEnd: r.timeEnd,
        price,
        isPeakHour: r.isPeakHour,
        status: r.status,
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

    // Validasi waktu: tolak slot yang jam mulainya sudah lewat (WIB / UTC+7)
    const nowTime = Date.now();
    for (const item of data.items) {
      // item.date e.g. "2026-10-15", item.timeStart e.g. "08:00"
      const slotStartTime = new Date(`${item.date}T${item.timeStart}:00+07:00`);
      if (!Number.isNaN(slotStartTime.getTime()) && slotStartTime.getTime() <= nowTime) {
        return {
          success: false,
          error: `Slot jam ${item.timeStart} pada tanggal ${item.date} sudah lewat dan tidak dapat dipesan lagi.`,
        };
      }
    }

    // Harga SELALU dihitung ulang di server dari tabel field_rates.
    // Nilai price/totalAmount yang dikirim client hanya dipakai sebagai
    // pembanding dan tidak pernah dipercaya.
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
      // Cegah mencampur lapangan dari venue berbeda dalam satu pesanan.
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
      return { ...item, price: resolved.price };
    });

    const serverTotal = pricedItems.reduce((sum, i) => sum + i.price, 0);
    const serviceFee = 5000;
    const grandTotal = serverTotal + serviceFee;

    // Jalankan dalam transaksi agar aman: Booking Dibuat + Slot Diupdate
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
          expiresAt: new Date(Date.now() + 60 * 60000), // Berikan waktu 60 menit untuk transfer & upload bukti
          nik: data.nik || null,
          npwp: data.npwp || null,
          senderName: data.senderName || null,
          senderPhone: data.senderPhone || null,
          paymentProofUrl: data.paymentProofUrl || null,
          items: {
            create: pricedItems.map(item => ({
              fieldId: item.fieldId,
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

      // 2. Kunci slot yang dipesan.
      //
      // `slotId` datang dari client, jadi TIDAK boleh dipercaya apa adanya:
      //   - selalu pastikan slot itu milik field/tanggal yang dipesan
      //   - hanya ambil slot yang statusnya masih AVAILABLE
      //
      // updateMany bersifat atomik: bila dua orang memesan slot yang sama
      // bersamaan, hanya satu yang mendapat count = 1, sisanya gagal dan
      // seluruh transaksi dibatalkan. Dengan `update` biasa, slot yang sudah
      // BOOKED bisa ditimpa sehingga pembayaran orang pertama jadi yatim.
      for (const item of data.items) {
        const claimed = await tx.fieldSlot.updateMany({
          where: {
            id: item.slotId,
            fieldId: item.fieldId,
            timeStart: item.timeStart,
            status: 'AVAILABLE',
          },
          data: {
            status: 'BOOKED',
            bookingId: newBooking.id,
            bookedByUserId: userId,
          },
        });

        if (claimed.count !== 1) {
          throw new Error(
            `Slot ${item.timeStart} sudah tidak tersedia. Silakan pilih jadwal lain.`
          );
        }
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
