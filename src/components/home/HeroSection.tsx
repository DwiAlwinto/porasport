import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TRANSLATIONS } from '../../utils/translations';
import {
  SportCategory,
  CityLocation,
} from '../../types';
import {
  Search,
  MapPin,
  Calendar,
  Trophy,
  Zap,
} from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { handleSearchSubmit, searchFilters, activeLang, venues } = useApp();
  const t = TRANSLATIONS[activeLang];

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
    'PADEL': 'Padel Tennis'
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

  const [selectedSport, setSelectedSport] = useState<SportCategory>(searchFilters.sport);
  const [selectedCity, setSelectedCity] = useState<CityLocation>(searchFilters.city);
  const [selectedDate, setSelectedDate] = useState<string>(
    searchFilters.date || new Date().toISOString().split('T')[0]
  );

  // Dynamic Options derived from Venues Data
  const filteredByCity = selectedCity === 'ALL' ? venues : venues.filter(v => v.city === selectedCity);
  const availableSportsSet = new Set<string>();
  filteredByCity.forEach(v => v.sportTypes.forEach(s => availableSportsSet.add(s)));
  
  const SPORTS_OPTIONS: { label: string; value: SportCategory }[] = [
    { label: t.searchPlaceholderSport, value: 'ALL' },
    ...Array.from(availableSportsSet).map(s => ({
      label: SPORT_LABELS[s] || s,
      value: s as SportCategory
    }))
  ];

  const filteredBySport = selectedSport === 'ALL' ? venues : venues.filter(v => v.sportTypes.includes(selectedSport));
  const availableCitiesSet = new Set<string>();
  filteredBySport.forEach(v => availableCitiesSet.add(v.city));

  const CITIES_OPTIONS: { label: string; value: CityLocation }[] = [
    { label: t.searchPlaceholderLocation, value: 'ALL' },
    ...Array.from(availableCitiesSet).map(c => ({
      label: CITY_LABELS[c] || c,
      value: c as CityLocation
    }))
  ];

  const dateInputRef = useRef<HTMLInputElement>(null);

  const [activeDropdown, setActiveDropdown] = useState<'SPORT' | 'LOCATION' | null>(null);
  const dropdownRef = React.useRef<HTMLFormElement>(null);

  // Handle click outside to close dropdowns
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearchSubmit(selectedSport, selectedCity, selectedDate);
  };

  return (
    <section className="relative flex flex-col justify-center bg-[#05BB75] p-6 shadow-xl sm:p-8 z-20">
      {/* Decorative circle from Bento Grid theme */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-4 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-emerald-400 opacity-20" />
        <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-emerald-300 opacity-15" />
      </div>

      <div className="relative z-30 mx-auto w-full max-w-4xl text-center">
        <h1 className="mb-8 text-2xl font-extrabold leading-snug tracking-tight text-white drop-shadow-sm sm:text-3xl lg:text-4xl whitespace-pre-line">
          {t.heroTitle}
        </h1>

        {/* Bento White Floating Search Form */}
        <form
          ref={dropdownRef}
          onSubmit={onSubmit}
          className="mx-auto flex w-full max-w-[900px] flex-col rounded-3xl bg-white shadow-[0_20px_40px_rgb(0,0,0,0.12)] sm:flex-row sm:items-center sm:rounded-full border border-slate-100 text-left relative"
        >
          {/* Olahraga selector */}
          <div 
            onClick={() => setActiveDropdown(activeDropdown === 'SPORT' ? null : 'SPORT')}
            className="group relative flex flex-1 cursor-pointer flex-col rounded-full px-8 py-4 transition-colors hover:bg-slate-100"
          >
            <label className="mb-0.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 cursor-pointer">
              Olahraga
            </label>
            <div className="flex items-center">
              <Trophy className="mr-2 h-4 w-4 text-[#05BB75]" />
              <span className="text-sm font-bold text-slate-900 select-none">
                {SPORTS_OPTIONS.find(o => o.value === selectedSport)?.label || selectedSport}
              </span>
            </div>
            
            {/* Custom Dropdown Popup */}
            {activeDropdown === 'SPORT' && (
              <div className="absolute left-0 top-full mt-4 w-64 overflow-hidden rounded-2xl bg-white shadow-[0_10px_40px_rgb(0,0,0,0.15)] ring-1 ring-slate-100 z-50">
                {SPORTS_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSport(opt.value);
                      setActiveDropdown(null);
                    }}
                    className={`px-6 py-3.5 text-sm font-medium transition hover:bg-slate-50 cursor-pointer flex items-center ${
                      selectedSport === opt.value ? 'bg-emerald-50 text-[#05BB75] font-bold' : 'text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="absolute right-0 top-1/2 hidden h-8 w-px -translate-y-1/2 bg-slate-200 transition-colors group-hover:bg-transparent sm:block" />
          </div>

          {/* Lokasi selector */}
          <div 
            onClick={() => setActiveDropdown(activeDropdown === 'LOCATION' ? null : 'LOCATION')}
            className="group relative flex flex-1 cursor-pointer flex-col rounded-full px-8 py-4 transition-colors hover:bg-slate-100"
          >
            <label className="mb-0.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 cursor-pointer">
              Lokasi
            </label>
            <div className="flex items-center">
              <MapPin className="mr-2 h-4 w-4 text-[#05BB75]" />
              <span className="text-sm font-bold text-slate-900 select-none">
                {CITIES_OPTIONS.find(o => o.value === selectedCity)?.label || selectedCity}
              </span>
            </div>

            {/* Custom Dropdown Popup */}
            {activeDropdown === 'LOCATION' && (
              <div className="absolute left-0 top-full mt-4 w-64 overflow-hidden rounded-2xl bg-white shadow-[0_10px_40px_rgb(0,0,0,0.15)] ring-1 ring-slate-100 z-50">
                {CITIES_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCity(opt.value);
                      setActiveDropdown(null);
                    }}
                    className={`px-6 py-3.5 text-sm font-medium transition hover:bg-slate-50 cursor-pointer flex items-center ${
                      selectedCity === opt.value ? 'bg-emerald-50 text-[#05BB75] font-bold' : 'text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="absolute right-0 top-1/2 hidden h-8 w-px -translate-y-1/2 bg-slate-200 transition-colors group-hover:bg-transparent sm:block" />
          </div>

          {/* Tanggal selector */}
          <div 
            onClick={() => {
              const input = dateInputRef.current;
              if (input) {
                if (typeof (input as any).showPicker === 'function') {
                  (input as any).showPicker();
                } else {
                  input.focus();
                }
              }
            }}
            className="group flex flex-1 cursor-pointer flex-col rounded-full px-8 py-4 transition-colors hover:bg-slate-100"
          >
            <label className="mb-0.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 cursor-pointer">
              Tanggal
            </label>
            <div className="flex items-center">
              <Calendar className="mr-2 h-4 w-4 text-[#05BB75]" />
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  if ('showPicker' in e.currentTarget) {
                    e.currentTarget.showPicker();
                  }
                }}
                className="w-full cursor-pointer appearance-none bg-transparent text-sm font-bold text-slate-900 focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0"
              />
            </div>
          </div>

          {/* Submit button */}
          <div className="p-2 sm:pl-0">
            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#05BB75] px-8 font-extrabold text-white shadow-md transition-all duration-300 hover:scale-105 hover:bg-[#049a60] hover:shadow-lg active:scale-95 sm:w-auto"
            >
              <Search className="h-5 w-5" />
              <span className="text-sm">{t.searchButton}</span>
            </button>
          </div>
        </form>

      </div>
    </section>
  );
};
