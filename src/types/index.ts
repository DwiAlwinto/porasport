export type SportCategory = 
  | 'ALL'
  | 'MINI_SOCCER'
  | 'SEPAK_BOLA'
  | 'FUTSAL'
  | 'VOLI'
  | 'MENEMBAK'
  | 'TENIS'
  | 'BASKET'
  | 'RENANG'
  | 'SKATEPARK'
  | 'BADMINTON'
  | 'STADION'
  | 'ATLETIK'
  | 'ROLLER_SPORT'
  | 'PADEL'
  | 'SQUASH'
  | 'PANJAT_TEBING';

export type CityLocation =
  | 'ALL'
  | 'Wibawa Mukti'
  | 'Pemda Bekasi'
  | 'Grand Wisata'
  | 'Tambun Selatan'
  | 'Sukatani'
  | 'Cibarusah'
  | 'Tarumajaya'
  | 'Cikarang Barat'
  | 'Cikarang Utara'
  | 'Cikarang Timur'
  | 'Bekasi'
  | 'Cikarang';

/**
 * Satu baris tarif untuk sebuah lapangan.
 *
 * Dipasangkan ke tabel `field_rates` lewat Prisma. `timeStart`/`timeEnd` null
 * berarti tarif berlaku sepanjang hari. Kategori dan satuan mengikuti enum
 * `UserCategory` / `RateUnit` di prisma/schema.prisma.
 */
export interface FieldRate {
  id: string;
  fieldId: string;
  category: 'PERTANDINGAN' | 'PROFESIONAL' | 'AMATIR' | 'LOKAL' | 'SOSIAL';
  label: string;
  timeStart: string | null; // "08:00" atau null = sepanjang hari
  timeEnd: string | null; // "17:00" atau null = sepanjang hari
  price: number;
  unit: 'PER_JAM' | 'PER_2_JAM' | 'PER_3_JAM' | 'PER_4_JAM' | 'PER_HARI' | 'PER_PERTANDINGAN';
  sortOrder: number;
  isActive: boolean;
}

export type TimeOfDayFilter = 'ALL' | 'PAGI' | 'SIANG' | 'MALAM';

export interface VenueFacility {
  id: string;
  name: string;
  iconName: string;
}

export interface FieldSlot {
  id: string; // e.g. "field1-2026-08-03-08:00"
  fieldId: string;
  date: string; // YYYY-MM-DD
  timeStart: string; // "08:00"
  timeEnd: string; // "09:00"
  hour: number; // 8
  price: number;
  isPeakHour: boolean;
  status: 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE';
  bookedByUserId?: string;
  bookingId?: string;
  maxCapacity?: number;
  bookedCapacity?: number;
  remainingCapacity?: number;
}

export interface VenueField {
  id: string;
  venueId: string;
  name: string; // e.g. "Lapangan 1 - Sintetis" or "Court A - Vinyl"
  sportType: SportCategory;
  type: string; // "Indoor" | "Outdoor" | "Semi-Indoor"
  floorType: string; // "Rumput Sintetis" | "Vinyl" | "Kayu Jati" | "Interlock"
  priceNonPeak: number; // cadangan, saat belum ada tarif kategori
  pricePeak: number; // cadangan, saat belum ada tarif kategori
  maxCapacity?: number;
  rates?: FieldRate[];
}

export interface VenueReview {
  id: string;
  venueId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number; // 1 - 5
  comment: string;
  createdAt: string;
  sportType: string;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  sportTypes: SportCategory[];
  city: CityLocation;
  address: string;
  lat: number;
  lng: number;
  description: string;
  openingHours: string; // e.g. "08:00 - 20:00 WIB"
  images: string[];
  createdAt: string;
  rating: number;
  reviewCount: number;
  facilities: string[]; // ['Parkir', 'Toilet', 'Kantin', 'Shower', 'Tribun', 'Loker', 'Mushola']
  fields: VenueField[];
  minPrice: number;
  maxPrice: number;
  isPromo?: boolean;
  promoBadge?: string;
  isPopular?: boolean;
  ownerId: string;
  mapsUrl?: string;
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'MENUNGGU_VALIDASI'
  | 'PAID_SUCCESS'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED';

export type PaymentMethodType =
  | 'QRIS'
  | 'VA_BCA'
  | 'VA_MANDIRI'
  | 'VA_BNI'
  | 'VA_BRI'
  | 'EWALLET_GOPAY'
  | 'EWALLET_OVO'
  | 'EWALLET_DANA'
  | 'EWALLET_SHOPEEPAY';

export interface BookingItem {
  slotId: string;
  fieldId: string;
  fieldName: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  price: number;
  isPeakHour: boolean;
  quantity?: number;
}

export interface Booking {
  id: string; // e.g. "GLR-89234"
  userId: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venueImage: string;
  sportCategory: SportCategory;
  items: BookingItem[];
  totalPrice: number;
  serviceFee: number;
  grandTotal: number;
  status: BookingStatus;
  paymentMethod: PaymentMethodType;
  createdAt: string;
  expiresAt: string; // 15 mins after creation if PENDING
  qrCodeToken: string;
  hasReviewed?: boolean;
  nik?: string;
  npwp?: string;
  senderName?: string;
  senderPhone?: string;
  paymentProofUrl?: string;
  adminNotes?: string;
  ocrExtractedText?: string;
  ocrValidationResult?: {
    amountMatch: boolean;
    dateMatch: boolean;
    keywordMatch: boolean;
    passed: boolean;
    extractedText: string;
    expectedAmount: number;
    expectedKeywords: string[];
  };
  ocrProcessedAt?: string;
  rescheduleStatus?: 'PENDING_CUSTOMER' | 'RESOLVED' | 'REJECTED_REFUND';
  rescheduleReason?: string;
  rescheduleNoticeDate?: string;
  rescheduleOriginalDate?: string;
  rescheduleOriginalTime?: string;
  rescheduleTargetDate?: string;
  rescheduleTargetTime?: string;
  rescheduleCustomerNotes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: 'USER' | 'MITRA_OWNER' | 'ADMIN' | 'SUPERADMIN';
  venueId?: string; // If MITRA_OWNER
}

export interface SearchFilters {
  sport: SportCategory;
  city: CityLocation;
  date: string; // YYYY-MM-DD
  /**
   * Batas anggaran. `null` berarti tanpa batas — dipakai sebagai nilai
   * awal supaya venue termahal pun tetap tampil sebelum user menggeser slider.
   */
  maxPrice: number | null;
  facilities: string[];
  timeOfDay: TimeOfDayFilter;
  sortBy: 'POPULARITY' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC' | 'NEWEST';
}

export interface PaymentProof {
  id: string;
  bookingId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  ocrStatus: 'PENDING' | 'PASSED' | 'FAILED' | 'MANUAL_REVIEW';
  uploadedAt: string;
}
