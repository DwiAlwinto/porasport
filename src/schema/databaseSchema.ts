/**
 * STRUKTUR DATABASE (SCHEMA) GELORASPORT / GELORA.ID CLONE
 * Menangani: Venue, User, Field, Booking, Slot, Payment, & Review.
 *
 * Di bawah ini adalah definisi lengkap untuk Prisma ORM dan PostgreSQL DDL SQL
 * yang dapat digunakan untuk produksi backend (Next.js API / Node.js / Supabase).
 */

export const PRISMA_SCHEMA_TEXT = `// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  MITRA_OWNER
  ADMIN
}

enum SportCategory {
  FUTSAL
  BADMINTON
  BASKET
  MINI_SOCCER
  PADEL
  TENIS
}

enum SlotStatus {
  AVAILABLE
  BOOKED
  MAINTENANCE
}

enum BookingStatus {
  PENDING_PAYMENT
  PAID_SUCCESS
  COMPLETED
  CANCELLED
}

model User {
  id            String    @id @default(uuid())
  name          String
  email         String    @unique
  phone         String?   @unique
  passwordHash  String?
  avatarUrl     String?
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relasi
  venuesOwned   Venue[]   @relation("OwnerVenues")
  bookings      Booking[]
  reviews       Review[]

  @@map("users")
}

model Venue {
  id             String          @id @default(uuid())
  ownerId        String
  name           String
  slug           String          @unique
  city           String
  address        String
  lat            Float?
  lng            Float?
  description    String?
  openingHours   String          @default("06:00 - 23:00 WIB")
  images         String[]        @default([])
  facilities     String[]        @default([])
  minPrice       Int
  maxPrice       Int
  isPopular      Boolean         @default(false)
  isPromo        Boolean         @default(false)
  promoBadge     String?
  rating         Float           @default(5.0)
  reviewCount    Int             @default(0)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  // Relasi
  owner          User            @relation("OwnerVenues", fields: [ownerId], references: [id], onDelete: Cascade)
  fields         VenueField[]
  bookings       Booking[]
  reviews        Review[]

  @@index([city])
  @@map("venues")
}

model VenueField {
  id             String        @id @default(uuid())
  venueId        String
  name           String
  sportType      SportCategory
  type           String        @default("Indoor")
  floorType      String        @default("Sintetis")
  priceNonPeak   Int           // Harga pagi-siang (06:00 - 16:00)
  pricePeak      Int           // Harga malam/weekend (16:00 - 23:00)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  // Relasi
  venue          Venue         @relation(fields: [venueId], references: [id], onDelete: Cascade)
  slots          FieldSlot[]
  bookingItems   BookingItem[]

  @@map("venue_fields")
}

model FieldSlot {
  id             String      @id @default(uuid())
  fieldId        String
  date           DateTime    @db.Date
  timeStart      String      // format HH:mm (contoh: "08:00")
  timeEnd        String      // format HH:mm (contoh: "09:00")
  hour           Int         // 0 - 23
  price          Int
  isPeakHour     Boolean     @default(false)
  status         SlotStatus  @default(AVAILABLE)
  bookedByUserId String?
  bookingId      String?
  updatedAt      DateTime    @updatedAt

  // Relasi
  field          VenueField  @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  booking        Booking?    @relation(fields: [bookingId], references: [id], onDelete: SetNull)

  @@unique([fieldId, date, hour])
  @@index([date, status])
  @@map("field_slots")
}

model Booking {
  id               String        @id @default(uuid()) // Contoh: "GLR-20260803-1001"
  userId           String
  venueId          String
  sportCategory    SportCategory
  totalPrice       Int
  serviceFee       Int           @default(5000)
  grandTotal       Int
  status           BookingStatus @default(PENDING_PAYMENT)
  paymentMethod    String        // "QRIS" | "VA_BCA" | "EWALLET_GOPAY", dll.
  qrCodeToken      String        @unique
  expiresAt        DateTime      // Waktu kedaluwarsa 15 menit
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  // Relasi
  user             User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  venue            Venue         @relation(fields: [venueId], references: [id], onDelete: Restrict)
  items            BookingItem[]
  bookedSlots      FieldSlot[]
  payment          Payment?

  @@index([userId, status])
  @@map("bookings")
}

model BookingItem {
  id          String     @id @default(uuid())
  bookingId   String
  fieldId     String
  date        DateTime   @db.Date
  timeStart   String
  timeEnd     String
  price       Int
  isPeakHour  Boolean    @default(false)

  // Relasi
  booking     Booking    @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  field       VenueField @relation(fields: [fieldId], references: [id], onDelete: Restrict)

  @@map("booking_items")
}

model Payment {
  id                String    @id @default(uuid())
  bookingId         String    @unique
  amount            Int
  paymentGatewayRef String?   // Kode referensi Midtrans / Xendit
  paymentMethod     String
  status            String    // "PENDING" | "PAID" | "EXPIRED"
  paidAt            DateTime?
  createdAt         DateTime  @default(now())

  // Relasi
  booking           Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@map("payments")
}

model Review {
  id          String   @id @default(uuid())
  venueId     String
  userId      String
  rating      Int
  comment     String
  sportType   String
  createdAt   DateTime @default(now())

  // Relasi
  venue       Venue    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("reviews")
}
`;

