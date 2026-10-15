"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { SportCategory, RateUnit, UserCategory } from '@prisma/client';
import { resolveFieldPrice } from '../lib/pricing';
import { getAdminSession } from './authActions';
import crypto from 'crypto';
import { toPublicMessage, UserFacingError } from '../lib/userFacingError';
import { todayKey, addDaysToKey, dateFromKey } from '../lib/dateKeys';
import { supabase } from '../lib/storage';

const FACILITY_BUCKET = 'facility-images';

const VALID_CATEGORIES: UserCategory[] = [
  'PERTANDINGAN',
  'PROFESIONAL',
  'AMATIR',
  'LOKAL',
  'SOSIAL',
];
const VALID_UNITS: RateUnit[] = ['PER_JAM', 'PER_HARI', 'PER_PERTANDINGAN'];

/** Bentuk data tarif yang dikirim dari form admin. */
export type FieldRateInput = {
  category: UserCategory;
  timeStart?: string | null;
  timeEnd?: string | null;
  price: number;
  unit: RateUnit;
  label?: string;
};

/** Hasil normalisasi: `label` sudah selalu terisi. */
type NormalisedRate = {
  category: UserCategory;
  timeStart: string | null;
  timeEnd: string | null;
  price: number;
  unit: RateUnit;
  label: string;
};

/**
 * Bersihkan input tarif dari form: buang baris kosong / tidak valid, samakan
 * HH:mm, dan tolak kategori atau satuan di luar enum.
 */
