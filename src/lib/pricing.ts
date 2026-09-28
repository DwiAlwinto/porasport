import type { RateUnit, UserCategory } from '@prisma/client';
import type { TimeOfDayFilter, Venue, VenueField } from '../types';

export const USER_CATEGORY_LABELS: Record<UserCategory, string> = {
  PERTANDINGAN: 'Pertandingan / Kompetisi',
  PROFESIONAL: 'Profesional',
  AMATIR: 'Amatir',
  LOKAL: 'Lokal',
  SOSIAL: 'Sosial',
};

export const RATE_UNIT_LABELS: Record<RateUnit, string> = {
  PER_JAM: 'Per jam',
  PER_HARI: 'Per hari',
  PER_PERTANDINGAN: 'Per pertandingan',
};

/** Versi pendek untuk badge di kartu venue. */
export const RATE_UNIT_SHORT: Record<RateUnit, string> = {
  PER_JAM: 'jam',
  PER_HARI: 'hari',
  PER_PERTANDINGAN: 'pertandingan',
};

/** Jendela waktu yang dipakai kontrol filter "Ketersediaan Waktu". */
export const TIME_OF_DAY_WINDOWS: Record<
  Exclude<TimeOfDayFilter, 'ALL'>,
  { startHour: number; endHour: number; label: string }
> = {
  PAGI: { startHour: 6, endHour: 11, label: 'Pagi: 06:00 - 11:00 WIB' },
  SIANG: { startHour: 11, endHour: 16, label: 'Siang: 11:00 - 16:00 WIB' },
  MALAM: { startHour: 16, endHour: 23, label: 'Malam: 16:00 - 23:00 WIB' },
};

/**
 * Whether a rate is bookable within a given time-of-day window.
 *
 * An all-day rate (no timeStart/timeEnd) matches every window. Otherwise the
 * rate window has to overlap the filter window.
 */
export function rateMatchesTimeOfDay(
  rate: Pick<ResolvableRate, 'timeStart' | 'timeEnd'>,
  filter: TimeOfDayFilter
): boolean {
  if (filter === 'ALL') return true;
  const win = TIME_OF_DAY_WINDOWS[filter];
  if (!rate.timeStart || !rate.timeEnd) return true;

  const rateStart = minutesFromHHmm(rate.timeStart);
  const rateEnd = minutesFromHHmm(rate.timeEnd);
  if (Number.isNaN(rateStart) || Number.isNaN(rateEnd)) return true;

  const winStart = win.startHour * 60;
  const winEnd = win.endHour * 60;
  // Overlap test: [rateStart, rateEnd] ∩ [winStart, winEnd] tidak kosong
  return rateStart <= winEnd && rateEnd >= winStart;
}

/**
 * Cabang olahraga yang memakai empat tingkatan tarif stadion
 * (Sosial / Lokal / Amatir / Profesional).
 */
const STADION_TIER_SPORTS = new Set(['STADION', 'SEPAK_BOLA']);

/**
 * Cabang olahraga yang punya tiga tingkatan (Pertandingan / Profesional / Amatir).
 */
const AMATEUR_TIER_SPORTS = new Set([
  'FUTSAL',
  'BADMINTON',
  'MINI_SOCCER',
  'PADEL',
  'TENIS',
  'VOLI',
  'ROLLER_SPORT',
]);

/**
 * Daftar kategori yang relevan untuk sebuah lapangan, supaya admin tidak
 * ditawarin "Profesional" untuk lapangan basket.
 */
export function categoriesForSport(sportType: string): UserCategory[] {
  if (STADION_TIER_SPORTS.has(sportType)) {
    return ['SOSIAL', 'LOKAL', 'AMATIR', 'PROFESIONAL', 'PERTANDINGAN'];
  }
  if (AMATEUR_TIER_SPORTS.has(sportType)) {
    return ['PERTANDINGAN', 'PROFESIONAL', 'AMATIR'];
  }
  return ['PERTANDINGAN'];
}

