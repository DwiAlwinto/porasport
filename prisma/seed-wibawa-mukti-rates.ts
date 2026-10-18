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

  // 3. BUAT/UPDATE VENUE & FIELD: LAPANGAN MENEMBAK PERBAKIN WIBAWA MUKTI
  const menembakField = await prisma.venueField.upsert({
    where: { id: 'field-wibawa-menembak' },
    update: {
      venueId: menembakVenue.id,
      name: 'Lapangan Menembak Perbakin (10m & 25m)',
      sportType: SportCategory.MENEMBAK,
      type: 'Indoor',
      floorType: 'Standar Perbakin 10m & 25m',
      priceNonPeak: 75000,
      pricePeak: 100000,
    },
    create: {
      id: 'field-wibawa-menembak',
      venueId: menembakVenue.id,
      name: 'Lapangan Menembak Perbakin (10m & 25m)',
      sportType: SportCategory.MENEMBAK,
      type: 'Indoor',
      floorType: 'Standar Perbakin 10m & 25m',
      priceNonPeak: 75000,
      pricePeak: 100000,
    },
  });

  // Hapus tarif lama untuk reset bersih
  await prisma.fieldRate.deleteMany({ where: { fieldId: menembakField.id } });

  // 4 TARIF RESMI LAPANGAN MENEMBAK
  const menembakRates = [
    {
      category: UserCategory.SOSIAL,
      label: 'Latihan Individu / Umum / Rekreasi',
      price: 75000,
      unit: RateUnit.PER_JAM,
      sortOrder: 0,
    },
    {
      category: UserCategory.AMATIR,
      label: 'Latihan Klub Amatir / Pelajar',
      price: 150000,
      unit: RateUnit.PER_JAM,
      sortOrder: 1,
    },
    {
      category: UserCategory.PROFESIONAL,
      label: 'Latihan Atlet / Klub Profesional',
      price: 250000,
      unit: RateUnit.PER_JAM,
      sortOrder: 2,
    },
    {
      category: UserCategory.PERTANDINGAN,
      label: 'Pertandingan / Kejuaraan Perbakin',
      price: 2500000,
      unit: RateUnit.PER_HARI,
      sortOrder: 3,
    },
  ];

  for (const r of menembakRates) {
    await prisma.fieldRate.create({
      data: {
        fieldId: menembakField.id,
        category: r.category,
        label: r.label,
        price: r.price,
        unit: r.unit,
        sortOrder: r.sortOrder,
        isActive: true,
      },
    });
  }
  console.log('  -> Lapangan & 4 tarif Lapangan Menembak Perbakin berhasil dibuat');

  // 4. BUAT/UPDATE VENUE & FIELD: PANJAT TEBING WIBAWA MUKTI (FPTI)
  console.log('\n[4/5] Membuat/Update Venue: Panjat Tebing Wibawa Mukti...');
  const panjatVenue = await prisma.venue.upsert({
    where: { slug: 'panjat-tebing-wibawa-mukti' },
    update: {
      name: 'Panjat Tebing Wibawa Mukti',
      city: 'Wibawa Mukti',
      address: 'Kompleks Stadion Wibawa Mukti, Jl. Science Boulevard, Sertajaya, Cikarang Timur, Kab. Bekasi',
      lat: -6.3025,
      lng: 107.1681,
      description: 'Arena Panjat Tebing standar nasional FPTI di Kompleks Stadion Wibawa Mukti. Dilengkapi dinding Lead, Speed World Record, dan Boulder untuk atlet serta latihan umum.',
      openingHours: '08:00 - 20:00 WIB',
      images: [
        'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&auto=format&fit=crop&q=80',
      ],
      facilities: ['Parkir Luas', 'Toilet & Shower', 'Mushola', 'Loker Pakaian'],
      minPrice: 15000,
      maxPrice: 1500000,
    },
    create: {
      name: 'Panjat Tebing Wibawa Mukti',
      slug: 'panjat-tebing-wibawa-mukti',
      ownerId,
      city: 'Wibawa Mukti',
      address: 'Kompleks Stadion Wibawa Mukti, Jl. Science Boulevard, Sertajaya, Cikarang Timur, Kab. Bekasi',
      lat: -6.3025,
      lng: 107.1681,
      description: 'Arena Panjat Tebing standar nasional FPTI di Kompleks Stadion Wibawa Mukti. Dilengkapi dinding Lead, Speed World Record, dan Boulder untuk atlet serta latihan umum.',
      openingHours: '08:00 - 20:00 WIB',
      images: [
        'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&auto=format&fit=crop&q=80',
      ],
      facilities: ['Parkir Luas', 'Toilet & Shower', 'Mushola', 'Loker Pakaian'],
      minPrice: 15000,
      maxPrice: 1500000,
      isPopular: false,
      rating: 5.0,
      reviewCount: 12,
    },
  });

  // Pastikan field panjat tebing memakai sportType PANJAT_TEBING
  const existingPanjatField = await prisma.venueField.findFirst({
    where: { venueId: panjatVenue.id },
  });

  const panjatField = await prisma.venueField.upsert({
    where: { id: existingPanjatField?.id || 'field-wm-panjat-tebing' },
    update: {
      venueId: panjatVenue.id,
      name: 'Arena Panjat Tebing FPTI (Lead, Speed & Boulder)',
      sportType: SportCategory.PANJAT_TEBING,
      type: 'Outdoor',
      floorType: 'Wall Climbing Standar FPTI',
      priceNonPeak: 15000,
      pricePeak: 25000,
    },
    create: {
      id: 'field-wm-panjat-tebing',
      venueId: panjatVenue.id,
      name: 'Arena Panjat Tebing FPTI (Lead, Speed & Boulder)',
      sportType: SportCategory.PANJAT_TEBING,
      type: 'Outdoor',
      floorType: 'Wall Climbing Standar FPTI',
      priceNonPeak: 15000,
      pricePeak: 25000,
    },
  });

  await prisma.fieldRate.deleteMany({ where: { fieldId: panjatField.id } });

  const panjatRates = [
    {
      category: UserCategory.SOSIAL,
      label: 'Latihan Individu / Umum / Perorangan',
      price: 15000,
      unit: RateUnit.PER_JAM,
      sortOrder: 0,
    },
    {
      category: UserCategory.AMATIR,
      label: 'Latihan Klub / Sekolah / Pelajar',
      price: 50000,
      unit: RateUnit.PER_JAM,
      sortOrder: 1,
    },
    {
      category: UserCategory.PROFESIONAL,
      label: 'Latihan Atlet FPTI / Profesional',
      price: 100000,
      unit: RateUnit.PER_JAM,
      sortOrder: 2,
    },
    {
      category: UserCategory.PERTANDINGAN,
      label: 'Kejuaraan / Sirkuit Panjat Tebing',
      price: 1500000,
      unit: RateUnit.PER_HARI,
      sortOrder: 3,
    },
  ];

  for (const r of panjatRates) {
    await prisma.fieldRate.create({
      data: {
        fieldId: panjatField.id,
        category: r.category,
        label: r.label,
        price: r.price,
        unit: r.unit,
        sortOrder: r.sortOrder,
        isActive: true,
      },
    });
  }
  console.log('  -> Lapangan & 4 tarif Panjat Tebing berhasil diperbarui');

  // 5. UPDATE VENUE: STADION UTAMA WIBAWA MUKTI (HANYA STADION/SEPAK BOLA)
  console.log('\n[5/5] Memperbarui Venue: Stadion Utama Wibawa Mukti (Khusus Sepak Bola / Stadion)...');
  await prisma.venue.updateMany({
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
