import React, { useState, useMemo, useEffect } from 'react';
import { handleImageError, getFallbackImageForUrl } from '../../utils/imageUtils';
import { useApp } from '../../context/AppContext';
import {
  Venue,
  SportCategory,
  CityLocation,
  TimeOfDayFilter,
} from '../../types';
import {
  VENUE_FACILITIES,
} from '../../lib/venueConstants';
import {
  venuePriceBounds,
  venueHasRateWithin,
  venueHasRateInTimeOfDay,
  venuePriceEntries,
  logSliderToPrice,
  priceToLogSlider,
  LOG_SLIDER_STEPS,
  RATE_UNIT_SHORT,
} from '../../lib/pricing';
import {
  Search,
  MapPin,
  Map as MapIcon,
  LayoutGrid,
  Star,
  SlidersHorizontal,
  X,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Check,
} from 'lucide-react';

/**
 * Skeleton Grid untuk 3 kolom (Gaya Gelora.id) selagi data dimuat
 */
const VenueGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-live="polite">
    <span className="sr-only">Memuat daftar venue...</span>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse"
      >
        <div className="h-48 sm:h-52 w-full bg-slate-200" />
        <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-5 w-3/4 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-200" />
            <div className="h-4 w-2/5 rounded bg-emerald-100 mt-2" />
          </div>
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="h-6 rounded bg-slate-100" />
              ))}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-center">
            <div className="h-4 w-28 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/** Ringkas untuk pin peta, mis. Rp 1,5 jt atau Rp 88 jt. */
function formatCompactPrice(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `Rp${millions % 1 === 0 ? millions : millions.toFixed(1).replace('.', ',')} jt`;
  }
  if (value >= 1_000) return `Rp${Math.round(value / 1_000)} rb`;
  return `Rp${value}`;
}

type MapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  latSpan: number;
  lngSpan: number;
};

function projectToCanvas(
  lat: number,
  lng: number,
  bounds: MapBounds | null
): { x: number; y: number } {
  if (!bounds) return { x: 50, y: 50 };

  const safeLat = Number.isFinite(lat) ? lat : (bounds.minLat + bounds.maxLat) / 2;
  const safeLng = Number.isFinite(lng) ? lng : (bounds.minLng + bounds.maxLng) / 2;

  const x = bounds.lngSpan > 0 ? ((safeLng - bounds.minLng) / bounds.lngSpan) * 100 : 50;
  const y = bounds.latSpan > 0 ? (1 - (safeLat - bounds.minLat) / bounds.latSpan) * 100 : 50;

  return { x: Math.min(Math.max(x, 4), 96), y: Math.min(Math.max(y, 4), 96) };
}

const ITEMS_PER_PAGE = 9;

