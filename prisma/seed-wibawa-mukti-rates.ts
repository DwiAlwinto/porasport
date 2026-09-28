/**
 * Seed tarif facilities Wibawa Mukti.
 *
 * Mengisi tabel `venue_fields` (4 lapangan) dan `field_rates` (16 baris tarif)
 * sesuai tabel tarif resmi DISBUDPORA.
 *
 * Aman dijalankan berulang: Script ini memakai findFirst + create/update
 * (bukan upsert compound) karena `timeStart`/`timeEnd` nullable — PostgreSQL
 * menganggap NULL berbeda, jadi @@unique compound tidak bisa dipakai untuk
 * mendeduplikasi baris tarif sepanjang hari.
 *
 * Jalankan: npm run db:seed-rates
 */

import { PrismaClient, SportCategory, UserCategory, RateUnit } from '@prisma/client';

const prisma = new PrismaClient();

const VENUE_SLUG = 'stadion-wibawa-mukti';

type RateSeed = {
  category: UserCategory;
  timeStart: string | null;
  timeEnd: string | null;
  price: number;
  unit: RateUnit;
};

type FieldSeed = {
  id: string;
  name: string;
  sportType: SportCategory;
  type: string;
  floorType: string;
  rates: RateSeed[];
};

/** 08:00-17:00 dan 18:00-20:00 dipakai bersama-sama oleh tiga kategori stadion. */
const P = (category: UserCategory, timeStart: string, timeEnd: string, price: number): RateSeed => ({
  category,
  timeStart,
  timeEnd,
  price,
  unit: RateUnit.PER_PERTANDINGAN,
});

const FLAT = (category: UserCategory, price: number, unit: RateUnit): RateSeed => ({
  category,
  timeStart: null,
  timeEnd: null,
  price,
  unit,
});

const FIELDS: FieldSeed[] = [
  {
    id: 'field-wibawa-basket',
    name: 'Bola Basket Area Wibawa Mukti',
    sportType: SportCategory.BASKET,
    type: 'Outdoor',
    floorType: 'Sintetis',
    rates: [FLAT(UserCategory.PERTANDINGAN, 1_500_000, RateUnit.PER_HARI)],
  },
  {
    id: 'field-wibawa-menembak',
    name: 'Menembak Wibawa Mukti',
    sportType: SportCategory.MENEMBAK,
    type: 'Outdoor',
    floorType: 'Mixer',
    rates: [FLAT(UserCategory.PERTANDINGAN, 3_500_000, RateUnit.PER_HARI)],
  },
  {
    id: 'field-wibawa-stadion-penonton',
    name: 'Lapangan Bola Stadion Wibawa Mukti (Dengan Penonton)',
    sportType: SportCategory.STADION,
    type: 'Outdoor',
    floorType: 'Rumput Alami',
    rates: [
      P(UserCategory.PROFESIONAL, '08:00', '17:00', 80_000_000),
      P(UserCategory.PROFESIONAL, '18:00', '20:00', 88_000_000),
      P(UserCategory.AMATIR, '08:00', '17:00', 55_000_000),
      P(UserCategory.AMATIR, '18:00', '20:00', 60_000_000),
      P(UserCategory.LOKAL, '08:00', '17:00', 55_000_000),
      P(UserCategory.LOKAL, '18:00', '20:00', 55_000_000),
      FLAT(UserCategory.SOSIAL, 50_000_000, RateUnit.PER_PERTANDINGAN),
    ],
  },
  {
    id: 'field-wibawa-stadion-tanpa-penonton',
    name: 'Lapangan Bola Stadion Wibawa Mukti (Tanpa Penonton)',
    sportType: SportCategory.STADION,
    type: 'Outdoor',
    floorType: 'Rumput Alami',
    rates: [
      P(UserCategory.PROFESIONAL, '08:00', '17:00', 60_000_000),
      P(UserCategory.PROFESIONAL, '18:00', '20:00', 66_000_000),
      P(UserCategory.AMATIR, '08:00', '17:00', 55_000_000),
      P(UserCategory.AMATIR, '18:00', '20:00', 60_000_000),
      P(UserCategory.LOKAL, '08:00', '17:00', 45_000_000),
      P(UserCategory.LOKAL, '18:00', '20:00', 50_000_000),
      FLAT(UserCategory.SOSIAL, 40_000_000, RateUnit.PER_PERTANDINGAN),
    ],
  },
];

const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');

async function main() {
  const venue = await prisma.venue.findUnique({ where: { slug: VENUE_SLUG } });
  if (!venue) {
    throw new Error(`Venue dengan slug "${VENUE_SLUG}" tidak ditemukan. Buat venue dulu di /admin/venues.`);
  }
  console.log(`Venue: ${venue.name} (${venue.slug})`);

  for (const f of FIELDS) {
    const prices = f.rates.map((r) => r.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const field = await prisma.venueField.upsert({
      where: { id: f.id },
      update: {
        venueId: venue.id,
        name: f.name,
        sportType: f.sportType,
        type: f.type,
        floorType: f.floorType,
        // priceNonPeak/pricePeak dipertahankan sebagai nilai cadangan untuk
        // alur booking lama yang belum memakai FieldRate.
        priceNonPeak: minPrice,
        pricePeak: maxPrice,
      },
      create: {
        id: f.id,
        venueId: venue.id,
        name: f.name,
        sportType: f.sportType,
        type: f.type,
        floorType: f.floorType,
        priceNonPeak: minPrice,
        pricePeak: maxPrice,
      },
    });
    console.log(`\nLapangan: ${field.name}`);
    console.log(`  cadangan priceNonPeak=${rupiah(minPrice)} pricePeak=${rupiah(maxPrice)}`);

    // Hapus tarif lama milik lapangan ini supaya hasil seed selalu sama persis.
    await prisma.fieldRate.deleteMany({ where: { fieldId: field.id } });

    for (let i = 0; i < f.rates.length; i++) {
      const r = f.rates[i];
      const window = r.timeStart && r.timeEnd ? `${r.timeStart} - ${r.timeEnd} WIB` : 'sepanjang hari';
      await prisma.fieldRate.create({
        data: {
          fieldId: field.id,
          category: r.category,
          label: r.category.charAt(0) + r.category.slice(1).toLowerCase().replace(/_/g, ' '),
          timeStart: r.timeStart,
          timeEnd: r.timeEnd,
          price: r.price,
          unit: r.unit,
          sortOrder: i,
        },
      });
      console.log(`  + ${r.category.padEnd(13)} ${window.padEnd(22)} ${rupiah(r.price).padStart(16)} / ${r.unit}`);
    }
  }

  // Rentang harga venue mengikuti seluruh tarif yang terpasang.
  const allPrices = FIELDS.flatMap((f) => f.rates.map((r) => r.price));
  const venueMin = Math.min(...allPrices);
  const venueMax = Math.max(...allPrices);
  await prisma.venue.update({
    where: { id: venue.id },
    data: { minPrice: venueMin, maxPrice: venueMax },
  });
  console.log(`\nVenue minPrice=${rupiah(venueMin)} maxPrice=${rupiah(venueMax)}`);

  const totalRates = await prisma.fieldRate.count({ where: { field: { venueId: venue.id } } });
  console.log(`\nSelesai. Total ${FIELDS.length} lapangan, ${totalRates} baris tarif.`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