function normaliseRateInputs(input?: FieldRateInput[]): NormalisedRate[] {
  if (!input) return [];

  const seen = new Set<string>();
  const out: NormalisedRate[] = [];

  for (const r of input) {
    const price = Number(r?.price);
    if (!Number.isFinite(price) || price < 0) continue;
    if (!VALID_CATEGORIES.includes(r.category)) continue;

    const timeStart = r.timeStart?.trim() || null;
    const timeEnd = r.timeEnd?.trim() || null;
    // Satu waktu tanpa pasangannya berarti tarif sepanjang hari.
    const window = timeStart && timeEnd ? { timeStart, timeEnd } : { timeStart: null, timeEnd: null };

    const key = `${r.category}|${window.timeStart ?? '-'}|${window.timeEnd ?? '-'}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const unit = VALID_UNITS.includes(r.unit) ? r.unit : 'PER_JAM';
    const customLabel = r.label?.trim();
    out.push({
      category: r.category,
      timeStart: window.timeStart,
      timeEnd: window.timeEnd,
      price: Math.round(price),
      unit,
      label: customLabel || r.category.charAt(0) + r.category.slice(1).toLowerCase(),
    });
  }

  return out;
}

/**
 * Penjaga akses untuk seluruh aksi CMS.
 *
 * File ini memakai "use server", sehingga setiap export di dalamnya menjadi
 * endpoint yang bisa dipanggil siapa pun lewat POST. Tanpa penjaga ini,
 * siapa pun bisa menghapus venue, mengubah harga, atau menulis file ke `public/`.
 *
 * Sengaja melempar Error (bukan return) supaya kegagalan tidak pernah bisa
 * disamarkan jadi "sukses".
 */
async function requireCmsAccess() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    throw new UserFacingError('Akses ditolak: Anda harus login sebagai admin DISBUDPORA.');
  }
  return session;
}

/**
 * 1. Ambil Semua Venue Beserta Lapangannya untuk CMS
 */
export async function getCmsVenues() {
  try {
    await requireCmsAccess();
    const venues = await prisma.venue.findMany({
      include: {
        fields: {
          orderBy: { name: 'asc' },
          include: {
            rates: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, venues };
  } catch (error: any) {
    console.error("Failed to get CMS venues:", error);
    return { success: false, venues: [], error: toPublicMessage(error, 'Gagal memuat data venue.') };
  }
}

/**
 * 2. Tambah / Edit Venue Fasilitas
 */
export async function createOrUpdateVenue(data: {
  id?: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
  description: string;
  openingHours: string;
  facilities: string[];
  images: string[];
  minPrice: number;
  maxPrice: number;
  isPopular?: boolean;
  isPromo?: boolean;
  promoBadge?: string;
}) {
  try {
    await requireCmsAccess();
    const owner = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const ownerId = owner ? owner.id : 'admin-1';

    let venue;
    if (data.id) {
      venue = await prisma.venue.update({
        where: { id: data.id },
        data: {
          name: data.name,
          slug: data.slug,
          city: data.city,
          address: data.address,
          lat: data.lat || 0,
          lng: data.lng || 0,
          description: data.description,
          openingHours: data.openingHours || '06:00 - 23:00 WIB',
          facilities: data.facilities,
          images: data.images,
          minPrice: data.minPrice,
          maxPrice: data.maxPrice,
          isPopular: !!data.isPopular,
          isPromo: !!data.isPromo,
          promoBadge: data.promoBadge || null,
        },
      });
    } else {
      venue = await prisma.venue.create({
        data: {
          ownerId,
          name: data.name,
          slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          city: data.city,
          address: data.address,
          lat: data.lat || 0,
          lng: data.lng || 0,
          description: data.description,
          openingHours: data.openingHours || '06:00 - 23:00 WIB',
          facilities: data.facilities,
          images: data.images.length > 0 ? data.images : ['/images/wibawamukti.png'],
          minPrice: data.minPrice || 50000,
          maxPrice: data.maxPrice || 350000,
          isPopular: !!data.isPopular,
          isPromo: !!data.isPromo,
          promoBadge: data.promoBadge || null,
        },
      });
    }

    revalidatePath('/');
    revalidatePath('/admin/venues');
    return { success: true, venue };
  } catch (error: any) {
    console.error("Failed to save venue:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal menyimpan data venue.') };
  }
}

/**
 * 3. Hapus Venue
 */
export async function deleteVenue(venueId: string) {
  try {
    await requireCmsAccess();
    await prisma.venue.delete({
      where: { id: venueId },
    });
    revalidatePath('/');
    revalidatePath('/admin/venues');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete venue:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal menghapus venue.') };
  }
}

/**
 * 4. Tambah / Edit Lapangan pada Venue
 */
export async function createOrUpdateField(data: {
  id?: string;
  venueId: string;
  name: string;
  sportType: SportCategory;
  type: string;
  floorType: string;
  priceNonPeak: number;
  pricePeak: number;
  rates?: FieldRateInput[];
}) {
  try {
    await requireCmsAccess();
    const rates = normaliseRateInputs(data.rates);

    // Bila tarif kategori sudah diisi, priceNonPeak/pricePeak ikut mengikuti
    // rentang min/max agar alur booking lama tetap konsisten.
    const derived = rates.length
      ? {
          priceNonPeak: Math.min(...rates.map((r) => r.price)),
          pricePeak: Math.max(...rates.map((r) => r.price)),
        }
      : { priceNonPeak: data.priceNonPeak, pricePeak: data.pricePeak };

    const fieldData = {
      name: data.name,
      sportType: data.sportType,
      type: data.type || 'Outdoor',
      floorType: data.floorType || 'Rumput Alami',
      priceNonPeak: derived.priceNonPeak,
      pricePeak: derived.pricePeak,
    };

    let field;
    if (data.id) {
      field = await prisma.venueField.update({
        where: { id: data.id },
        data: fieldData,
      });
    } else {
      field = await prisma.venueField.create({
        data: {
          venueId: data.venueId,
          ...fieldData,
        },
      });
    }

    // Simpan tarif kategori. Selalu dihapus lalu dibuat ulang supaya form admin
    // menjadi sumber kebenaran tunggal (tidak ada tarif nyasar yang tertinggal).
    if (data.rates) {
      await prisma.fieldRate.deleteMany({ where: { fieldId: field.id } });
      if (rates.length) {
        await prisma.fieldRate.createMany({
          data: rates.map((r, i) => ({ ...r, fieldId: field.id, sortOrder: i })),
        });
      }
      await refreshFutureSlotPrices(field.id);
    }

    // Generate initial slots (hanya saat lapangan baru).
    // Kunci tanggal memakai helper bersama supaya id slot sama dengan yang
    // dibuat oleh ensureSlotsForField di venueActions.
    if (!data.id) {
      // Ambil ulang beserta tarifnya supaya harga slot mengikuti tier kategori,
      // bukan hanya priceNonPeak/pricePeak.
      const withRates = await prisma.venueField.findUniqueOrThrow({
        where: { id: field.id },
        include: { rates: true },
      });
      const slotsToCreate = [];
      const startKey = todayKey();

      for (let i = 0; i < 7; i++) {
        const dateStr = addDaysToKey(startKey, i);
        const slotDate = dateFromKey(dateStr);

        for (let hour = 6; hour < 23; hour++) {
          const isPeak = hour >= 16;
          const { price } = resolveFieldPrice({
            rates: withRates.rates,
            priceNonPeak: withRates.priceNonPeak,
            pricePeak: withRates.pricePeak,
            hour,
            isPeak,
          });
          slotsToCreate.push({
            id: `${field.id}-${dateStr}-${hour}`,
            fieldId: field.id,
            date: slotDate,
            timeStart: `${hour.toString().padStart(2, '0')}:00`,
            timeEnd: `${(hour + 1).toString().padStart(2, '0')}:00`,
            hour: hour,
            price,
            isPeakHour: isPeak,
            status: 'AVAILABLE' as const,
          });
        }
      }

      await prisma.fieldSlot.createMany({
        data: slotsToCreate,
        skipDuplicates: true,
      });
    }

    revalidatePath('/');
    revalidatePath('/admin/venues');
    try {
      const parentVenue = await prisma.venue.findUnique({
        where: { id: field.venueId },
        select: { slug: true },
      });
      if (parentVenue?.slug) {
        revalidatePath(`/venues/${parentVenue.slug}`);
      }
    } catch (e) {
      // Non-fatal if revalidation fails
    }
    return { success: true, field };
  } catch (error: any) {
    console.error("Failed to save field:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal menyimpan data lapangan.') };
  }
}

/**
 * Samakan ulang harga slot yang belum dipesan ke tarif terbaru.
 * Slot yang sudah BOOKED tidak disentuh supaya harga yang sudah dibayar konsisten.
 */
async function refreshFutureSlotPrices(fieldId: string) {
  const field = await prisma.venueField.findUnique({
    where: { id: fieldId },
    include: { rates: true },
  });
  if (!field) return;

  const today = dateFromKey(todayKey());

  const slots = await prisma.fieldSlot.findMany({
    where: { fieldId, date: { gte: today }, status: 'AVAILABLE' },
  });

  for (const slot of slots) {
    const resolved = resolveFieldPrice({
      rates: field.rates,
      priceNonPeak: field.priceNonPeak,
      pricePeak: field.pricePeak,
      hour: slot.hour,
      isPeak: slot.isPeakHour,
    });
    if (resolved.price !== slot.price) {
      await prisma.fieldSlot.update({ where: { id: slot.id }, data: { price: resolved.price } });
    }
  }
}

/**
 * 5. Hapus Lapangan
 */
export async function deleteField(fieldId: string) {
  try {
    await requireCmsAccess();
    await prisma.venueField.delete({
      where: { id: fieldId },
    });
    revalidatePath('/');
    revalidatePath('/admin/venues');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete field:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal menghapus lapangan.') };
  }
}

/**
 * 6. Upload Foto Fasilitas (Menyimpan file ke folder public/images/uploads/)
 */
/** Ekstensi gambar yang boleh ditulis ke folder publik. */
const ALLOWED_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'] as const;

/** Batas ukuran gambar facilities: 5 MB. */
const MAX_FACILITY_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Periksa magic bytes file gambar.
 *
 * Ekstensi dan Content-Type yang dikirim client bisa dipalsukan, jadi isi
 * filenya sendiri yang jadi acuan. Tanpa ini, file `.html` atau `.svg`
 * berisi skrip bisa ditulis ke `public/` lalu disajikan dari origin aplikasi
 * (stored XSS).
 */
function looksLikeImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return true;
  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return true;
  return false;
}

export async function uploadFacilityImageAction(data: { base64: string; fileName: string }) {
  try {
    await requireCmsAccess();

    // Ekstrak base64 buffer
    const matches = data.base64.match(/^data:([A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new UserFacingError('Format base64 gambar tidak valid.');
    }

    const buffer = Buffer.from(matches[2], 'base64');

    if (buffer.length === 0) {
      throw new UserFacingError('File gambar kosong.');
    }
    if (buffer.length > MAX_FACILITY_IMAGE_BYTES) {
      throw new UserFacingError('Ukuran gambar maksimal 5 MB.');
    }
    if (!looksLikeImage(buffer)) {
      throw new UserFacingError('File yang diunggah bukan gambar JPG, PNG, atau WEBP yang valid.');
    }

    // Ekstensi ditentukan dari allowlist, bukan dari fileName milik client.
    const ext = (data.fileName.split('.').pop() || '').toLowerCase();
    if (!(ALLOWED_IMAGE_EXT as readonly string[]).includes(ext)) {
      throw new UserFacingError('Format berkas tidak didukung. Gunakan JPG, PNG, atau WEBP.');
    }

    const safeName = `facility-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const contentType =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from(FACILITY_BUCKET)
      .upload(safeName, buffer, { contentType, upsert: false });

    if (uploadError) {
      console.error('Supabase facility upload error:', uploadError);
      throw new UserFacingError('Gagal menyimpan foto ke penyimpanan cloud.');
    }

    const { data: pub } = supabase.storage.from(FACILITY_BUCKET).getPublicUrl(safeName);
    return { success: true, url: pub.publicUrl };
  } catch (error: unknown) {
    console.error('Failed to upload facility image:', error);
    return {
      success: false,
      error: toPublicMessage(error, 'Gagal mengunggah foto fasilitas.'),
    };
  }
}