export const ExplorePage: React.FC = () => {
  const {
    venues,
    venuesLoading,
    venuesError,
    searchFilters,
    setSearchFilters,
    setSelectedVenue,
    setActiveView,
  } = useApp();

  // State tampilan & pencarian
  const [nameQuery, setNameQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMapView, setIsMapView] = useState(false);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [selectedPinVenue, setSelectedPinVenue] = useState<Venue | null>(null);

  const SPORT_LABELS: Record<string, string> = {
    'MINI_SOCCER': 'Mini Soccer',
    'SEPAK_BOLA': 'Sepak Bola',
    'FUTSAL': 'Lapangan Futsal',
    'VOLI': 'Lapangan Voli',
    'MENEMBAK': 'Lapangan Tembak',
    'TENIS': 'Lapangan Tenis',
    'BASKET': 'Bola Basket',
    'RENANG': 'Kolam Renang',
    'SKATEPARK': 'Skateboard',
    'BADMINTON': 'Bulu Tangkis',
    'STADION': 'Stadion',
    'ATLETIK': 'Trek Lari / Atletik',
    'ROLLER_SPORT': 'Trek Sepatu Roda',
    'PADEL': 'Padel Tennis',
    'SQUASH': 'Lapangan Squash',
    'PANJAT_TEBING': 'Panjat Tebing',
  };

  const CITY_LABELS: Record<string, string> = {
    'Wibawa Mukti': 'Wibawa Mukti (Cikarang Timur)',
    'Pemda Bekasi': 'Pemda Bekasi (Pusat Pemerintahan)',
    'Grand Wisata': 'Grand Wisata (Tambun Sel.)',
    'Tambun Selatan': 'Tambun Selatan (GOR Tambun)',
    'Sukatani': 'Sukatani',
    'Cibarusah': 'Cibarusah',
    'Tarumajaya': 'Tarumajaya',
    'Cikarang Barat': 'Cikarang Barat',
    'Cikarang Utara': 'Cikarang Utara',
    'Cikarang Timur': 'Cikarang Timur',
  };

  // Dynamic Options derived from Venues Data
  const filteredByCity = searchFilters.city === 'ALL' ? venues : venues.filter((v) => v.city === searchFilters.city);
  const availableSportsSet = new Set<string>();
  filteredByCity.forEach((v) => v.sportTypes.forEach((s) => availableSportsSet.add(s)));

  const SPORTS_OPTIONS: { label: string; value: SportCategory }[] = [
    { label: 'Semua Cabang Olahraga', value: 'ALL' },
    ...Array.from(availableSportsSet).map((s) => ({
      label: SPORT_LABELS[s] || s,
      value: s as SportCategory,
    })),
  ];

  const filteredBySport = searchFilters.sport === 'ALL' ? venues : venues.filter((v) => v.sportTypes.includes(searchFilters.sport));
  const availableCitiesSet = new Set<string>();
  filteredBySport.forEach((v) => availableCitiesSet.add(v.city));

  const CITIES_OPTIONS: { label: string; value: CityLocation }[] = [
    { label: 'Semua Lokasi / Kecamatan', value: 'ALL' },
    ...Array.from(availableCitiesSet).map((c) => ({
      label: CITY_LABELS[c] || c,
      value: c as CityLocation,
    })),
  ];

  // Hitung jumlah filter lanjutan yang aktif
  const activeAdvancedFilterCount =
    (searchFilters.maxPrice !== null ? 1 : 0) +
    (searchFilters.timeOfDay !== 'ALL' ? 1 : 0) +
    searchFilters.facilities.length;

  // Filter venue berdasarkan pencarian nama & filter kriteria
  const filteredVenues = useMemo(() => {
    return venues.filter((venue) => {
      // 1. Text Query (Nama Venue / Alamat / Cabor)
      if (nameQuery.trim()) {
        const q = nameQuery.toLowerCase().trim();
        const matchName = venue.name.toLowerCase().includes(q);
        const matchAddress = (venue.address || '').toLowerCase().includes(q);
        const matchCity = (venue.city || '').toLowerCase().includes(q);
        const matchSport = venue.sportTypes.some((st) => (SPORT_LABELS[st] || st).toLowerCase().includes(q));
        if (!matchName && !matchAddress && !matchCity && !matchSport) {
          return false;
        }
      }
      // 2. Cabang Olahraga
      if (searchFilters.sport !== 'ALL' && !venue.sportTypes.includes(searchFilters.sport)) {
        return false;
      }
      // 3. Kota / Wilayah
      if (searchFilters.city !== 'ALL' && venue.city !== searchFilters.city) {
        return false;
      }
      // 4. Batas Anggaran
      if (!venueHasRateWithin(venue, searchFilters.maxPrice)) {
        return false;
      }
      // 5. Ketersediaan Waktu (Pagi/Siang/Malam)
      if (!venueHasRateInTimeOfDay(venue, searchFilters.timeOfDay)) {
        return false;
      }
      // 6. Fasilitas Penunjang
      if (searchFilters.facilities.length > 0) {
        const hasAllSelected = searchFilters.facilities.every((fac) =>
          (venue.facilities ?? []).includes(fac)
        );
        if (!hasAllSelected) return false;
      }
      return true;
    });
  }, [venues, nameQuery, searchFilters]);

  // Harga terendah dan tertinggi
  const minBookablePrice = (venue: Venue) => {
    const prices = venuePriceEntries(venue).map((e) => e.price).filter((p) => p > 0);
    return prices.length ? Math.min(...prices) : venue.minPrice;
  };

  const maxBookablePrice = (venue: Venue) => {
    const prices = venuePriceEntries(venue).map((e) => e.price).filter((p) => p > 0);
    return prices.length ? Math.max(...prices) : venue.maxPrice;
  };

  // Sort Venue
  const sortedVenues = useMemo(() => {
    return [...filteredVenues].sort((a, b) => {
      switch (searchFilters.sortBy) {
        case 'PRICE_ASC':
          return minBookablePrice(a) - minBookablePrice(b);
        case 'PRICE_DESC':
          return maxBookablePrice(b) - maxBookablePrice(a);
        case 'RATING_DESC':
          return b.rating - a.rating;
        case 'NEWEST':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
          return b.reviewCount - a.reviewCount;
      }
    });
  }, [filteredVenues, searchFilters.sortBy]);

  // Reset ke halaman 1 saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [nameQuery, searchFilters.sport, searchFilters.city, searchFilters.date, searchFilters.maxPrice, searchFilters.timeOfDay, searchFilters.facilities]);

  // Paginasi 9 venue per halaman
  const totalPages = Math.max(1, Math.ceil(sortedVenues.length / ITEMS_PER_PAGE));
  const paginatedVenues = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedVenues.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedVenues, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const el = document.getElementById('venue-grid-top');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Batas kanvas peta
  const mapBounds = useMemo(() => {
    const lats = sortedVenues.map((v) => v.lat).filter((n) => Number.isFinite(n));
    const lngs = sortedVenues.map((v) => v.lng).filter((n) => Number.isFinite(n));
    if (!lats.length || !lngs.length) return null;

    const pad = 0.02;
    const minLat = Math.min(...lats) - pad;
    const maxLat = Math.max(...lats) + pad;
    const minLng = Math.min(...lngs) - pad;
    const maxLng = Math.max(...lngs) + pad;

    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
      latSpan: maxLat - minLat,
      lngSpan: maxLng - minLng,
    };
  }, [sortedVenues]);

  // Batas slider harga
  const priceBounds = useMemo(() => venuePriceBounds(venues), [venues]);
  const effectiveMaxPrice = searchFilters.maxPrice ?? priceBounds.max;
  const sliderPosition = priceToLogSlider(effectiveMaxPrice, priceBounds.min, priceBounds.max);

  const handleSliderChange = (position: number) => {
    setSearchFilters((prev) => ({
      ...prev,
      maxPrice: logSliderToPrice(position, priceBounds.min, priceBounds.max),
    }));
  };

  const toggleFacilityFilter = (facilityName: string) => {
    setSearchFilters((prev) => {
      const exists = prev.facilities.includes(facilityName);
      return {
        ...prev,
        facilities: exists
          ? prev.facilities.filter((f) => f !== facilityName)
          : [...prev.facilities, facilityName],
      };
    });
  };

  const resetFilters = () => {
    setNameQuery('');
    setSearchFilters((prev) => ({
      ...prev,
      sport: 'ALL',
      city: 'ALL',
      maxPrice: null,
      facilities: [],
      timeOfDay: 'ALL',
      sortBy: 'POPULARITY',
    }));
  };

  const handleOpenDetail = (venue: Venue) => {
    setSelectedVenue(venue);
    setActiveView('VENUE_DETAIL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Judul dinamis gaya Gelora
  const dynamicSportTitle =
    searchFilters.sport === 'ALL'
      ? 'Semua Olahraga'
      : SPORT_LABELS[searchFilters.sport] || searchFilters.sport;

  const dynamicCityTitle =
    searchFilters.city === 'ALL'
      ? 'Semua Kota'
      : CITY_LABELS[searchFilters.city] || searchFilters.city;

  // Daftar jam slot standar ala Gelora
  const STANDARD_SLOT_HOURS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10">
        {/* 2. DYNAMIC HEADLINE (Gaya Gelora: "Venue Semua Olahraga di Semua Kota") */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black text-slate-900 sm:text-4xl tracking-tight">
            Venue <span className="text-[#05BB75]">{dynamicSportTitle}</span> di{' '}
            <span className="text-[#05BB75]">{dynamicCityTitle}</span>
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Berikut Venue <span className="font-semibold text-slate-700">{dynamicSportTitle}</span> di{' '}
            <span className="font-semibold text-slate-700">{dynamicCityTitle}</span> yang sudah memenuhi standar
            kualitas terbaik Disbudpora untuk memanjakan pengalamanmu bermain.
          </p>
        </div>

        {/* 3. HORIZONTAL SEARCH & FILTER BOX (Gaya Gelora.id Card) */}
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-[0_12px_36px_rgb(0,0,0,0.06)]">
          {/* Row 1: Search Nama Venue */}
          <div className="relative mb-3.5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Ketik Nama Venue..."
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-12 pr-10 py-3.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#05BB75] focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
            {nameQuery && (
              <button
                type="button"
                onClick={() => setNameQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Row 2: 4 Kolom Sejajar (Kota, Olahraga, Tanggal, Tombol Cari) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Pilih Kota */}
            <div className="relative">
              <select
                value={searchFilters.city}
                onChange={(e) =>
                  setSearchFilters((prev) => ({ ...prev, city: e.target.value as CityLocation }))
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-4 pr-8 py-3 text-xs font-bold text-slate-800 outline-none transition focus:border-[#05BB75] focus:bg-white"
              >
                {CITIES_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>

            {/* 2. Pilih Olahraga */}
            <div className="relative">
              <select
                value={searchFilters.sport}
                onChange={(e) =>
                  setSearchFilters((prev) => ({ ...prev, sport: e.target.value as SportCategory }))
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-4 pr-8 py-3 text-xs font-bold text-slate-800 outline-none transition focus:border-[#05BB75] focus:bg-white"
              >
                {SPORTS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>

            {/* 3. Tanggal */}
            <div className="relative">
              <input
                type="date"
                value={searchFilters.date || ''}
                onChange={(e) => setSearchFilters((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-[#05BB75] focus:bg-white cursor-pointer"
              />
            </div>

            {/* 4. Tombol Cari Venue */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('venue-grid-top');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#05BB75] hover:bg-[#049a60] py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition active:scale-95"
            >
              <Search className="h-4 w-4" />
              <span>Cari Venue</span>
            </button>
          </div>
        </div>

        {/* 4. META BAR HASIL PENCARIAN & KONTROL VIEW */}
        <div
          id="venue-grid-top"
          className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
        >
          <div>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Hasil pencarian:{' '}
              <span className="font-extrabold text-slate-900">
                {sortedVenues.length} Venue tersedia
              </span>
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
            {/* Sort Select */}
            <div className="relative">
              <select
                value={searchFilters.sortBy}
                onChange={(e) =>
                  setSearchFilters((prev) => ({
                    ...prev,
                    sortBy: e.target.value as typeof searchFilters.sortBy,
                  }))
                }
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm outline-none focus:border-[#05BB75]"
              >
                <option value="POPULARITY">🔥 Paling Populer</option>
                <option value="NEWEST">🕒 Terbaru</option>
                <option value="RATING_DESC">⭐ Rating Tertinggi</option>
                <option value="PRICE_ASC">💰 Harga Termurah</option>
                <option value="PRICE_DESC">💎 Harga Termahal</option>
              </select>
            </div>

            {/* Tombol Filter Lanjutan */}
            <button
              type="button"
              onClick={() => setIsAdvancedFilterOpen(true)}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold shadow-sm transition ${
                activeAdvancedFilterCount > 0
                  ? 'border-emerald-500 bg-emerald-50 text-[#05BB75]'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filter Lanjutan</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#05BB75] text-[10px] text-white font-bold">
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>

            {/* Toggle Map View vs Grid View */}
            <button
              type="button"
              onClick={() => setIsMapView(!isMapView)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition ${
                isMapView
                  ? 'bg-[#05BB75] text-white'
                  : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {isMapView ? (
                <>
                  <LayoutGrid className="h-4 w-4" />
                  <span>Daftar Grid</span>
                </>
              ) : (
                <>
                  <MapIcon className="h-4 w-4 text-[#05BB75]" />
                  <span>Peta Interaktif</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 5. KONTEN UTAMA: PETA ATAU GRID 3-KOLOM */}
        {isMapView ? (
          /* MAP VIEW */
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">
                  Peta Sebaran Gelanggang &amp; Lapangan Kabupaten Bekasi
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Klik pin untuk melihat rincian venue
              </span>
            </div>

            <div className="relative aspect-[16/9] w-full bg-slate-100 sm:aspect-[21/9]">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              {sortedVenues.map((venue) => {
                const isSelected = selectedPinVenue?.id === venue.id;
                const pos = projectToCanvas(venue.lat, venue.lng, mapBounds);
                const minPrice = minBookablePrice(venue);

                return (
                  <button
                    key={venue.id}
                    onClick={() =>
                      setSelectedPinVenue(isSelected ? null : venue)
                    }
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className={`group absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:z-20 hover:scale-110 ${
                      isSelected ? 'z-30 scale-110' : 'z-10'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold shadow-lg ring-2 transition ${
                        isSelected
                          ? 'bg-[#05BB75] text-white ring-[#05BB75]'
                          : 'bg-white text-slate-800 ring-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      <MapPin
                        className={`h-3.5 w-3.5 ${
                          isSelected ? 'text-white' : 'text-[#05BB75]'
                        }`}
                      />
                      <span>{venue.name.split(' ')[0]}</span>
                      <span className="font-semibold opacity-75">
                        · {formatCompactPrice(minPrice)}
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Popup Detail Venue di Peta */}
              {selectedPinVenue && (
                <div className="absolute bottom-4 left-4 right-4 z-40 mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:bottom-6 sm:left-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        {selectedPinVenue.city}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        {selectedPinVenue.name}
                      </h4>
                    </div>
                    <button
                      onClick={() => setSelectedPinVenue(null)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 text-xs font-bold text-slate-700">
                    Mulai Rp {minBookablePrice(selectedPinVenue).toLocaleString('id-ID')}
                  </div>
                  <button
                    onClick={() => handleOpenDetail(selectedPinVenue)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#05BB75] py-2 text-xs font-bold text-white hover:bg-[#049a60]"
                  >
                    <span>Pilih Jadwal</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 3-COLUMN GRID VIEW (Gaya Gelora.id) */
          <div>
            {venuesError ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-16 text-center">
                <AlertCircle className="mb-3 h-12 w-12 text-red-300" />
                <h3 className="text-lg font-bold text-red-800">Gagal memuat daftar venue</h3>
                <p className="mt-1 max-w-sm text-xs text-red-700">{venuesError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-red-700"
                >
                  Coba Lagi
                </button>
              </div>
            ) : venuesLoading && sortedVenues.length === 0 ? (
              <VenueGridSkeleton />
            ) : sortedVenues.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
                <Search className="mb-3 h-12 w-12 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-800">Tidak ada venue yang sesuai</h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  {venues.length === 0
                    ? 'Belum ada venue yang terdaftar di sistem.'
                    : 'Coba kurangi filter atau hapus kata kunci pencarian.'}
                </p>
                {venues.length > 0 && (
                  <button
                    onClick={resetFilters}
                    className="mt-4 rounded-xl bg-[#05BB75] px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-[#049a60]"
                  >
                    Reset Filter Pencarian
                  </button>
                )}
              </div>
            ) : (
              /* THE 3-COLUMN CARDS CONTAINER */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedVenues.map((venue) => {
                  const minPrice = minBookablePrice(venue);
                  const maxPrice = maxBookablePrice(venue);
                  const primaryField = venue.fields?.[0];
                  const fieldCount = venue.fields?.length || 1;

                  return (
                    <div
                      key={venue.id}
                      onClick={() => handleOpenDetail(venue)}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl cursor-pointer"
                    >
                      {/* 1. Gambar Venue */}
                      <div className="relative h-48 sm:h-52 w-full shrink-0 overflow-hidden bg-slate-100">
                        <img
                          src={
                            venue.images && venue.images.length > 0
                              ? venue.images[0]
                              : getFallbackImageForUrl(venue.id, venue.sportTypes?.[0])
                          }
                          alt={venue.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={handleImageError}
                        />

                        {/* Badges Overlay */}
                        {venue.isPromo && (
                          <div className="absolute left-3 top-3 flex gap-1">
                            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow">
                              {venue.promoBadge || 'Promo'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 2. Informasi Utama Venue */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Nama Venue */}
                          <h3 className="font-black text-slate-900 text-base leading-snug group-hover:text-emerald-700 transition line-clamp-1">
                            {venue.name}
                          </h3>

                          {/* Lokasi & Jumlah Lapangan */}
                          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1 font-medium">
                            <span>{venue.city}</span>
                            <span>•</span>
                            <span className="text-[#05BB75] font-bold">
                              {fieldCount} Lapangan
                            </span>
                          </div>

                          {/* Rentang Harga Hijau Mencolok */}
                          <div className="mt-2 text-sm font-extrabold text-[#05BB75]">
                            Rp {minPrice.toLocaleString('id-ID')}
                            {maxPrice > minPrice
                              ? ` - Rp ${maxPrice.toLocaleString('id-ID')}`
                              : ''}
                          </div>

                          {/* 3. Preview Lapangan & Grid Slot Jam ala Gelora */}
                          {primaryField && (
                            <div className="mt-4 pt-3.5 border-t border-slate-100">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                                  {primaryField.name}
                                </h4>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {SPORT_LABELS[primaryField.sportType] || primaryField.sportType} •{' '}
                                {primaryField.floorType || primaryField.type}
                              </p>

                              {/* Timetable Slot Pills (Gelora Hallmark) */}
                              <div className="mt-2.5 grid grid-cols-5 gap-1.5">
                                {STANDARD_SLOT_HOURS.map((hourStr, idx) => {
                                  // Contoh ketersediaan visual: jam siang/sore aktif
                                  const isAvail = idx % 2 === 0 || idx === 3;
                                  return (
                                    <span
                                      key={hourStr}
                                      className={`text-center py-1 rounded-md text-[10px] font-bold transition ${
                                        isAvail
                                          ? 'border border-slate-200 bg-slate-50/80 text-slate-700 group-hover:border-emerald-300 group-hover:bg-emerald-50/50'
                                          : 'bg-slate-100 text-slate-400 font-normal line-through opacity-60'
                                      }`}
                                    >
                                      {hourStr}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 4. Link Footer: "Lihat Lebih Lengkap" */}
                        <div className="mt-5 pt-3 border-t border-slate-100 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#05BB75] group-hover:underline">
                            {fieldCount > 1
                              ? `Lihat ${fieldCount} Lapangan Lainnya`
                              : 'Lihat Lebih Lengkap'}
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 6. PAGINASI BAWAH (Gaya Gelora: < 1 2 3 >) */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => handlePageChange(page)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-extrabold transition ${
                      currentPage === page
                        ? 'bg-[#05BB75] text-white shadow-md shadow-emerald-500/20'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. MODAL / DRAWER FILTER LANJUTAN */}
      {isAdvancedFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-[#05BB75]" />
                <h3 className="text-base font-black text-slate-900">
                  Filter Lanjutan Pencarian
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedFilterOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Slider Batas Anggaran */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Batas Anggaran Maksimum
                  </label>
                  <span className="text-xs font-black text-[#05BB75]">
                    {searchFilters.maxPrice == null
                      ? 'Tanpa Batas'
                      : `Rp ${effectiveMaxPrice.toLocaleString('id-ID')}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={LOG_SLIDER_STEPS}
                  step={1}
                  value={sliderPosition}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  className="w-full accent-[#05BB75]"
                  aria-label="Batas anggaran maksimum"
                />
                <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400">
                  <span>Rp {priceBounds.min.toLocaleString('id-ID')}</span>
                  <span>Rp {priceBounds.max.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Ketersediaan Waktu (Pagi / Siang / Malam) */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ketersediaan Waktu
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['ALL', 'PAGI', 'SIANG', 'MALAM'] as TimeOfDayFilter[]).map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() =>
                        setSearchFilters((prev) => ({ ...prev, timeOfDay: time }))
                      }
                      className={`rounded-xl py-2.5 text-xs font-bold uppercase transition ${
                        searchFilters.timeOfDay === time
                          ? 'bg-[#05BB75] text-white shadow-sm'
                          : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {time === 'ALL' ? 'Semua' : time}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fasilitas Venue */}
              <div>
                <label className="mb-2.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Fasilitas Penunjang Venue
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VENUE_FACILITIES.map((fac) => {
                    const isChecked = searchFilters.facilities.includes(fac.name);
                    return (
                      <label
                        key={fac.id}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 text-xs font-semibold transition ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{fac.name}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFacilityFilter(fac.name)}
                          className="h-4 w-4 accent-[#05BB75]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filter</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAdvancedFilterOpen(false)}
                className="flex-1 rounded-xl bg-[#05BB75] hover:bg-[#049a60] py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/20"
              >
                Terapkan ({sortedVenues.length} Venue)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
