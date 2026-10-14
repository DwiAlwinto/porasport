import { PrismaClient, SportCategory, UserCategory, RateUnit } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Memulai pemisahan fasilitas Kompleks Wibawa Mukti ---');

  // Ambil ownerId dari venue lama atau admin default
  const existingWibawa = await prisma.venue.findUnique({
    where: { slug: 'stadion-wibawa-mukti' },
    include: { fields: true },
  });

  const ownerId = existingWibawa?.ownerId || 'admin-1';
  console.log('Owner ID:', ownerId);

  // 1. BUAT/UPDATE VENUE: KOLAM RENANG AQUATIC WIBAWA MUKTI
  console.log('\n[1/4] Membuat Venue: Kolam Renang Aquatic Wibawa Mukti...');
  const aquaticVenue = await prisma.venue.upsert({
    where: { slug: 'kolam-aquatic-wibawa-mukti' },
    update: {
      name: 'Kolam Renang Aquatic Wibawa Mukti',
      city: 'Wibawa Mukti',
      address: 'Kompleks Stadion Wibawa Mukti, Jl. Science Boulevard, Sertajaya, Cikarang Timur, Kab. Bekasi',
      lat: -6.3025,
      lng: 107.1681,
      description: 'Pusat akuatik modern bertaraf internasional di Kompleks Stadion Wibawa Mukti Kabupaten Bekasi. Dilengkapi kolam tanding 50m standar Olympic/FINA, kolam latihan, tribun penonton, serta fasilitas pendukung sesuai tarif resmi PERDA.',
      openingHours: '06:00 - 21:00 WIB',
      images: [
        'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&auto=format&fit=crop&q=80',
      ],
      facilities: ['Parkir Luas', 'Toilet & Shower', 'Loker Pakaian', 'Mushola', 'Tribun Penonton', 'Kantin / Cafe'],
      minPrice: 10000,
      maxPrice: 3500000,
      isPopular: true,
      rating: 4.95,
      reviewCount: 142,
    },
    create: {
      name: 'Kolam Renang Aquatic Wibawa Mukti',
      slug: 'kolam-aquatic-wibawa-mukti',
      ownerId,
      city: 'Wibawa Mukti',
      address: 'Kompleks Stadion Wibawa Mukti, Jl. Science Boulevard, Sertajaya, Cikarang Timur, Kab. Bekasi',
      lat: -6.3025,
      lng: 107.1681,
      description: 'Pusat akuatik modern bertaraf internasional di Kompleks Stadion Wibawa Mukti Kabupaten Bekasi. Dilengkapi kolam tanding 50m standar Olympic/FINA, kolam latihan, tribun penonton, serta fasilitas pendukung sesuai tarif resmi PERDA.',
      openingHours: '06:00 - 21:00 WIB',
      images: [
        'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&auto=format&fit=crop&q=80',
      ],
      facilities: ['Parkir Luas', 'Toilet & Shower', 'Loker Pakaian', 'Mushola', 'Tribun Penonton', 'Kantin / Cafe'],
      minPrice: 10000,
      maxPrice: 3500000,
      isPopular: true,
      rating: 4.95,
      reviewCount: 142,
    },
  });

  // Buat Lapangan Kolam Olympic
  const aquaticField = await prisma.venueField.upsert({
    where: { id: 'field-wm-aquatic-olympic' },
    update: {
      venueId: aquaticVenue.id,
      name: 'Kolam Renang Olympic Aquatic Center',
      sportType: SportCategory.RENANG,
      type: 'Outdoor',
      floorType: 'Ubin Keramik Standar FINA / Olympic 50m',
      priceNonPeak: 10000,
      pricePeak: 15000,
    },
    create: {
      id: 'field-wm-aquatic-olympic',
      venueId: aquaticVenue.id,
      name: 'Kolam Renang Olympic Aquatic Center',
      sportType: SportCategory.RENANG,
      type: 'Outdoor',
      floorType: 'Ubin Keramik Standar FINA / Olympic 50m',
      priceNonPeak: 10000,
      pricePeak: 15000,
    },
  });

  // Hapus tarif lama field aquatic untuk reset bersih
  await prisma.fieldRate.deleteMany({ where: { fieldId: aquaticField.id } });

  // 4 TARIF RESMI SESUAI PERDA
  const aquaticRates = [
    {
      category: UserCategory.SOSIAL,
      label: 'Latihan Individu / Umum',
      price: 10000,
      unit: RateUnit.PER_JAM,
      sortOrder: 0,
    },
    {
      category: UserCategory.PROFESIONAL,
      label: 'Latihan Klub / Perusahaan / Organisasi',
      price: 15000,
      unit: RateUnit.PER_JAM,
      sortOrder: 1,
    },
    {
      category: UserCategory.AMATIR,
      label: 'Latihan Sekolah / Perguruan Tinggi / Institusi',
      price: 10000,
      unit: RateUnit.PER_JAM,
      sortOrder: 2,
    },
    {
      category: UserCategory.PERTANDINGAN,
      label: 'Pertandingan / Seleksi / Kompetisi',
      price: 3500000,
      unit: RateUnit.PER_HARI,
      sortOrder: 3,
    },
  ];

  for (const r of aquaticRates) {
    await prisma.fieldRate.create({
      data: {
        fieldId: aquaticField.id,
        category: r.category,
        label: r.label,
        timeStart: null,
        timeEnd: null,
        price: r.price,
        unit: r.unit,
        sortOrder: r.sortOrder,
        isActive: true,
      },
    });
    console.log(`  + Tarif PERDA: ${r.label} -> Rp ${r.price.toLocaleString('id-ID')} (${r.unit})`);
  }

  // 2. BUAT/UPDATE VENUE: LAPANGAN BOLA BASKET WIBAWA MUKTI
  console.log('\n[2/4] Membuat Venue: Lapangan Bola Basket Wibawa Mukti...');
  const basketVenue = await prisma.venue.upsert({
    where: { slug: 'lapangan-basket-wibawa-mukti' },
    update: {
      name: 'Lapangan Bola Basket Wibawa Mukti',
      city: 'Wibawa Mukti',
      address: 'Kompleks Stadion Wibawa Mukti, Jl. Science Boulevard, Sertajaya, Cikarang Timur, Kab. Bekasi',
      lat: -6.3025,
      lng: 107.1681,
      description: 'Hall dan lapangan bola basket Wibawa Mukti dengan lantai sintetis berkualitas, ring hidrolik standar kompetisi, tribun penonton, serta penerangan malam hari.',
      openingHours: '06:00 - 23:00 WIB',
      images: [
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80',
      ],
      facilities: ['Parkir Luas', 'Toilet & Shower', 'Mushola', 'Loker Pakaian', 'Tribun Penonton'],
      minPrice: 100000,
      maxPrice: 1500000,
      isPopular: false,
      rating: 4.88,
      reviewCount: 64,
    },
    create: {
      name: 'Lapangan Bola Basket Wibawa Mukti',
      slug: 'lapangan-basket-wibawa-mukti',
      ownerId,
      city: 'Wibawa Mukti',
      address: 'Kompleks Stadion Wibawa Mukti, Jl. Science Boulevard, Sertajaya, Cikarang Timur, Kab. Bekasi',
      lat: -6.3025,
      lng: 107.1681,
      description: 'Hall dan lapangan bola basket Wibawa Mukti dengan lantai sintetis berkualitas, ring hidrolik standar kompetisi, tribun penonton, serta penerangan malam hari.',
      openingHours: '06:00 - 23:00 WIB',
      images: [
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80',
      ],
      facilities: ['Parkir Luas', 'Toilet & Shower', 'Mushola', 'Loker Pakaian', 'Tribun Penonton'],
      minPrice: 100000,
      maxPrice: 1500000,
      isPopular: false,
      rating: 4.88,
      reviewCount: 64,
    },
  });

  // Pindahkan field-wibawa-basket ke basketVenue
  await prisma.venueField.updateMany({
    where: { id: 'field-wibawa-basket' },
    data: { venueId: basketVenue.id, name: 'Hall Bola Basket Wibawa Mukti' },
  });
  console.log('  -> Pindahkan field-wibawa-basket ke Lapangan Bola Basket Wibawa Mukti');

  // 3. BUAT/UPDATE VENUE: LAPANGAN MENEMBAK PERBAKIN WIBAWA MUKTI
  console.log('\n[3/4] Membuat Venue: Lapangan Menembak Perbakin Wibawa Mukti...');
  const menembakVenue = await prisma.venue.upsert({
    where: { slug: 'lapangan-tembak-wibawa-mukti' },
    update: {
      name: 'Lapangan Menembak Perbakin Wibawa Mukti',
      city: 'Wibawa Mukti',
      address: 'Kompleks Stadion Wibawa Mukti, Jl. Science Boulevard, Sertajaya, Cikarang Timur, Kab. Bekasi',
      lat: -6.3025,
      lng: 107.1681,
      description: 'Arena menembak resmi Perbakin di Kompleks Wibawa Mukti dengan fasilitas jarak 10m & 25m, perlindungan keselamatan terstandar, dan instruktur resmi.',
      openingHours: '08:00 - 17:00 WIB',
      images: [
        'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=800&auto=format&fit=crop&q=80',
      ],
      facilities: ['Parkir Luas', 'Toilet & Shower', 'Mushola', 'Ruang Pengawas'],
      minPrice: 75000,
      maxPrice: 3500000,
      isPopular: false,
      rating: 4.9,
      reviewCount: 38,
    },
    create: {
      name: 'Lapangan Menembak Perbakin Wibawa Mukti',
      slug: 'lapangan-tembak-wibawa-mukti',
      ownerId,
      city: 'Wibawa Mukti',
      address: 'Kompleks Stadion Wibawa Mukti, Jl. Science Boulevard, Sertajaya, Cikarang Timur, Kab. Bekasi',
      lat: -6.3025,
      lng: 107.1681,
      description: 'Arena menembak resmi Perbakin di Kompleks Wibawa Mukti dengan fasilitas jarak 10m & 25m, perlindungan keselamatan terstandar, dan instruktur resmi.',
      openingHours: '08:00 - 17:00 WIB',
      images: [
        'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=800&auto=format&fit=crop&q=80',
      ],
      facilities: ['Parkir Luas', 'Toilet & Shower', 'Mushola', 'Ruang Pengawas'],
      minPrice: 75000,
      maxPrice: 3500000,
      isPopular: false,
      rating: 4.9,
      reviewCount: 38,
    },
  });

  // Pindahkan field-wibawa-menembak ke menembakVenue
  await prisma.venueField.updateMany({
    where: { id: 'field-wibawa-menembak' },
    data: { venueId: menembakVenue.id, name: 'Lapangan Menembak Perbakin' },
  });
  console.log('  -> Pindahkan field-wibawa-menembak ke Lapangan Menembak Perbakin Wibawa Mukti');

  // 4. UPDATE VENUE: STADION UTAMA WIBAWA MUKTI (HANYA STADION/SEPAK BOLA)
  console.log('\n[4/4] Memperbarui Venue: Stadion Utama Wibawa Mukti (Khusus Sepak Bola / Stadion)...');
  await prisma.venue.update({
    where: { slug: 'stadion-wibawa-mukti' },
    data: {
      name: 'Stadion Utama Wibawa Mukti',
      description: 'Stadion kebanggaan masyarakat Kabupaten Bekasi berstandar internasional / FIFA. Dilengkapi rumput alami Zoysia Matrella, lampu stadion standar siaran langsung, ruang ganti pemain berstandar Liga 1, dan tribun kapasitas 30.000 penonton.',
      minPrice: 40000000,
      maxPrice: 88000000,
    },
  });

  console.log('\n=== PEMISAHAN VENUE DAN PENERAPAN TARIF PERDA BERHASIL ===');
}

main()
  .catch((e) => {
    console.error('ERROR:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
