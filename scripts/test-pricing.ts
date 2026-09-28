import { resolveFieldPrice, pickRateForSlot } from '../src/lib/pricing';

type Row = {
  category: 'SOSIAL' | 'LOKAL' | 'AMATIR' | 'PROFESIONAL' | 'PERTANDINGAN';
  timeStart: string | null;
  timeEnd: string | null;
  price: number;
  isActive: boolean;
};

const DENTPENONTON: Row[] = [
  { category: 'PROFESIONAL', timeStart: '08:00', timeEnd: '17:00', price: 80_000_000, isActive: true },
  { category: 'PROFESIONAL', timeStart: '18:00', timeEnd: '20:00', price: 88_000_000, isActive: true },
  { category: 'AMATIR', timeStart: '08:00', timeEnd: '17:00', price: 55_000_000, isActive: true },
  { category: 'AMATIR', timeStart: '18:00', timeEnd: '20:00', price: 60_000_000, isActive: true },
  { category: 'LOKAL', timeStart: '08:00', timeEnd: '17:00', price: 55_000_000, isActive: true },
  { category: 'LOKAL', timeStart: '18:00', timeEnd: '20:00', price: 55_000_000, isActive: true },
  { category: 'SOSIAL', timeStart: null, timeEnd: null, price: 50_000_000, isActive: true },
];

let pass = 0;
let fail = 0;

function check(label: string, actual: number, expected: number) {
  const ok = actual === expected;
  if (ok) pass++;
  else fail++;
  const fmt = (n: number) => 'Rp' + n.toLocaleString('id-ID');
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${fmt(actual)}${ok ? '' : `  (harapan ${fmt(expected)})`}`);
}

const price = (category: Row['category'] | null, hour: number, rates = DENTPENONTON) =>
  resolveFieldPrice({
    rates,
    priceNonPeak: 50_000_000,
    pricePeak: 88_000_000,
    category,
    hour,
  }).price;

console.log('--- pretreatment tarif berkategori ---');
check('Profesional jam 10 (08:00-17:00)', price('PROFESIONAL', 10), 80_000_000);
check('Profesional jam 19 (18:00-20:00)', price('PROFESIONAL', 19), 88_000_000);
check('Amatir jam 09', price('AMATIR', 9), 55_000_000);
check('Amatir jam 18', price('AMATIR', 18), 60_000_000);
check('Lokal jam 16', price('LOKAL', 16), 55_000_000);
check('Lokal jam 12', price('LOKAL', 12), 55_000_000);
check('Sosial jam 14 (sepanjang hari)', price('SOSIAL', 14), 50_000_000);
check('Sosial jam 21 (sepanjang hari)', price('SOSIAL', 21), 50_000_000);

console.log('\n--- di luar rentang waktu kategori tsb ---');
// Profesional tidak punya tarif jam 21 -> fallback ke priceNonPeak/pricePeak
check('Profesional jam 21 (tak ada tarif) -> fallback', price('PROFESIONAL', 21), 88_000_000);
check('Profesional jam 07 (tak ada tarif) -> fallback', price('PROFESIONAL', 7), 50_000_000);

console.log('\n--- tanpa kategori dipilih ---');
check('Tanpa kategori jam 10 -> tarif sepanjang hari pertama', price(null, 10), 50_000_000);

console.log('\n--- tarif nonaktif harus diabaikan ---');
const withInactive: Row[] = [
  { category: 'SOSIAL', timeStart: null, timeEnd: null, price: 1_000, isActive: false },
  { category: 'SOSIAL', timeStart: null, timeEnd: null, price: 50_000_000, isActive: true },
];
check('Sosial, tarif nonaktif diabaikan', price('SOSIAL', 12, withInactive), 50_000_000);

console.log('\n--- lapangan tanpa tarif sama sekali ---');
check('Rates kosong -> priceNonPeak', price('SOSIAL', 10, []), 50_000_000);
check('Rates kosong jam peak -> pricePeak', price('SOSIAL', 20, []), 88_000_000);

console.log('\n--- batas Inclusive rentang waktu ---');
const onTheDot: Row[] = [
  { category: 'LOKAL', timeStart: '08:00', timeEnd: '17:00', price: 45_000_000, isActive: true },
];
check('Tepat jam 08:00 (batas bawah) ikut', price('LOKAL', 8, onTheDot), 45_000_000);
check('Tepat jam 17:00 (batas atas) ikut', price('LOKAL', 17, onTheDot), 45_000_000);
check('Jam 07:00 tidak ikut', price('LOKAL', 7, onTheDot), 50_000_000);

console.log('\n--- pickRateForSlot langsung ---');
const picked = pickRateForSlot(DENTPENONTON, 'AMATIR', 19);
console.log(`      AMATIR jam 19 -> ${picked?.price.toLocaleString('id-ID')} (${picked?.timeStart}-${picked?.timeEnd})`);
check('pickRateForSlot AMATIR jam 19', picked?.price ?? 0, 60_000_000);

console.log(`\n=== ${pass} lulus, ${fail} gagal ===`);
if (fail > 0) process.exitCode = 1;
