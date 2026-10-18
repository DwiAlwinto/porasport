import type { SearchFilters, SportCategory, CityLocation, TimeOfDayFilter } from '../types';

/**
 * Sinkronisasi filter pencarian dengan URL query string.
 *
 * Tujuannya: filter tidak hilang saat halaman di-refresh, bisa dibagikan lewat
 * link, dan tombol "back" browser mengembalikan keadaan sebelumnya.
 *
 * Format: ?sport=STADION&city=Wibawa%20Mukti&maxPrice=5000000&when=MALAM
 *         &sort=PRICE_ASC&fac=Parkir%20Luas~Toilet%20%26%20Shower
 *
 * Nilai default TIDAK ditulis ke URL supaya URL tetap pendek dan enak dibaca.
 */

/**
 * Daftar nilai enum yang sah. Filter dari URL divalidasi terhadap daftar ini
 * supaya parameter yang diketik tangan tidak bisa menyuntikkan nilai asing.
 */
const VALID_SPORTS = new Set<string>([
  'ALL',
  'MINI_SOCCER',
  'SEPAK_BOLA',
  'FUTSAL',
  'VOLI',
  'MENEMBAK',
  'TENIS',
  'BASKET',
  'RENANG',
  'SKATEPARK',
  'BADMINTON',
  'STADION',
  'ATLETIK',
  'ROLLER_SPORT',
  'PADEL',
  'SQUASH',
  'PANJAT_TEBING',
]);

const VALID_CITIES = new Set<string>([
  'ALL',
  'Wibawa Mukti',
  'Pemda Bekasi',
  'Grand Wisata',
  'Tambun Selatan',
  'Cibarusah',
  'Sukatani',
  'Tarumajaya',
  'Cikarang Barat',
  'Cikarang Utara',
  'Cikarang Timur',
  'Bekasi',
  'Cikarang',
]);

const VALID_TIME_OF_DAY = new Set<string>(['ALL', 'PAGI', 'SIANG', 'MALAM']);

const VALID_SORT = new Set<string>([
  'POPULARITY',
  'PRICE_ASC',
  'PRICE_DESC',
  'RATING_DESC',
  'NEWEST',
]);

const isValidDateKey = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Ambil filter dari query string, menimpa nilai default yang diberikan.
 * Nilai tidak valid diabaikan, bukan membuat error.
 */
export function parseFiltersFromQuery(
  search: string | URLSearchParams,
  defaults: SearchFilters
): SearchFilters {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const next: SearchFilters = { ...defaults, facilities: [...defaults.facilities] };

  const sport = params.get('sport');
  if (sport && VALID_SPORTS.has(sport)) {
    next.sport = sport as SportCategory;
  }

  const city = params.get('city');
  if (city && VALID_CITIES.has(city)) {
    next.city = city as CityLocation;
  }

  const date = params.get('date');
  if (date && isValidDateKey(date)) {
    next.date = date;
  }

  // maxPrice selalu ditulis eksplisit (termasuk nilai kosong) karena null
  // berarti "tanpa batas" dan itu berbeda dari tidak ada filter sama sekali.
  const maxPrice = params.get('maxPrice');
  if (maxPrice !== null) {
    const n = Number(maxPrice);
    next.maxPrice = maxPrice === '' || !Number.isFinite(n) || n <= 0 ? null : n;
  }

  const when = params.get('when');
  if (when && VALID_TIME_OF_DAY.has(when)) {
    next.timeOfDay = when as TimeOfDayFilter;
  }

  const sort = params.get('sort');
  if (sort && VALID_SORT.has(sort)) {
    next.sortBy = sort as SearchFilters['sortBy'];
  }

  const fac = params.get('fac');
  if (fac) {
    // Dipisah '~' supaya nama fasilitas yang mengandung spasi tetap aman,
    // dan '~' sendiri tidak muncul di nama fasilitas manapun.
    next.facilities = fac
      .split('~')
      .map((f) => f.trim())
      .filter(Boolean);
  }

  return next;
}

/** Ubah filter menjadi query string, hanya menyertakan nilai yang bukan default. */
export function serialiseFiltersToQuery(
  filters: SearchFilters,
  defaults: SearchFilters
): string {
  const params = new URLSearchParams();

  if (filters.sport !== defaults.sport) params.set('sport', filters.sport);
  if (filters.city !== defaults.city) params.set('city', filters.city);
  if (filters.date !== defaults.date) params.set('date', filters.date);
  if (filters.maxPrice !== defaults.maxPrice && filters.maxPrice != null) {
    params.set('maxPrice', String(filters.maxPrice));
  }
  if (filters.timeOfDay !== defaults.timeOfDay) params.set('when', filters.timeOfDay);
  if (filters.sortBy !== defaults.sortBy) params.set('sort', filters.sortBy);
  if (filters.facilities.length) params.set('fac', filters.facilities.join('~'));

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