/** Rentang waktu yang lazim dipakai untuk lapangan stadion. */
export const STANDARD_TIME_WINDOWS = [
  { timeStart: '08:00', timeEnd: '17:00', label: 'Siang (08:00 - 17:00)' },
  { timeStart: '18:00', timeEnd: '20:00', label: 'Malam (18:00 - 20:00)' },
];

export function minutesFromHHmm(value: string): number {
  const [h, m] = value.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) return NaN;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export function hourToHHmm(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export type ResolvableRate = {
  category: UserCategory;
  timeStart: string | null;
  timeEnd: string | null;
  price: number;
  isActive: boolean;
};

/**
 * Apakah sebuah tarif berlaku pada jam tertentu?
 *
 * - timeStart / timeEnd null → berlaku sepanjang hari
 * - selain itu, jam harus berada di dalam rentang [timeStart, timeEnd]
 */
export function rateCoversHour(
  rate: Pick<ResolvableRate, 'timeStart' | 'timeEnd'>,
  hour: number
): boolean {
  if (!rate.timeStart || !rate.timeEnd) return true;
  const start = minutesFromHHmm(rate.timeStart);
  const end = minutesFromHHmm(rate.timeEnd);
  if (Number.isNaN(start) || Number.isNaN(end)) return true;
  const current = hour * 60;
  return current >= start && current <= end;
}

/**
 * Pilih tarif yang benar untuk (kategori, jam).
 *
 * Prioritas:
 * 1. tarif berkategori tsb dengan rentang waktu yang mencakup jam tersebut
 * 2. tarif berkategori tsb yang berlaku sepanjang hari
 * 3. null — kategori tsb tidak punya tarif
 */
export function pickRateForSlot(
  rates: ResolvableRate[],
  category: UserCategory | null | undefined,
  hour: number
): ResolvableRate | null {
  const active = rates.filter((r) => r.isActive);

  if (category) {
    const forCategory = active.filter((r) => r.category === category);
    const timed = forCategory.find((r) => r.timeStart && r.timeEnd && rateCoversHour(r, hour));
    if (timed) return timed;
    return forCategory.find((r) => !r.timeStart || !r.timeEnd) ?? null;
  }

  // Tanpa kategori: utamakan tarif sepanjang hari.
  const allDay = active.find((r) => !r.timeStart || !r.timeEnd);
  if (allDay) return allDay;
  return active.find((r) => rateCoversHour(r, hour)) ?? null;
}

export type ResolvedPrice = {
  price: number;
  source: 'rate' | 'fallback';
  matchedLabel: string | null;
};

/**
 * Sumber kebenaran tunggal untuk harga sebuah slot.
 *
 * Dipakai oleh server (createBooking, walk-in) dan client (slot grid) supaya
 * tidak ada lagi aturan `hour >= 16` yang ditulis ulang di banyak tempat.
 *
 * `fallback` dipakai ketika lapangan belum punya tarif untuk kategori tersebut —
 * memakai priceNonPeak / pricePeak lama supaya sistem yang sudah ada tetap jalan.
 */
export function resolveFieldPrice(params: {
  rates: ResolvableRate[];
  priceNonPeak: number;
  pricePeak: number;
  category?: UserCategory | null;
  hour: number;
  isPeak?: boolean;
}): ResolvedPrice {
  const { rates, priceNonPeak, pricePeak, category, hour, isPeak } = params;

  const match = pickRateForSlot(rates, category, hour);
  if (match) {
    return {
      price: match.price,
      source: 'rate',
      matchedLabel: match.timeStart ? `${match.timeStart}-${match.timeEnd}` : 'sepanjang hari',
    };
  }

  const peak = isPeak ?? hour >= 16;
  return {
    price: peak ? pricePeak : priceNonPeak,
    source: 'fallback',
    matchedLabel: null,
  };
}

/* ------------------------------------------------------------------ */
/* Helper level venue — untuk halaman Eksplorasi                       */
/* ------------------------------------------------------------------ */

/**
 * Semua tarif yang bisa dipilih pengguna pada satu lapangan.
 *
 * Kalau lapangan belum punya tarif kategori, jatuh ke priceNonPeak /
 * pricePeak sebagai cadangan supaya filter harga tetap punya angka.
 */
export function fieldPriceEntries(field: VenueField): {
  price: number;
  unit: RateUnit;
  rate: ResolvableRate | null;
}[] {
  if (field.rates?.length) {
    return field.rates.map((r) => ({
      price: r.price,
      unit: r.unit,
      rate: {
        category: r.category,
        timeStart: r.timeStart,
        timeEnd: r.timeEnd,
        price: r.price,
        isActive: r.isActive,
      },
    }));
  }
  return [
    { price: field.priceNonPeak, unit: 'PER_JAM' as RateUnit, rate: null },
    { price: field.pricePeak, unit: 'PER_JAM' as RateUnit, rate: null },
  ];
}

/** Semua entri harga sebuah venue, digabung dari seluruh lapangan. */
export function venuePriceEntries(venue: Venue) {
  return (venue.fields ?? []).flatMap((f) => fieldPriceEntries(f));
}

/** Bulatkan ke angka yang enak dilihat (1 / 2 / 5 x pangkat 10, ke atas). */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Rentang harga terendah dan tertinggi di seluruh venue, dibulatkan.
 * Slider filter memakai nilai ini sehingga batasnya selalu mengikuti data asli.
 */
export function venuePriceBounds(venues: Venue[]): { min: number; max: number } {
  const prices: number[] = [];
  for (const v of venues) {
    for (const e of venuePriceEntries(v)) {
      if (e.price > 0) prices.push(e.price);
    }
  }
  if (!prices.length) return { min: 50_000, max: 1_000_000 };

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min: Math.max(1, niceCeil(min)), max: niceCeil(max) || 1 };
}

