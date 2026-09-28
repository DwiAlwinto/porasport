import { parseFiltersFromQuery, serialiseFiltersToQuery } from '../src/lib/filterUrl';
import type { SearchFilters } from '../src/types';

let pass = 0;
let fail = 0;

const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${JSON.stringify(actual)}${
      ok ? '' : `  (harapan ${JSON.stringify(expected)})`
    }`
  );
};

const defaults: SearchFilters = {
  sport: 'ALL',
  city: 'ALL',
  date: '2026-09-27',
  maxPrice: null,
  facilities: [],
  timeOfDay: 'ALL',
  sortBy: 'POPULARITY',
};

console.log('--- query kosong -> default utuh ---');
check('tanpa query', parseFiltersFromQuery('', defaults), defaults);

console.log('\n--- round trip ---');
const chosen: SearchFilters = {
  sport: 'STADION',
  city: 'Wibawa Mukti',
  date: '2026-10-01',
  maxPrice: 20_000_000,
  facilities: ['Parkir Luas', 'Toilet & Shower'],
  timeOfDay: 'MALAM',
  sortBy: 'PRICE_ASC',
};
const qs = serialiseFiltersToQuery(chosen, defaults);
console.log(`      query: ${qs}`);
check('round trip kembali ke filter yang sama', parseFiltersFromQuery(qs, defaults), chosen);

console.log('\n--- nilai yang tidak sah diabaikan ---');
check('sport ngawur -> ALL', parseFiltersFromQuery('?sport=HAKIM', defaults).sport, 'ALL');
check('city ngawur -> ALL', parseFiltersFromQuery('?city=Planet-Mars', defaults).city, 'ALL');
check('tanggal salah format -> default', parseFiltersFromQuery('?date=31-12-2026', defaults).date, defaults.date);
check('when ngawur -> ALL', parseFiltersFromQuery('?when=MALAM-JAM-3', defaults).timeOfDay, 'ALL');
check('sort ngawur -> default', parseFiltersFromQuery('?sort=ACAK', defaults).sortBy, 'POPULARITY');

console.log('\n--- penanganan maxPrice ---');
check('tidak ada param -> default null', parseFiltersFromQuery('', defaults).maxPrice, null);
check('ada angka -> dipakai', parseFiltersFromQuery('?maxPrice=5000000', defaults).maxPrice, 5_000_000);
check('string kosong -> null (tanpa batas)', parseFiltersFromQuery('?maxPrice=', defaults).maxPrice, null);
check('bukan angka -> null', parseFiltersFromQuery('?maxPrice=abc', defaults).maxPrice, null);
check('nol / negatif -> null', parseFiltersFromQuery('?maxPrice=-5', defaults).maxPrice, null);

console.log('\n--- fasilitas dengan spasi & karakter khusus ---');
const withFac = parseFiltersFromQuery(
  '?fac=' + encodeURIComponent('Parkir Luas~Toilet & Shower~Kantin / Cafe'),
  defaults
);
check('3 fasilitas ter-parse', withFac.facilities, ['Parkir Luas', 'Toilet & Shower', 'Kantin / Cafe']);

console.log('\n--- default tidak ditulis ke URL ---');
check('filter default -> query kosong', serialiseFiltersToQuery(defaults, defaults), '');
check('hanya sort berubah', serialiseFiltersToQuery({ ...defaults, sortBy: 'NEWEST' }, defaults), '?sort=NEWEST');
check(
  'maxPrice null tidak ikut ditulis',
  serialiseFiltersToQuery({ ...defaults, maxPrice: null, sport: 'BASKET' }, defaults),
  '?sport=BASKET'
);

console.log('\n--- facilities default tidak di-share ---');
const dWithFac = { ...defaults, facilities: ['Parkir Luas'] };
check(
  'fasilitas default ikut ditulis',
  serialiseFiltersToQuery(dWithFac, defaults),
  '?fac=Parkir+Luas'
);

console.log(`\n=== ${pass} lulus, ${fail} gagal ===`);
if (fail > 0) process.exitCode = 1;
