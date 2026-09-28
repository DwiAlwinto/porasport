import {
  venuePriceBounds,
  venueHasRateWithin,
  venueHasRateInTimeOfDay,
  venuePriceEntries,
  logSliderToPrice,
  priceToLogSlider,
  niceCeil,
  rateMatchesTimeOfDay,
  LOG_SLIDER_STEPS,
} from '../src/lib/pricing';
import type { Venue, VenueField } from '../src/types';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${JSON.stringify(actual)}${
      ok ? '' : `  (harapan ${JSON.stringify(expected)})`
    }`
  );
}

// Venue dengan 4 lapangan + tarif seperti data Wibawa Mukti sungguhan
const rates = (
  fieldId: string,
  rows: { category: string; timeStart: string | null; timeEnd: string | null; price: number; unit: string }[]
) =>
  rows.map((r, i) => ({
    id: `${fieldId}-r${i}`,
    fieldId,
    category: r.category as never,
    label: r.category,
    timeStart: r.timeStart,
    timeEnd: r.timeEnd,
    price: r.price,
    unit: r.unit as never,
    sortOrder: i,
    isActive: true,
  }));

const stadiumWithSpectators: VenueField = {
  id: 'f1',
  venueId: 'v1',
  name: 'Stadion (Dengan Penonton)',
  sportType: 'STADION' as never,
  type: 'Outdoor',
  floorType: 'Rumput Alami',
  priceNonPeak: 50_000_000,
  pricePeak: 88_000_000,
  rates: rates('f1', [
    { category: 'PROFESIONAL', timeStart: '08:00', timeEnd: '17:00', price: 80_000_000, unit: 'PER_PERTANDINGAN' },
    { category: 'PROFESIONAL', timeStart: '18:00', timeEnd: '20:00', price: 88_000_000, unit: 'PER_PERTANDINGAN' },
    { category: 'AMATIR', timeStart: '08:00', timeEnd: '17:00', price: 55_000_000, unit: 'PER_PERTANDINGAN' },
    { category: 'AMATIR', timeStart: '18:00', timeEnd: '20:00', price: 60_000_000, unit: 'PER_PERTANDINGAN' },
    { category: 'LOKAL', timeStart: '08:00', timeEnd: '17:00', price: 55_000_000, unit: 'PER_PERTANDINGAN' },
    { category: 'SOSIAL', timeStart: null, timeEnd: null, price: 50_000_000, unit: 'PER_PERTANDINGAN' },
  ]),
};

const basket: VenueField = {
  id: 'f2',
  venueId: 'v1',
  name: 'Bola Basket',
  sportType: 'BASKET' as never,
  type: 'Outdoor',
  floorType: 'Sintetis',
  priceNonPeak: 1_500_000,
  pricePeak: 1_500_000,
  rates: rates('f2', [
    { category: 'PERTANDINGAN', timeStart: null, timeEnd: null, price: 1_500_000, unit: 'PER_HARI' },
  ]),
};

const shooting: VenueField = {
  id: 'f3',
  venueId: 'v1',
  name: 'Menembak',
  sportType: 'MENEMBAK' as never,
  type: 'Outdoor',
  floorType: 'Mixer',
  priceNonPeak: 3_500_000,
  pricePeak: 3_500_000,
  rates: rates('f3', [
    { category: 'PERTANDINGAN', timeStart: null, timeEnd: null, price: 3_500_000, unit: 'PER_HARI' },
  ]),
};

const venue: Venue = {
  id: 'v1',
  name: 'STADION WIBAWA MUKTI',
  slug: 'stadion-wibawa-mukti',
  sportTypes: ['STADION', 'BASKET', 'MENEMBAK'] as never,
  city: 'Wibawa Mukti' as never,
  address: 'Jl. Raya Wibawa Mukti',
  lat: -6.38,
  lng: 107.32,
  description: 'test',
  openingHours: '06:00 - 23:00 WIB',
  images: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  rating: 4.8,
  reviewCount: 120,
  minPrice: 1_500_000,
  maxPrice: 88_000_000,
  isPopular: true,
  ownerId: 'u1',
  facilities: ['Parkir Luas'],
  fields: [stadiumWithSpectators, basket, shooting],
};

console.log('--- niceCeil ---');
check('niceCeil 1_500_000', niceCeil(1_500_000), 2_000_000);
check('niceCeil 88_000_000', niceCeil(88_000_000), 100_000_000);
check('niceCeil 0', niceCeil(0), 0);

console.log('\n--- venuePriceBounds ---');
check('batas dari semua tarif', venuePriceBounds([venue]), { min: 2_000_000, max: 100_000_000 });
check('venue tanpa tarif -> default', venuePriceBounds([]), { min: 50_000, max: 1_000_000 });

console.log('\n--- venueHasRateWithin (regresi bug 0 venue) ---');
check('tanpa batas (null) selalu lolos', venueHasRateWithin(venue, null), true);
check('batas 800.000 (default lama) Lolos karena ada tarif 1,5jt', venueHasRateWithin(venue, 800_000), false);
check('batas 1.000.000', venueHasRateWithin(venue, 1_000_000), false);
check('batas 1.600.000 (basket masuk)', venueHasRateWithin(venue, 1_600_000), true);
check('batas 90.000.000 (semua masuk)', venueHasRateWithin(venue, 90_000_000), true);

console.log('\n--- venueHasRateInTimeOfDay ---');
check('ALL selalu lolos', venueHasRateInTimeOfDay(venue, 'ALL'), true);
check('PAGI: tarif stadium 08:00-17:00 ada', venueHasRateInTimeOfDay(venue, 'PAGI'), true);
check('MALAM: tarif 18:00-20:00 ada', venueHasRateInTimeOfDay(venue, 'MALAM'), true);
check('SIANG: overlap 11:00-16:00 ada', venueHasRateInTimeOfDay(venue, 'SIANG'), true);

console.log('\n--- rateMatchesTimeOfDay ---');
const PAGI = { timeStart: '06:00', timeEnd: '10:00' };
const MALAM = { timeStart: '18:00', timeEnd: '23:00' };
const SEHARI = { timeStart: null, timeEnd: null };
check('PAGI 06-10 vs PAGI', rateMatchesTimeOfDay(PAGI, 'PAGI'), true);
check('PAGI 06-10 vs MALAM', rateMatchesTimeOfDay(PAGI, 'MALAM'), false);
check('MALAM 18-23 vs MALAM', rateMatchesTimeOfDay(MALAM, 'MALAM'), true);
check('tarif sepanjang hari vs MALAM', rateMatchesTimeOfDay(SEHARI, 'MALAM'), true);
check('tarif 08-17 vs MALAM (16-23) overlap di 16-17', rateMatchesTimeOfDay({ timeStart: '08:00', timeEnd: '17:00' }, 'MALAM'), true);
check('tarif 08-17 vs PAGI (6-11) overlap', rateMatchesTimeOfDay({ timeStart: '08:00', timeEnd: '17:00' }, 'PAGI'), true);

console.log('\n--- slider logaritmik ---');
const min = 2_000_000;
const max = 100_000_000;
check('posisi 0 -> harga minimum', logSliderToPrice(0, min, max), min);
check('posisi 1000 -> harga maksimum', logSliderToPrice(LOG_SLIDER_STEPS, min, max), max);
check('posisi tengah -> geometric mean', logSliderToPrice(500, min, max), Math.round(min * Math.sqrt(max / min)));
check('harga -> posisi (round trip)', priceToLogSlider(20_000_000, min, max) > 400, true);
check('posisi di-clamp di atas max', logSliderToPrice(5000, min, max), max);
check('posisi di-clamp di bawah min', logSliderToPrice(-10, min, max), min);
check('min == max tidak crash', logSliderToPrice(500, 5_000_000, 5_000_000), 5_000_000);
check('harness: min==max posisi penuh', priceToLogSlider(1, 5_000_000, 5_000_000), LOG_SLIDER_STEPS);

console.log('\n--- venuePriceEntries (fallback tanpa tarif) ---');
const legacyField: VenueField = {
  id: 'f4',
  venueId: 'v1',
  name: 'Legacy',
  sportType: 'FUTSAL' as never,
  type: 'Indoor',
  floorType: 'Vinyl',
  priceNonPeak: 100_000,
  pricePeak: 150_000,
};
const legacyVenue: Venue = { ...venue, id: 'v2', fields: [legacyField] };
check('lapangan tanpa tarif -> 2 entri cadangan', venuePriceEntries(legacyVenue).length, 2);
check('entri cadangan memakai PER_JAM', venuePriceEntries(legacyVenue).map((e) => e.unit), ['PER_JAM', 'PER_JAM']);
check('venue dengan tarif -> jumlah entri', venuePriceEntries(venue).length, 8);

console.log(`\n=== ${pass} lulus, ${fail} gagal ===`);
if (fail > 0) process.exitCode = 1;