/**
 * Apakah venue punya minimal satu tarif yang muat dalam anggaran?
 *
 * Venue TIDAK disaring hanya karena harga termurah-nya di atas batas —
 * selama masih ada kategori/jam lain yang terjangkau, venue tetap tampil.
 * `maxPrice` null berarti tidak ada batas.
 */
export function venueHasRateWithin(venue: Venue, maxPrice: number | null): boolean {
  if (maxPrice == null) return true;
  return venuePriceEntries(venue).some((e) => e.price > 0 && e.price <= maxPrice);
}

/** Apakah venue punya tarif yang bisa dipesan pada jendela waktu terpilih? */
export function venueHasRateInTimeOfDay(venue: Venue, filter: TimeOfDayFilter): boolean {
  if (filter === 'ALL') return true;
  for (const e of venuePriceEntries(venue)) {
    if (e.rate && rateMatchesTimeOfDay(e.rate, filter)) return true;
  }
  return false;
}

/* --- Slider skala logaritmik ------------------------------------- */
/*
 * Rentang harga nyata bisa sangat luas (mis. Rp 50 ribu sampai Rp 88 juta).
 * Slider linear akan menumpuk semua harga rendah di ujung kiri, jadi
 * dipakai skala logaritmik: posisi 0..1000 dipetakan ke price secara
 * geometris sehingga tiap layar menampilkan seluruh rentang.
 */

export const LOG_SLIDER_STEPS = 1000;

export function logSliderToPrice(position: number, min: number, max: number): number {
  if (max <= min) return max;
  const clamped = Math.min(Math.max(position, 0), LOG_SLIDER_STEPS);
  const ratio = clamped / LOG_SLIDER_STEPS;
  return Math.round(min * Math.pow(max / min, ratio));
}

export function priceToLogSlider(price: number, min: number, max: number): number {
  if (max <= min) return LOG_SLIDER_STEPS;
  const safe = Math.min(Math.max(price, min), max);
  const ratio = Math.log(safe / min) / Math.log(max / min);
  return Math.round(ratio * LOG_SLIDER_STEPS);
}
