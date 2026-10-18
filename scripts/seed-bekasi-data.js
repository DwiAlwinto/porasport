const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const bekasiVenues = [
  {
    id: "venue-wibawa-mukti",
    name: "Kompleks Stadion & GOR Wibawa Mukti",
    slug: "kompleks-stadion-wibawa-mukti",
    sportTypes: [
      "STADION",
      "ATLETIK",
      "MENEMBAK",
      "TENIS",
      "BASKET",
      "RENANG",
      "SKATEPARK",
      "BADMINTON",
      "MINI_SOCCER",
      "PANJAT_TEBING"
    ],
    city: "Wibawa Mukti",
    address: "Jl. Science Boulevard, Sertajaya, Kec. Cikarang Tim., Kabupaten Bekasi, Jawa Barat",
    lat: -6.3025,
    lng: 107.1681,
    distanceKm: 1.2,
    description: "Pusat olahraga terpadu dan megah kebanggaan Kabupaten Bekasi. Dilengkapi Stadion Utama berstandar FIFA, trek atletik bersertifikasi internasional, lapangan tembak Perbakin, aquatic center kolam renang olympic, arena skateboard, lapangan tenis, basket hall, badminton, serta lapangan latihan mini soccer.",
    openingHours: "06:00 - 23:00 WIB",
    images: [
      "/images/wibawamukti.png",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.96,
    reviewCount: 340,
    facilities: [
      "Parkir Luas",
      "Toilet & Shower",
      "Tribun Penonton",
      "Loker Pakaian",
      "Mushola",
      "Kantin / Cafe",
      "Free Wi-Fi"
    ],
    minPrice: 20000,
    maxPrice: 50000000,
    isPopular: true,
    isPromo: false,
    ownerId: "mitra-1",
    fields: [
      {
        id: "field-wm-stadion",
        name: "Stadion Utama Wibawa Mukti (Standar FIFA)",
        sportType: "STADION",
        type: "Outdoor",
        floorType: "Rumput Alami Zoysia Matrella",
        priceNonPeak: 40000000,
        pricePeak: 50000000
      },
      {
        id: "field-wm-atletik",
        name: "Lintasan Trek Atletik & Lari",
        sportType: "ATLETIK",
        type: "Outdoor",
        floorType: "Tartan Sintetis Standar IAAF",
        priceNonPeak: 25000,
        pricePeak: 35000
      },
      {
        id: "field-wm-menembak",
        name: "Lapangan Tembak Perbakin Wibawa Mukti",
        sportType: "MENEMBAK",
        type: "Indoor",
        floorType: "Standar Perbakin 10m & 25m",
        priceNonPeak: 75000,
        pricePeak: 100000
      },
      {
        id: "field-wm-tenis",
        name: "Lapangan Tenis Outdoor Wibawa Mukti",
        sportType: "TENIS",
        type: "Outdoor",
        floorType: "Hardcourt Plexipave",
        priceNonPeak: 80000,
        pricePeak: 120000
      },
      {
        id: "field-wm-basket",
        name: "Hall Basket Wibawa Mukti",
        sportType: "BASKET",
        type: "Indoor",
        floorType: "Kayu Maple Standar FIBA",
        priceNonPeak: 150000,
        pricePeak: 200000
      },
      {
        id: "field-wm-renang",
        name: "Aquatic Center Kolam Renang Olympic",
        sportType: "RENANG",
        type: "Outdoor",
        floorType: "Ubin Keramik 50m Olympic",
        priceNonPeak: 35000,
        pricePeak: 45000
      },
      {
        id: "field-wm-skatepark",
        name: "Skatepark Wibawa Mukti (Bowl & Street)",
        sportType: "SKATEPARK",
        type: "Outdoor",
        floorType: "Beton Halus / Smooth Concrete",
        priceNonPeak: 20000,
        pricePeak: 30000
      },
      {
        id: "field-wm-badminton",
        name: "GSG Hall Badminton Wibawa Mukti",
        sportType: "BADMINTON",
        type: "Indoor",
        floorType: "Karpet Vinyl Yonex Pro",
        priceNonPeak: 60000,
        pricePeak: 85000
      },
      {
        id: "field-wm-minisoccer",
        name: "Lapangan Latihan Mini Soccer Wibawa Mukti",
        sportType: "MINI_SOCCER",
        type: "Outdoor",
        floorType: "Rumput Sintetis Monofilament 50mm",
        priceNonPeak: 300000,
        pricePeak: 450000
      },
      {
        id: "field-wm-panjat-tebing",
        name: "Arena Panjat Tebing FPTI Wibawa Mukti",
        sportType: "PANJAT_TEBING",
        type: "Outdoor",
        floorType: "Wall Climbing Standar FPTI (Lead, Speed, Boulder)",
        priceNonPeak: 15000,
        pricePeak: 25000
      }
    ],
    pricingTiers: [
      {
        id: "stadion-tier-1",
        categoryLabel: "Sosial (Tanpa Penonton)",
        categoryType: "STADION_SOSIAL",
        priceSiang: 40000000,
        priceMalam: 40000000,
        unit: "PER_PERTANDINGAN",
        description: "Tarif flat Rp40 Juta / pertandingan (Tanpa Penonton)",
        isDefault: true
      },
      {
        id: "stadion-tier-2",
        categoryLabel: "Lokal (Tanpa Penonton)",
        categoryType: "STADION_LOKAL",
        priceSiang: 45000000,
        priceMalam: 50000000,
        unit: "PER_PERTANDINGAN",
        description: "Siang Rp45 Juta | Malam Rp50 Juta (Tanpa Penonton)"
      },
      {
        id: "stadion-tier-3",
        categoryLabel: "Amatir (Tanpa Penonton)",
        categoryType: "STADION_AMATIR",
        priceSiang: 55000000,
        priceMalam: 60000000,
        unit: "PER_PERTANDINGAN",
        description: "Siang Rp55 Juta | Malam Rp60 Juta (Tanpa Penonton)"
      },
      {
        id: "stadion-tier-4",
        categoryLabel: "Profesional (Tanpa Penonton)",
        categoryType: "STADION_PROFESIONAL",
        priceSiang: 60000000,
        priceMalam: 66000000,
        unit: "PER_PERTANDINGAN",
        description: "Siang Rp60 Juta | Malam Rp66 Juta (Tanpa Penonton)"
      }
    ]
  },
  {
    id: "venue-grand-wisata",
    name: "Gelanggang Olahraga Grand Wisata",
    slug: "gelanggang-olahraga-grand-wisata",
    sportTypes: ["BASKET", "FUTSAL", "ROLLER_SPORT", "SEPAK_BOLA"],
    city: "Grand Wisata",
    address: "Kawasan Grand Wisata, Lambangsari, Kec. Tambun Sel., Kabupaten Bekasi, Jawa Barat",
    lat: -6.2825,
    lng: 107.0512,
    distanceKm: 4.5,
    description: "Fasilitas olahraga modern di kawasan premium Grand Wisata Tambun Selatan. Menyediakan lapangan basket standar kompetisi, lapangan futsal interlock, sirkuit khusus trek sepatu roda beraspal mulus, dan lapangan sepak bola rumput asri.",
    openingHours: "06:00 - 23:00 WIB",
    images: [
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.88,
    reviewCount: 195,
    facilities: [
      "Parkir Luas",
      "Toilet & Shower",
      "Kantin / Cafe",
      "Loker Pakaian",
      "Mushola"
    ],
    minPrice: 30000,
    maxPrice: 500000,
    isPopular: true,
    isPromo: true,
    promoBadge: "Favorit Warga",
    ownerId: "mitra-1",
    fields: [
      {
        id: "field-gw-basket",
        name: "Lapangan Basket Grand Wisata",
        sportType: "BASKET",
        type: "Indoor",
        floorType: "Vinyl Hardcourt",
        priceNonPeak: 120000,
        pricePeak: 175000
      },
      {
        id: "field-gw-futsal",
        name: "Futsal Court Grand Wisata",
        sportType: "FUTSAL",
        type: "Indoor",
        floorType: "Interlock Polypropylene",
        priceNonPeak: 130000,
        pricePeak: 180000
      },
      {
        id: "field-gw-rollerskate",
        name: "Sirkuit Trek Sepatu Roda Grand Wisata",
        sportType: "ROLLER_SPORT",
        type: "Outdoor",
        floorType: "Asphalt Smooth Track",
        priceNonPeak: 30000,
        pricePeak: 45000
      },
      {
        id: "field-gw-sepakbola",
        name: "Lapangan Sepak Bola Grand Wisata",
        sportType: "SEPAK_BOLA",
        type: "Outdoor",
        floorType: "Rumput Alami Bermuda",
        priceNonPeak: 350000,
        pricePeak: 500000
      }
    ]
  },
  {
    id: "venue-gor-tambun-selatan",
    name: "GOR Tambun Selatan",
    slug: "gor-tambun-selatan",
    sportTypes: ["VOLI", "BASKET", "TENIS", "BADMINTON"],
    city: "Tambun Selatan",
    address: "Jl. Kebon Kelapa No. 1, Tambun Selatan, Kabupaten Bekasi, Jawa Barat",
    lat: -6.2612,
    lng: 107.0601,
    distanceKm: 3.8,
    description: "Gelanggang Olahraga Tambun Selatan sebagai pusat aktivitas keolahragaan masyarakat dan komunitas. Menyediakan lapangan bola voli indoor, basket, lapangan tenis outdoor, dan lapangan bulu tangkis yang nyaman.",
    openingHours: "06:00 - 23:00 WIB",
    images: [
      "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.82,
    reviewCount: 140,
    facilities: [
      "Parkir Luas",
      "Toilet & Shower",
      "Tribun Penonton",
      "Mushola"
    ],
    minPrice: 50000,
    maxPrice: 150000,
    isPopular: true,
    ownerId: "mitra-2",
    fields: [
      {
        id: "field-ts-voli",
        name: "Lapangan Voli GOR Tambun Selatan",
        sportType: "VOLI",
        type: "Indoor",
        floorType: "Karpet Vinyl Taraflex",
        priceNonPeak: 75000,
        pricePeak: 110000
      },
      {
        id: "field-ts-basket",
        name: "Lapangan Basket GOR Tambun Selatan",
        sportType: "BASKET",
        type: "Indoor",
        floorType: "Hardcourt Semen Halus",
        priceNonPeak: 100000,
        pricePeak: 150000
      },
      {
        id: "field-ts-tenis",
        name: "Lapangan Tenis GOR Tambun Selatan",
        sportType: "TENIS",
        type: "Outdoor",
        floorType: "Hardcourt Plexipave",
        priceNonPeak: 70000,
        pricePeak: 100000
      },
      {
        id: "field-ts-badminton",
        name: "Lapangan Badminton GOR Tambun Selatan",
        sportType: "BADMINTON",
        type: "Indoor",
        floorType: "Karpet Vinyl",
        priceNonPeak: 50000,
        pricePeak: 75000
      }
    ]
  },
  {
    id: "venue-bola-tambun-selatan",
    name: "Stadion Mini & Lapangan Bola Tambun Selatan",
    slug: "lapangan-bola-tambun-selatan",
    sportTypes: ["SEPAK_BOLA"],
    city: "Tambun Selatan",
    address: "Jl. Sultan Hasanudin, Tambun, Kec. Tambun Sel., Kabupaten Bekasi, Jawa Barat",
    lat: -6.257,
    lng: 107.068,
    distanceKm: 4.0,
    description: "Stadion Mini sepak bola Tambun Selatan dengan hamparan rumput hijau alami, tribun penonton teduh, dan penerangan lampu malam untuk sparing tim antar-kecamatan.",
    openingHours: "06:00 - 22:00 WIB",
    images: [
      "https://images.unsplash.com/photo-1529900245534-47fbfb57835a?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.75,
    reviewCount: 88,
    facilities: [
      "Parkir Luas",
      "Toilet & Shower",
      "Tribun Penonton",
      "Mushola"
    ],
    minPrice: 250000,
    maxPrice: 400000,
    isPopular: false,
    ownerId: "mitra-2",
    fields: [
      {
        id: "field-ts-sepakbola",
        name: "Lapangan Sepak Bola Tambun Selatan",
        sportType: "SEPAK_BOLA",
        type: "Outdoor",
        floorType: "Rumput Alami",
        priceNonPeak: 250000,
        pricePeak: 400000
      }
    ]
  },
  {
    id: "venue-sukatani",
    name: "Gelanggang Olahraga & Mini Soccer Sukatani",
    slug: "gelanggang-olahraga-sukatani",
    sportTypes: ["MINI_SOCCER", "FUTSAL"],
    city: "Sukatani",
    address: "Jl. Raya Sukatani No. 45, Sukahurip, Kec. Sukatani, Kabupaten Bekasi, Jawa Barat",
    lat: -6.175,
    lng: 107.172,
    distanceKm: 8.5,
    description: "Pusat mini soccer dan futsal terfavorit di wilayah Sukatani. Menggunakan rumput sintetis berstandar tinggi yang empuk, drainase anti genangan air, dan lampu sorot LED benderang.",
    openingHours: "06:00 - 23:00 WIB",
    images: [
      "https://images.unsplash.com/photo-1529900245534-47fbfb57835a?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.86,
    reviewCount: 112,
    facilities: [
      "Parkir Luas",
      "Toilet & Shower",
      "Kantin / Cafe",
      "Mushola"
    ],
    minPrice: 100000,
    maxPrice: 375000,
    isPopular: true,
    isPromo: true,
    promoBadge: "Promo Pagi",
    ownerId: "mitra-1",
    fields: [
      {
        id: "field-sukatani-minisoccer",
        name: "Lapangan Mini Soccer Sukatani (7v7)",
        sportType: "MINI_SOCCER",
        type: "Outdoor",
        floorType: "Rumput Sintetis Monofilament 50mm",
        priceNonPeak: 250000,
        pricePeak: 375000
      },
      {
        id: "field-sukatani-futsal",
        name: "Lapangan Futsal Sukatani",
        sportType: "FUTSAL",
        type: "Indoor",
        floorType: "Rumput Sintetis",
        priceNonPeak: 100000,
        pricePeak: 140000
      }
    ]
  },
  {
    id: "venue-cibarusah",
    name: "Lapangan Olahraga Cibarusah",
    slug: "lapangan-olahraga-cibarusah",
    sportTypes: ["SEPAK_BOLA", "VOLI"],
    city: "Cibarusah",
    address: "Jl. Raya Cibarusah, Cibarusah Kota, Kec. Cibarusah, Kabupaten Bekasi, Jawa Barat",
    lat: -6.442,
    lng: 107.098,
    distanceKm: 14.2,
    description: "Fasilitas olahraga kecamatan Cibarusah yang menyediakan lapangan sepak bola terbuka berukuran penuh dan lapangan bola voli untuk latihan rutin maupun turnamen warga.",
    openingHours: "06:00 - 22:00 WIB",
    images: [
      "https://images.unsplash.com/photo-1529900245534-47fbfb57835a?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.7,
    reviewCount: 65,
    facilities: [
      "Parkir Luas",
      "Toilet",
      "Mushola"
    ],
    minPrice: 50000,
    maxPrice: 300000,
    isPopular: false,
    ownerId: "mitra-2",
    fields: [
      {
        id: "field-cibarusah-sepakbola",
        name: "Lapangan Sepak Bola Cibarusah",
        sportType: "SEPAK_BOLA",
        type: "Outdoor",
        floorType: "Rumput Alami",
        priceNonPeak: 200000,
        pricePeak: 300000
      },
      {
        id: "field-cibarusah-voli",
        name: "Lapangan Voli Cibarusah",
        sportType: "VOLI",
        type: "Outdoor",
        floorType: "Semen Cat Acrylic",
        priceNonPeak: 50000,
        pricePeak: 75000
      }
    ]
  },
  {
    id: "venue-tarumajaya",
    name: "Stadion Mini & Lapangan Olahraga Tarumajaya",
    slug: "lapangan-olahraga-tarumajaya",
    sportTypes: ["SEPAK_BOLA", "MENEMBAK"],
    city: "Tarumajaya",
    address: "Jl. Raya Tarumajaya, Pantai Makmur, Kec. Tarumajaya, Kabupaten Bekasi, Jawa Barat",
    lat: -6.134,
    lng: 106.982,
    distanceKm: 16.0,
    description: "Sarana olahraga di Tarumajaya Bekasi Utara yang dilengkapi lapangan sepak bola stadion mini dan lapangan tembak semi-outdoor untuk latihan akurasi dan olahraga presisi.",
    openingHours: "06:00 - 22:00 WIB",
    images: [
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.78,
    reviewCount: 79,
    facilities: [
      "Parkir Luas",
      "Toilet & Shower",
      "Tribun Penonton",
      "Mushola"
    ],
    minPrice: 60000,
    maxPrice: 320000,
    isPopular: false,
    ownerId: "mitra-2",
    fields: [
      {
        id: "field-tarumajaya-sepakbola",
        name: "Lapangan Sepak Bola Tarumajaya",
        sportType: "SEPAK_BOLA",
        type: "Outdoor",
        floorType: "Rumput Alami",
        priceNonPeak: 200000,
        pricePeak: 320000
      },
      {
        id: "field-tarumajaya-menembak",
        name: "Lapangan Tembak Tarumajaya",
        sportType: "MENEMBAK",
        type: "Semi-Outdoor",
        floorType: "Bantalan Target 15m",
        priceNonPeak: 60000,
        pricePeak: 90000
      }
    ]
  },
  {
    id: "venue-cikarang-barat",
    name: "Lapangan Olahraga Cikarang Barat",
    slug: "lapangan-olahraga-cikarang-barat",
    sportTypes: ["SEPAK_BOLA", "BASKET"],
    city: "Cikarang Barat",
    address: "Jl. Imam Bonjol, Telaga Asih, Kec. Cikarang Barat, Kabupaten Bekasi, Jawa Barat",
    lat: -6.269,
    lng: 107.108,
    distanceKm: 5.2,
    description: "Area olahraga terintegrasi di Cikarang Barat dekat kawasan industri, cocok untuk komunitas pekerja dan warga yang ingin bermain sepak bola atau bola basket setelah jam kerja.",
    openingHours: "06:00 - 23:00 WIB",
    images: [
      "https://images.unsplash.com/photo-1529900245534-47fbfb57835a?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.73,
    reviewCount: 54,
    facilities: [
      "Parkir Luas",
      "Toilet",
      "Mushola"
    ],
    minPrice: 80000,
    maxPrice: 350000,
    isPopular: false,
    ownerId: "mitra-1",
    fields: [
      {
        id: "field-cb-sepakbola",
        name: "Lapangan Sepak Bola Cikarang Barat",
        sportType: "SEPAK_BOLA",
        type: "Outdoor",
        floorType: "Rumput Alami",
        priceNonPeak: 220000,
        pricePeak: 350000
      },
      {
        id: "field-cb-basket",
        name: "Lapangan Basket Cikarang Barat",
        sportType: "BASKET",
        type: "Outdoor",
        floorType: "Hardcourt Acrylic",
        priceNonPeak: 80000,
        pricePeak: 120000
      }
    ]
  },
  {
    id: "venue-cikarang-utara",
    name: "Gelanggang Olahraga & Kolam Renang Cikarang Utara",
    slug: "gelanggang-olahraga-cikarang-utara",
    sportTypes: ["SEPAK_BOLA", "RENANG"],
    city: "Cikarang Utara",
    address: "Jl. Ki Hajar Dewantara, Simpangan, Kec. Cikarang Utara, Kabupaten Bekasi, Jawa Barat",
    lat: -6.248,
    lng: 107.155,
    distanceKm: 3.5,
    description: "Pusat olahraga keluarga dan komunitas di Cikarang Utara. Menyediakan kolam renang air bersih yang terawat dengan baik serta lapangan sepak bola terbuka.",
    openingHours: "06:00 - 22:00 WIB",
    images: [
      "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80"
    ],
    rating: 4.81,
    reviewCount: 92,
    facilities: [
      "Parkir Luas",
      "Toilet & Shower",
      "Kantin / Cafe",
      "Loker Pakaian",
      "Mushola"
    ],
    minPrice: 25000,
    maxPrice: 350000,
    isPopular: true,
    ownerId: "mitra-2",
    fields: [
      {
        id: "field-cu-sepakbola",
        name: "Lapangan Sepak Bola Cikarang Utara",
        sportType: "SEPAK_BOLA",
        type: "Outdoor",
        floorType: "Rumput Alami",
        priceNonPeak: 220000,
        pricePeak: 350000
      },
      {
        id: "field-cu-renang",
        name: "Kolam Renang Cikarang Utara",
        sportType: "RENANG",
        type: "Outdoor",
        floorType: "Kolam Keramik 25m",
        priceNonPeak: 25000,
        pricePeak: 35000
      }
    ]
  }
];

async function main() {
  console.log("Saving venuesSeed.json...");
  fs.writeFileSync(
    path.join(__dirname, '../src/data/venuesSeed.json'),
    JSON.stringify(bekasiVenues, null, 2),
    'utf-8'
  );
  console.log("venuesSeed.json written successfully!");

  console.log("Connecting to PostgreSQL Supabase database...");
  
  // Upsert users mitra-1 & mitra-2
  await prisma.user.upsert({
    where: { id: 'mitra-1' },
    update: {},
    create: {
      id: 'mitra-1',
      name: 'Budi Hartono (Mitra DISBUDPORA)',
      email: 'budi.owner@gelora.id',
      phone: '081199887766',
      role: 'MITRA_OWNER',
    },
  });

  await prisma.user.upsert({
    where: { id: 'mitra-2' },
    update: {},
    create: {
      id: 'mitra-2',
      name: 'Pengelola Fasilitas Kab. Bekasi',
      email: 'pengelola.fasilitas@bekasikab.go.id',
      phone: '081199887755',
      role: 'MITRA_OWNER',
    },
  });

  for (const vData of bekasiVenues) {
    console.log(`Processing venue: ${vData.name} (${vData.city})...`);

    const venue = await prisma.venue.upsert({
      where: { slug: vData.slug },
      update: {
        name: vData.name,
        city: vData.city,
        address: vData.address,
        lat: vData.lat,
        lng: vData.lng,
        description: vData.description,
        openingHours: vData.openingHours,
        images: vData.images,
        facilities: vData.facilities,
        minPrice: vData.minPrice,
        maxPrice: vData.maxPrice,
        isPopular: vData.isPopular,
        isPromo: vData.isPromo,
        promoBadge: vData.promoBadge,
        rating: vData.rating,
        reviewCount: vData.reviewCount,
      },
      create: {
        id: vData.id,
        ownerId: vData.ownerId,
        name: vData.name,
        slug: vData.slug,
        city: vData.city,
        address: vData.address,
        lat: vData.lat,
        lng: vData.lng,
        description: vData.description,
        openingHours: vData.openingHours,
        images: vData.images,
        facilities: vData.facilities,
        minPrice: vData.minPrice,
        maxPrice: vData.maxPrice,
        isPopular: vData.isPopular,
        isPromo: vData.isPromo,
        promoBadge: vData.promoBadge,
        rating: vData.rating,
        reviewCount: vData.reviewCount,
      },
    });

    for (const fData of vData.fields) {
      const field = await prisma.venueField.upsert({
        where: { id: fData.id },
        update: {
          name: fData.name,
          sportType: fData.sportType,
          type: fData.type,
          floorType: fData.floorType,
          priceNonPeak: fData.priceNonPeak,
          pricePeak: fData.pricePeak,
        },
        create: {
          id: fData.id,
          venueId: venue.id,
          name: fData.name,
          sportType: fData.sportType,
          type: fData.type,
          floorType: fData.floorType,
          priceNonPeak: fData.priceNonPeak,
          pricePeak: fData.pricePeak,
        },
      });

      // Generate Field Slots for today + 7 days
      const slotsToCreate = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const slotDate = new Date(today);
        slotDate.setDate(today.getDate() + i);
        const dateStr = slotDate.toISOString().split('T')[0];

        for (let hour = 6; hour < 23; hour++) {
          const isPeak = hour >= 16;
          slotsToCreate.push({
            id: `${field.id}-${dateStr}-${hour}`,
            fieldId: field.id,
            date: slotDate,
            timeStart: `${hour.toString().padStart(2, '0')}:00`,
            timeEnd: `${(hour + 1).toString().padStart(2, '0')}:00`,
            hour: hour,
            price: isPeak ? field.pricePeak : field.priceNonPeak,
            isPeakHour: isPeak,
            status: 'AVAILABLE',
          });
        }
      }

      await prisma.fieldSlot.createMany({
        data: slotsToCreate,
        skipDuplicates: true,
      });
    }
  }

  console.log("ALL 9 VENUES & FIELDS SEEDED IN SUPABASE SUCCESSFULLY!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
