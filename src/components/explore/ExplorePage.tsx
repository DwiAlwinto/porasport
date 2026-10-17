import React, { useState, useMemo } from 'react';
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
  DollarSign,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

/**
 * Kerangka kartu venue yang tampil selagi data dimuat, supaya halaman tidak
 * sempat menampilkan "Tidak ada venue yang sesuai" sebelum data tiba.
 */
const VenueGridSkeleton: React.FC = () => (
  <div className="space-y-4" aria-busy="true" aria-live="polite">
    <span className="sr-only">Memuat daftar venue...</span>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white sm:flex-row"
      >
        <div className="h-52 w-full shrink-0 bg-slate-100 sm:h-auto sm:w-64" />
        <div className="flex-1 space-y-3 p-5">
          <div className="h-3 w-24 rounded bg-slate-100" />
          <div className="h-5 w-2/3 rounded bg-slate-100" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-4/5 rounded bg-slate-100" />
          <div className="flex gap-1.5 pt-2">
            <div className="h-5 w-16 rounded bg-slate-100" />
            <div className="h-5 w-16 rounded bg-slate-100" />
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

/**
 * Ubah koordinat lat/lng menjadi persentase posisi di dalam kanvas peta.
 *
 * Latitude berkurang ke arah utara, sedangkan koordinat kanvas Y bertambah ke
 * bawah, jadi nilainya dibalik. Bila hanya ada satu venue (rentang nol),
 * pin ditempatkan di tengah kanvas.
 */
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

  // Batasi 4%..96% supaya pin tidak terpotong tepi kanvas
  return { x: Math.min(Math.max(x, 4), 96), y: Math.min(Math.max(y, 4), 96) };
}

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

  const [isMapView, setIsMapView] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
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
  const filteredByCity = searchFilters.city === 'ALL' ? venues : venues.filter(v => v.city === searchFilters.city);
  const availableSportsSet = new Set<string>();
  filteredByCity.forEach(v => v.sportTypes.forEach(s => availableSportsSet.add(s)));
  
  const SPORTS_OPTIONS: { label: string; value: SportCategory }[] = [
    { label: 'Semua Olahraga', value: 'ALL' },
    ...Array.from(availableSportsSet).map(s => ({
      label: SPORT_LABELS[s] || s,
      value: s as SportCategory
    }))
  ];

  const filteredBySport = searchFilters.sport === 'ALL' ? venues : venues.filter(v => v.sportTypes.includes(searchFilters.sport));
  const availableCitiesSet = new Set<string>();
  filteredBySport.forEach(v => availableCitiesSet.add(v.city));

  const CITIES_OPTIONS: { label: string; value: CityLocation }[] = [
    { label: 'Semua Lokasi Kab. Bekasi', value: 'ALL' },
    ...Array.from(availableCitiesSet).map(c => ({
      label: CITY_LABELS[c] || c,
      value: c as CityLocation
    }))
  ];

  // Apply filters
  const filteredVenues = venues.filter((venue) => {
    // Sport
    if (searchFilters.sport !== 'ALL' && !venue.sportTypes.includes(searchFilters.sport)) {
      return false;
    }
    // City
    if (searchFilters.city !== 'ALL' && venue.city !== searchFilters.city) {
      return false;
    }
    // Max price: venue lolos kalau PUNYA satu tarif yang muat anggaran.
    // Jangan pakai venue.minPrice karena satuan tarif campur
    // (per jam / per hari / per pertandingan).
    if (!venueHasRateWithin(venue, searchFilters.maxPrice)) {
      return false;
    }
    // Waktu
    if (!venueHasRateInTimeOfDay(venue, searchFilters.timeOfDay)) {
      return false;
    }
    // Facilities
    if (searchFilters.facilities.length > 0) {
      const hasAllSelected = searchFilters.facilities.every((fac) =>
        (venue.facilities ?? []).includes(fac)
      );
      if (!hasAllSelected) return false;
    }
    return true;
  });

  // Harga terendah yang bisa dipesan di tiap venue, dipakai untuk sort
  // dan supaya kartu menampilkan satuan yang benar.
  const minBookablePrice = (venue: Venue) => {
    const prices = venuePriceEntries(venue).map((e) => e.price).filter((p) => p > 0);
    return prices.length ? Math.min(...prices) : venue.minPrice;
  };

  const maxBookablePrice = (venue: Venue) => {
    const prices = venuePriceEntries(venue).map((e) => e.price).filter((p) => p > 0);
    return prices.length ? Math.max(...prices) : venue.maxPrice;
  };

  /**
   * Satuan tarif termurah, ditulis jujur. Satuan bisa campur dalam satu venue
   * (mis. ada lapangan per jam dan ada stadion per pertandingan), jadi
   * menampilkan "/ jam" untuk semua akan menyesatkan.
   */
  const cheapestUnitLabel = (venue: Venue) => {
    const entries = venuePriceEntries(venue).filter((e) => e.price > 0);
    if (!entries.length) return '';
    const cheapest = Math.min(...entries.map((e) => e.price));
    const units = new Set(
      entries.filter((e) => e.price === cheapest).map((e) => RATE_UNIT_SHORT[e.unit])
    );
    return `per ${Array.from(units).join(' / ')}`;
  };

  // Sort
  const sortedVenues = useMemo(
    () =>
      [...filteredVenues].sort((a, b) => {
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
            // "Paling Populer" memakai flag isPopular yang memang ada di database,
            // lalu reviewCount sebagai pemutus seri.
            if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
            return b.reviewCount - a.reviewCount;
        }
      }),
    [filteredVenues, searchFilters.sortBy]
  );

  // Batas kanvas peta dihitung dari koordinat venue yang sedang tampil, supaya
  // pin mengikuti posisi relatif sebenarnya tanpa perlu library peta.
  const mapBounds = useMemo(() => {
    const lats = sortedVenues.map((v) => v.lat).filter((n) => Number.isFinite(n));
    const lngs = sortedVenues.map((v) => v.lng).filter((n) => Number.isFinite(n));
    if (!lats.length || !lngs.length) return null;

    // Padding supaya pin tidak menempel tepi kanvas
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

  // Batas slider mengikuti data asli, bukan angka hardcode
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
    setSearchFilters((prev) => ({
      ...prev,
      sport: 'ALL',
      city: 'ALL',
      // null = tanpa batas, supaya venue termahal pun tetap tampil
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

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top bar: Result Count & Controls */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
          <div>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
              Eksplorasi Venue &amp; Lapangan
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Menampilkan <span className="font-bold text-emerald-600">{sortedVenues.length}</span> venue sesuai kriteria pencarianmu
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
            {/* Sort Select */}
            <select
              value={searchFilters.sortBy}
              onChange={(e) =>
                setSearchFilters((prev) => ({
                  ...prev,
                  sortBy: e.target.value as typeof searchFilters.sortBy,
                }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm outline-none focus:border-emerald-500"
            >
              <option value="POPULARITY">🔥 Paling Populer</option>
              <option value="NEWEST">🕒 Terbaru</option>
              <option value="RATING_DESC">⭐ Rating Tertinggi</option>
              <option value="PRICE_ASC">💰 Harga Termurah</option>
              <option value="PRICE_DESC">💎 Harga Termahal</option>
            </select>

            {/* Toggle Map View vs Grid View */}
            <button
              onClick={() => setIsMapView(!isMapView)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition ${
                isMapView
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {isMapView ? (
                <>
                  <LayoutGrid className="h-4 w-4" />
                  <span>Tampilkan Daftar List</span>
                </>
              ) : (
                <>
                  <MapIcon className="h-4 w-4 text-emerald-600" />
                  <span>Lihat Peta Interaktif</span>
                </>
              )}
            </button>

            {/* Mobile Filter toggle button */}
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filter ({searchFilters.facilities.length})</span>
            </button>
          </div>
        </div>

        {/* Main Grid: Filter Sidebar + Content */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Filter Pencarian</h2>
              <button
                onClick={resetFilters}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                Reset Semua
              </button>
            </div>

            {/* Cabang Olahraga */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Cabang Olahraga
              </label>
              <select
                value={searchFilters.sport}
                onChange={(e) =>
                  setSearchFilters((prev) => ({ ...prev, sport: e.target.value as SportCategory }))
                }
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-800"
              >
                {SPORTS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Kota / Wilayah */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Lokasi / Kecamatan (Kab. Bekasi)
              </label>
              <select
                value={searchFilters.city}
                onChange={(e) =>
                  setSearchFilters((prev) => ({ ...prev, city: e.target.value as CityLocation }))
                }
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-800"
              >
                {CITIES_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Ketersediaan Waktu */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Ketersediaan Waktu
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['ALL', 'PAGI', 'SIANG', 'MALAM'] as TimeOfDayFilter[]).map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() =>
                      setSearchFilters((prev) => ({
                        ...prev,
                        timeOfDay: time,
                      }))
                    }
                    className={`rounded-lg py-2 text-[11px] font-bold transition ${
                      searchFilters.timeOfDay === time
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {time === 'ALL' ? 'Semua' : time}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {searchFilters.timeOfDay === 'PAGI' && 'Pagi: 06:00 - 11:00 WIB'}
                {searchFilters.timeOfDay === 'SIANG' && 'Siang: 11:00 - 16:00 WIB'}
                {searchFilters.timeOfDay === 'MALAM' && 'Malam (Peak): 16:00 - 23:00 WIB'}
                {searchFilters.timeOfDay === 'ALL' && 'Semua jam operasional (06:00 - 23:00)'}
              </p>
            </div>

            {/* Price Slider */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Anggaran Maksimum
                </label>
                <span className="text-xs font-black text-emerald-600">
                  {searchFilters.maxPrice == null
                    ? 'Tanpa batas'
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
                className="w-full accent-emerald-600"
                aria-label="Batas anggaran maksimum"
              />
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400">
                <span>Rp {priceBounds.min.toLocaleString('id-ID')}</span>
                <span>Rp {priceBounds.max.toLocaleString('id-ID')}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Venue tampil bila punya minimal satu tarif dalam batas ini.
              </p>
            </div>

            {/* Facilities Checklist */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Fasilitas Venue
              </label>
              <div className="space-y-2">
                {VENUE_FACILITIES.map((fac) => {
                  const isChecked = searchFilters.facilities.includes(fac.name);
                  return (
                    <label
                      key={fac.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg p-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <span>{fac.name}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleFacilityFilter(fac.name)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Results Area */}
          <main className="lg:col-span-3">
            {isMapView ? (
              /* INTERACTIVE MAP VIEW */
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-xl">
                {/* Simulated Interactive Map canvas */}
                <div className="relative h-[650px] w-full bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-900">
                  {/* Street map illustration lines */}
                  <div className="pointer-events-none absolute inset-0 opacity-20">
                    <svg className="h-full w-full">
                      <path
                        d="M 100,0 L 100,800 M 350,0 L 350,800 M 600,0 L 600,800 M 0,200 L 900,200 M 0,450 L 900,450"
                        stroke="#10b981"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                  </div>

                  {/* Map Header banner */}
                  <div className="absolute left-4 top-4 z-10 rounded-xl bg-slate-900/90 p-3 text-white backdrop-blur-md ring-1 ring-white/10">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-bold">Peta Lokasi Venue Olahraga</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Klik peniti (pin) untuk melihat harga dan memilih jadwal lapangan.
                    </p>
                  </div>

                  {/* Render pins using real lat/lng coordinates */}
                  {sortedVenues.map((venue) => {
                    const pos = projectToCanvas(venue.lat, venue.lng, mapBounds);
                    const isSelected = selectedPinVenue?.id === venue.id;

                    return (
                      <div
                        key={venue.id}
                        style={{ top: `${pos.y}%`, left: `${pos.x}%` }}
                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                      >
                        <button
                          onClick={() => setSelectedPinVenue(venue)}
                          className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg transition duration-200 ${
                            isSelected
                              ? 'scale-110 bg-emerald-500 text-white ring-4 ring-emerald-500/40'
                              : 'bg-white text-slate-900 hover:scale-105 hover:bg-emerald-50'
                          }`}
                        >
                          <MapPin className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                          <span className="truncate max-w-[110px]">{venue.name.split(' ')[0]}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                            {formatCompactPrice(minBookablePrice(venue))}
                          </span>
                        </button>
                      </div>
                    );
                  })}

                  {/* Selected Pin Popup Card */}
                  {selectedPinVenue && (
                    <div className="absolute bottom-6 left-6 right-6 z-30 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              selectedPinVenue.images && selectedPinVenue.images.length > 0
                                ? selectedPinVenue.images[0]
                                : getFallbackImageForUrl(selectedPinVenue.id, selectedPinVenue.sportTypes?.[0])
                            }
                            alt={selectedPinVenue.name}
                            className="h-16 w-16 rounded-xl object-cover"
                            onError={handleImageError}
                          />
                          <div>
                            <h3 className="text-sm font-black text-slate-900">
                              {selectedPinVenue.name}
                            </h3>
                            <p className="text-xs text-slate-500">{selectedPinVenue.address}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-600">
                                Rp {minBookablePrice(selectedPinVenue).toLocaleString('id-ID')}
                                <span className="font-medium text-slate-500">
                                  {' '}
                                  {cheapestUnitLabel(selectedPinVenue)}
                                </span>
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ⭐ {selectedPinVenue.rating}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedPinVenue(null)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenDetail(selectedPinVenue)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                      >
                        <span>Lihat Kalender &amp; Pesan Lapangan</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* GRID LIST VIEW */
              <div className="space-y-4">
                {venuesError ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-16 text-center">
                    <AlertCircle className="mb-3 h-12 w-12 text-red-300" />
                    <h3 className="text-lg font-bold text-red-800">
                      Gagal memuat daftar venue
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-red-700">
                      {venuesError}
                    </p>
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
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
                    <Search className="mb-3 h-12 w-12 text-slate-300" />
                    <h3 className="text-lg font-bold text-slate-800">Tidak ada venue yang sesuai</h3>
                    <p className="mt-1 max-w-sm text-xs text-slate-500">
                      {venues.length === 0
                        ? 'Belum ada venue yang terdaftar di sistem.'
                        : 'Coba kurangi filter atau perbesar batas anggaran pencarianmu.'}
                    </p>
                    {venues.length > 0 && (
                      <button
                        onClick={resetFilters}
                        className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
                      >
                        Reset Filter Pencarian
                      </button>
                    )}
                  </div>
                ) : (
                  sortedVenues.map((venue) => (
                    <div
                      key={venue.id}
                      onClick={() => handleOpenDetail(venue)}
                      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl sm:flex-row"
                    >
                      {/* Image */}
                      <div className="relative h-52 w-full shrink-0 overflow-hidden bg-slate-100 sm:h-auto sm:w-64">
                        <img
                          src={
                            venue.images && venue.images.length > 0
                              ? venue.images[0]
                              : getFallbackImageForUrl(venue.id, venue.sportTypes?.[0])
                          }
                          alt={venue.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          onError={handleImageError}
                        />
                        <div className="absolute left-3 top-3 flex gap-1">
                          {venue.isPromo && (
                            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow">
                              {venue.promoBadge || 'Promo'}
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-3 right-3 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-amber-400 backdrop-blur-md">
                          ⭐ {venue.rating} ({venue.reviewCount})
                        </div>
                      </div>

                      {/* Info body */}
                      <div className="flex flex-1 flex-col justify-between p-5">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1">
                              {venue.sportTypes.map((st) => (
                                <span
                                  key={st}
                                  className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                                >
                                  {SPORT_LABELS[st] || st}
                                </span>
                              ))}
                            </div>
                          </div>

                          <h3 className="mt-2 text-xl font-black text-slate-900 group-hover:text-emerald-700">
                            {venue.name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                            {venue.description}
                          </p>

                          {/* Facilities list */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {(venue.facilities ?? []).map((fac) => (
                              <span
                                key={fac}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                ✓ {fac}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Bottom bar */}
                        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400">
                              Mulai dari
                            </span>
                            <div className="text-lg font-black text-slate-900">
                              Rp {minBookablePrice(venue).toLocaleString('id-ID')}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500">
                              {cheapestUnitLabel(venue)}
                              {maxBookablePrice(venue) > minBookablePrice(venue)
                                ? ` · s/d Rp ${maxBookablePrice(venue).toLocaleString('id-ID')}`
                                : ''}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(venue);
                            }}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            <span>Pilih Jadwal</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white p-5 lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold">Filter &amp; Urutan</h2>
            <button
              onClick={() => setIsMobileFilterOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {/* Same filter items for mobile */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Urutkan
              </label>
              <select
                value={searchFilters.sortBy}
                onChange={(e) =>
                  setSearchFilters((prev) => ({
                    ...prev,
                    sortBy: e.target.value as typeof searchFilters.sortBy,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold"
              >
                <option value="POPULARITY">Paling Populer</option>
                <option value="NEWEST">Terbaru</option>
                <option value="RATING_DESC">Rating Tertinggi</option>
                <option value="PRICE_ASC">Harga Termurah</option>
                <option value="PRICE_DESC">Harga Termahal</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Cabang Olahraga
              </label>
              <select
                value={searchFilters.sport}
                onChange={(e) =>
                  setSearchFilters((prev) => ({ ...prev, sport: e.target.value as SportCategory }))
                }
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold"
              >
                <option value="ALL">Semua Olahraga</option>
                {SPORTS_OPTIONS.filter((o) => o.value !== 'ALL').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Lokasi / Kecamatan (Kab. Bekasi)
              </label>
              <select
                value={searchFilters.city}
                onChange={(e) =>
                  setSearchFilters((prev) => ({ ...prev, city: e.target.value as CityLocation }))
                }
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold"
              >
                <option value="ALL">Semua Lokasi Kab. Bekasi</option>
                {CITIES_OPTIONS.filter((o) => o.value !== 'ALL').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Anggaran Maksimum:{' '}
                {searchFilters.maxPrice == null
                  ? 'Tanpa batas'
                  : `Rp ${effectiveMaxPrice.toLocaleString('id-ID')}`}
              </label>
              <input
                type="range"
                min={0}
                max={LOG_SLIDER_STEPS}
                step={1}
                value={sliderPosition}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="w-full accent-emerald-600"
                aria-label="Batas anggaran maksimum"
              />
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400">
                <span>Rp {priceBounds.min.toLocaleString('id-ID')}</span>
                <span>Rp {priceBounds.max.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Ketersediaan Waktu
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['ALL', 'PAGI', 'SIANG', 'MALAM'] as TimeOfDayFilter[]).map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() =>
                      setSearchFilters((prev) => ({ ...prev, timeOfDay: time }))
                    }
                    className={`rounded-lg px-2 py-2 text-[10px] font-black uppercase transition ${
                      searchFilters.timeOfDay === time
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {time === 'ALL' ? 'Semua' : time}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Fasilitas Venue
              </label>
              <div className="space-y-1.5">
                {VENUE_FACILITIES.map((fac) => {
                  const isChecked = searchFilters.facilities.includes(fac.name);
                  return (
                    <label
                      key={fac.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg p-1 text-xs text-slate-700"
                    >
                      <span>{fac.name}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleFacilityFilter(fac.name)}
                        className="h-3.5 w-3.5 accent-emerald-600"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <button
              onClick={() => setIsMobileFilterOpen(false)}
              className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white"
            >
              Terapkan Filter ({sortedVenues.length} Venue)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