export const SQL_SCHEMA_TEXT = `-- PostgreSQL DDL Schema untuk Stadion Wibawa Mukti Sport Bekasi
-- Eksekusi di PostgreSQL 14+ / Supabase / Neon

CREATE TYPE role_enum AS ENUM ('USER', 'MITRA_OWNER', 'ADMIN');
CREATE TYPE sport_category_enum AS ENUM ('FUTSAL', 'BADMINTON', 'BASKET', 'MINI_SOCCER', 'PADEL', 'TENIS');
CREATE TYPE slot_status_enum AS ENUM ('AVAILABLE', 'BOOKED', 'MAINTENANCE');
CREATE TYPE booking_status_enum AS ENUM ('PENDING_PAYMENT', 'PAID_SUCCESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    avatar_url TEXT,
    role role_enum DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    description TEXT,
    opening_hours VARCHAR(100) DEFAULT '06:00 - 23:00 WIB',
    images TEXT[] DEFAULT '{}',
    facilities TEXT[] DEFAULT '{}',
    min_price INTEGER NOT NULL,
    max_price INTEGER NOT NULL,
    is_popular BOOLEAN DEFAULT FALSE,
    is_promo BOOLEAN DEFAULT FALSE,
    promo_badge VARCHAR(100),
    rating NUMERIC(3,2) DEFAULT 5.0,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE venue_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    sport_type sport_category_enum NOT NULL,
    type VARCHAR(50) DEFAULT 'Indoor',
    floor_type VARCHAR(100) DEFAULT 'Sintetis',
    price_non_peak INTEGER NOT NULL,
    price_peak INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    venue_id UUID NOT NULL REFERENCES venues(id),
    sport_category sport_category_enum NOT NULL,
    total_price INTEGER NOT NULL,
    service_fee INTEGER DEFAULT 5000,
    grand_total INTEGER NOT NULL,
    status booking_status_enum DEFAULT 'PENDING_PAYMENT',
    payment_method VARCHAR(50) NOT NULL,
    qr_code_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE field_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES venue_fields(id) ON DELETE CASCADE,
    booking_id VARCHAR(50) REFERENCES bookings(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    time_start VARCHAR(10) NOT NULL,
    time_end VARCHAR(10) NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    price INTEGER NOT NULL,
    is_peak_hour BOOLEAN DEFAULT FALSE,
    status slot_status_enum DEFAULT 'AVAILABLE',
    booked_by_user_id UUID,
    CONSTRAINT unique_field_date_hour UNIQUE (field_id, date, hour)
);

CREATE TABLE booking_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id VARCHAR(50) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES venue_fields(id),
    date DATE NOT NULL,
    time_start VARCHAR(10) NOT NULL,
    time_end VARCHAR(10) NOT NULL,
    price INTEGER NOT NULL,
    is_peak_hour BOOLEAN DEFAULT FALSE
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    sport_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_field_slots_date_status ON field_slots(date, status);
CREATE INDEX idx_bookings_user_status ON bookings(user_id, status);
`;

export const SCHEMA_EXPLANATION = [
  {
    title: "1. Entitas Venue & VenueField (Mitra & Lapangan)",
    desc: "Satu Venue memiliki satu atau lebih VenueField (misal: Lapangan 1 Futsal Sintetis, Lapangan 2 Badminton Vinyl). Setiap lapangan menyimpan tarif terpisah untuk Non-Peak (siang) dan Peak Hour (malam/weekend)."
  },
  {
    title: "2. Entitas FieldSlot (Jadwal Waktu per Jam)",
    desc: "Setiap tanggal aktif membagi waktu menjadi slot 1 jam (06:00 - 23:00). Status slot berupa: AVAILABLE (hijau), BOOKED (terpesan/merah), atau MAINTENANCE (diblokir oleh Mitra)."
  },
  {
    title: "3. Entitas Booking & BookingItem (Pemesanan Multi-Slot)",
    desc: "Satu Booking dapat menampung beberapa BookingItem sekaligus (contoh: pesan 2 jam dari jam 19:00 sampai 21:00). Memiliki expiry timer 15 menit dan qrCodeToken unik untuk scan e-ticket."
  },
  {
    title: "4. Entitas Payment (Midtrans / Xendit Gateway)",
    desc: "Mencatat referensi pembayaran Virtual Account, QRIS, atau e-Wallet dengan callback otomatis untuk mengubah status Booking menjadi PAID_SUCCESS."
  },
  {
    title: "5. Entitas User & Role-based Access",
    desc: "Dukungan multi-role: USER (penyewa lapangan) dan MITRA_OWNER (pemilik venue yang mengelola jadwal dan melihat statistik pendapatan)."
  }
];
