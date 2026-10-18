import React, { useState, useMemo, useEffect } from 'react';
import { handleImageError, getFallbackImageForUrl } from '../../utils/imageUtils';
import { useApp } from '../../context/AppContext';
import {
  Venue,
  VenueField,
  FieldSlot,
  BookingItem,
  FieldRate,
} from '../../types';
import {
  generateDaySlotsForField,
} from '../../lib/slotUtils';
import { getPublicFieldSlots } from '../../actions/venueActions';
import { USER_CATEGORY_LABELS, getUserCategoryLabel, rateCoversHour } from '../../lib/pricing';
import type { UserCategory } from '@prisma/client';
import {
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Share2,
  Heart,
  DollarSign,
  ShieldCheck,
  Zap,
  Info,
  ChevronRight,
  Flame,
  Award,
  MessageCircle,
  Users,
  Sun,
  Moon,
  Sparkles,
  Check,
} from 'lucide-react';

// Helper waktu zona WIB (Asia/Jakarta, UTC+7) untuk mendeteksi slot jam yang sudah lewat
const getWibDateTime = () => {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const y = getPart('year');
    const m = getPart('month');
    const d = getPart('day');
    const hour = parseInt(getPart('hour'), 10) || 0;
    const minute = parseInt(getPart('minute'), 10) || 0;
    return {
      todayKey: `${y}-${m}-${d}`,
      currentHour: hour,
      currentMinute: minute,
    };
  } catch {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return {
      todayKey: `${y}-${m}-${d}`,
      currentHour: now.getHours(),
      currentMinute: now.getMinutes(),
    };
  }
};

const isSlotPast = (slotDate: string, slotHour: number, slotTimeStart?: string): boolean => {
  const { todayKey, currentHour, currentMinute } = getWibDateTime();
  if (slotDate < todayKey) return true;
  if (slotDate > todayKey) return false;

  let startH = slotHour;
  let startM = 0;
  if (slotTimeStart) {
    const [h, m] = slotTimeStart.split(':').map((v) => parseInt(v, 10));
    if (!Number.isNaN(h)) startH = h;
    if (!Number.isNaN(m)) startM = m;
  }
  return currentHour > startH || (currentHour === startH && currentMinute >= startM);
};

const SPORT_LABELS: Record<string, string> = {
  MINI_SOCCER: 'Mini Soccer',
  SEPAK_BOLA: 'Sepak Bola',
  FUTSAL: 'Lapangan Futsal',
  VOLI: 'Lapangan Voli',
  MENEMBAK: 'Lapangan Tembak',
  TENIS: 'Lapangan Tenis',
  BASKET: 'Bola Basket',
  RENANG: 'Kolam Renang',
  SKATEPARK: 'Skateboard',
  BADMINTON: 'Bulu Tangkis',
  STADION: 'Stadion',
  ATLETIK: 'Trek Lari / Atletik',
  ROLLER_SPORT: 'Trek Sepatu Roda',
  PADEL: 'Padel Tennis',
  SQUASH: 'Lapangan Squash',
  PANJAT_TEBING: 'Panjat Tebing',
};

export const VenueDetailPage: React.FC = () => {
  const {
    selectedVenue,
    venuesLoading,
    setActiveView,
    startBookingCheckout,
    isLoggedIn,
    t,
    activeLang,
  } = useApp();

  // Auth gate state — tampil jika user belum login
  const [showLoginGate, setShowLoginGate] = useState(false);

  // CATATAN: Semua hook harus dijalankan tanpa syarat. Karena itu early return
  // untuk venue yang tidak ditemukan diletakkan SESUDAH semua hook di bawah.

  // Active field selection
  const [selectedFieldId, setSelectedFieldId] = useState<string>(
    selectedVenue?.fields[0]?.id || ''
  );

  // Main Image Selection
  const [mainImageIndex, setMainImageIndex] = useState<number>(0);

  useEffect(() => {
    setMainImageIndex(0);
  }, [selectedVenue?.id]);

  // Selected date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Multi-slot selection state: Array of selected FieldSlot objects
  const [selectedSlots, setSelectedSlots] = useState<FieldSlot[]>([]);

  // Kategori grup terpilih berdasarkan label tampilan (mis. "Latihan klub Umum /Perusahaan / Organisasi")
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);

  // ID tarif / jendela waktu spesifik yang dipilih pelanggan (mis. "08:00 - 17:00" atau "Paket Seharian")
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);

  // Kategori pengguna penyewa (Prisma enum)
  const [userCategory, setUserCategory] = useState<UserCategory | null>(null);

  // Jumlah orang / perenang khusus tarif per orang / jam (Kolam Renang Aquatic)
  const [swimmerCount, setSwimmerCount] = useState<number>(1);

  // Active field object
  const activeField = useMemo(() => {
    const fields = selectedVenue?.fields ?? [];
    return fields.find((f) => f.id === selectedFieldId) || fields[0];
  }, [selectedVenue, selectedFieldId]);

  // Kelompokkan tarif berdasarkan label tampilan kategori yang unik
  // Mencegah bug duplikat tombol kategori bila dua tarif punya label sama namun enum Prisma beda
  const categoryGroups = useMemo<
    { label: string; primaryCategory: UserCategory; rates: FieldRate[] }[]
  >(() => {
    const rates = (activeField?.rates ?? []).filter((r) => r.isActive !== false);
    const map = new Map<
      string,
      { label: string; primaryCategory: UserCategory; rates: FieldRate[] }
    >();

    for (const r of rates) {
      const displayLabel =
        r.label?.trim() || getUserCategoryLabel(r.category, activeField?.sportType);
      const existing = map.get(displayLabel);
      if (!existing) {
        map.set(displayLabel, {
          label: displayLabel,
          primaryCategory: r.category,
          rates: [r],
        });
      } else {
        existing.rates.push(r);
      }
    }

    return Array.from(map.values());
  }, [activeField]);

  // Sinkronisasi otomatis grup kategori & tarif saat lapangan dibuka atau berganti
  useEffect(() => {
    if (categoryGroups.length > 0) {
      const currentValid = categoryGroups.some((g) => g.label === selectedCategoryLabel);
      if (!currentValid) {
        const first = categoryGroups[0];
        setSelectedCategoryLabel(first.label);
        setSelectedRateId(first.rates[0]?.id ?? null);
        setUserCategory(first.rates[0]?.category ?? first.primaryCategory);
      }
    } else {
      setSelectedCategoryLabel(null);
      setSelectedRateId(null);
      setUserCategory(null);
    }
  }, [categoryGroups, selectedCategoryLabel]);

  // Grup kategori aktif
  const activeCategoryGroup = useMemo(() => {
    if (!selectedCategoryLabel) return categoryGroups[0] || null;
    return categoryGroups.find((g) => g.label === selectedCategoryLabel) || categoryGroups[0] || null;
  }, [categoryGroups, selectedCategoryLabel]);

  // Tarif / paket aktif yang dipilih pelanggan
  const selectedRate = useMemo(() => {
    if (!selectedRateId) return null;
    return activeField?.rates?.find((r) => r.id === selectedRateId) || null;
  }, [activeField, selectedRateId]);

  // Jadwal asli dari tabel `field_slots`, bukan hasil simulasi tanggal.
  // Saat masih memuat, tampilkan kerangka agar tidak sempat menampilkan slot palsu.
  const [remoteSlots, setRemoteSlots] = useState<FieldSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeField) {
      setRemoteSlots([]);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);

    getPublicFieldSlots({
      fieldId: activeField.id,
      date: selectedDate,
      userCategory,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setRemoteSlots(res.slots);
        } else {
          setSlotsError(res.error || 'Gagal memuat jadwal.');
          setRemoteSlots(null);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSlotsError(
          e instanceof Error ? e.message : 'Gagal memuat jadwal.'
        );
        setRemoteSlots(null);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeField, selectedDate, userCategory]);

  /**
   * Sumber tunggal grid slot.
   *
   * Kalau pemuatan gagal, jatuh ke `generateDaySlotsForField` supaya tampilan
   * tidak kosong — tetapi status AVAILABLE di fallback itu perkiraan, jadi
   * keadaannya ditandai supaya pengguna tahu booking server tetap memverifikasi.
   */
  const daySlots = useMemo(() => {
    if (!activeField) return [];
    if (remoteSlots) return remoteSlots;

    return generateDaySlotsForField(
      activeField.id,
      selectedDate,
      activeField.priceNonPeak,
      activeField.pricePeak,
      [],
      [],
      activeField.rates ?? [],
      userCategory
    );
  }, [activeField, remoteSlots, selectedDate, userCategory]);

  const handleSlotToggle = (slot: FieldSlot) => {
    if (slot.status !== 'AVAILABLE') return;

    const isPool = activeField?.sportType === 'RENANG' && userCategory !== 'PERTANDINGAN';
    const remCap =
      slot.remainingCapacity ??
      Math.max(0, (slot.maxCapacity || 30) - (slot.bookedCapacity || 0));

    if (isPool && remCap <= 0) {
      alert('Slot jam ini sudah terisi penuh (30 orang). Silakan pilih jam lain.');
      return;
    }

    if (isPool && swimmerCount > remCap) {
      alert(
        `Slot jam ${slot.timeStart} hanya tersisa ${remCap} kuota orang, sedangkan Anda memilih ${swimmerCount} orang. Silakan kurangi jumlah orang terlebih dahulu.`
      );
      return;
    }

    const exists = selectedSlots.some((s) => s.id === slot.id);
    if (exists) {
      setSelectedSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } else {
      setSelectedSlots((prev) => [...prev, slot]);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setSelectedSlots([]); // reset selection when date changes
  };

  const handleFieldChange = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setSelectedCategoryLabel(null);
    setSelectedRateId(null);
    setSelectedSlots([]); // reset selection when field changes
  };

  const handleCategoryGroupChange = (group: {
    label: string;
    primaryCategory: UserCategory;
    rates: FieldRate[];
  }) => {
    setSelectedCategoryLabel(group.label);
    const initialRate = group.rates[0] ?? null;
    setSelectedRateId(initialRate?.id ?? null);
    setUserCategory(initialRate?.category ?? group.primaryCategory);
    setSelectedSlots([]);
  };

  const handleRateSelect = (rate: FieldRate) => {
    setSelectedRateId(rate.id);
    setUserCategory(rate.category);
    setSelectedSlots([]);
  };

  const handleSelectAllHourlyWindowSlots = (rate: FieldRate) => {
    if (!rate.timeStart || !rate.timeEnd) return;
    const startHour = parseInt(rate.timeStart.split(':')[0], 10);
    const endHour = parseInt(rate.timeEnd.split(':')[0], 10);
    const matching = daySlots.filter((s) => {
      const inRange = s.hour >= startHour && s.hour < endHour;
      const isPast = isSlotPast(selectedDate, s.hour, s.timeStart);
      return inRange && s.status === 'AVAILABLE' && !isPast;
    });
    setSelectedSlots(matching);
  };

  const handleSelectAllPackageSlots = (rate: FieldRate) => {
    if (!rate.timeStart || !rate.timeEnd) {
      const available = daySlots.filter(
        (s) => s.status === 'AVAILABLE' && !isSlotPast(selectedDate, s.hour, s.timeStart)
      );
      setSelectedSlots(available);
      return;
    }
    const startHour = parseInt(rate.timeStart.split(':')[0], 10);
    const endHour = parseInt(rate.timeEnd.split(':')[0], 10);
    const matching = daySlots.filter((s) => {
      const inRange = s.hour >= startHour && s.hour < endHour;
      const isPast = isSlotPast(selectedDate, s.hour, s.timeStart);
      return inRange && s.status === 'AVAILABLE' && !isPast;
    });
    setSelectedSlots(matching);
  };

  const handleSelectMultiHourBlock = (rate: FieldRate, blockHours: number) => {
    let candidateSlots = daySlots;
    if (rate.timeStart && rate.timeEnd) {
      const startHour = parseInt(rate.timeStart.split(':')[0], 10);
      const endHour = parseInt(rate.timeEnd.split(':')[0], 10);
      candidateSlots = candidateSlots.filter(
        (s) => s.hour >= startHour && s.hour < endHour
      );
    }
    const available = candidateSlots.filter(
      (s) => s.status === 'AVAILABLE' && !isSlotPast(selectedDate, s.hour, s.timeStart)
    );
    setSelectedSlots(available.slice(0, blockHours));
  };

  // Calculate total price of selected slots
  const selectedTotalPrice = useMemo(() => {
    if (!selectedRate || selectedSlots.length === 0) return 0;

    if (selectedRate.unit === 'PER_HARI') {
      return selectedRate.price;
    }
    if (selectedRate.unit === 'PER_2_JAM') {
      return Math.round((selectedSlots.length / 2) * selectedRate.price);
    }
    if (selectedRate.unit === 'PER_3_JAM') {
      return Math.round((selectedSlots.length / 3) * selectedRate.price);
    }
    if (selectedRate.unit === 'PER_4_JAM') {
      return Math.round((selectedSlots.length / 4) * selectedRate.price);
    }

    const base = selectedSlots.reduce((sum, s) => sum + s.price, 0);
    if (activeField?.sportType === 'RENANG' && userCategory !== 'PERTANDINGAN') {
      return base * swimmerCount;
    }
    return base;
  }, [selectedSlots, activeField, userCategory, swimmerCount, selectedRate]);

  const handleProceedToCheckout = () => {
    if (selectedSlots.length === 0 || !activeField || !selectedVenue) return;

    // AUTH GATE: Wajib login sebelum bisa lanjut booking
    if (!isLoggedIn) {
      setShowLoginGate(true);
      return;
    }

    const isDailyPackage =
      selectedRate && selectedRate.unit === 'PER_HARI' && selectedSlots.length > 0;
    const isMultiHourPackage =
      selectedRate &&
      (selectedRate.unit === 'PER_2_JAM' ||
        selectedRate.unit === 'PER_3_JAM' ||
        selectedRate.unit === 'PER_4_JAM') &&
      selectedSlots.length > 0;
    const multiHourDuration =
      selectedRate?.unit === 'PER_2_JAM'
        ? 2
        : selectedRate?.unit === 'PER_3_JAM'
        ? 3
        : selectedRate?.unit === 'PER_4_JAM'
        ? 4
        : 1;

    const isAquaticPerson = activeField.sportType === 'RENANG' && userCategory !== 'PERTANDINGAN';

    const items: BookingItem[] = selectedSlots.map((s) => {
      let itemPrice = s.price;
      if (isDailyPackage || isMultiHourPackage) {
        itemPrice = Math.round(selectedTotalPrice / selectedSlots.length);
      } else if (isAquaticPerson) {
        itemPrice = s.price * swimmerCount;
      }

      return {
        slotId: s.id,
        fieldId: activeField.id,
        fieldName: isDailyPackage
          ? `${activeField.name} (Paket Seharian)`
          : isMultiHourPackage
          ? `${activeField.name} (Paket ${multiHourDuration} Jam)`
          : isAquaticPerson && swimmerCount > 1
          ? `${activeField.name} (${swimmerCount} Orang)`
          : activeField.name,
        date: s.date,
        timeStart: s.timeStart,
        timeEnd: s.timeEnd,
        price: itemPrice,
        isPeakHour: s.isPeakHour,
        quantity: isAquaticPerson ? swimmerCount : 1,
      };
    });

    startBookingCheckout(
      selectedVenue.id,
      activeField.sportType,
      items,
      userCategory,
      selectedRateId
    );
  };


  // Semua hook sudah selesai dipanggil; aman untuk keluar lebih awal di sini.
  if (!selectedVenue) {
    if (venuesLoading) {
      return (
        <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl animate-pulse space-y-6">
            <div className="h-4 w-40 rounded bg-slate-200"></div>
            <div className="h-72 sm:h-96 w-full rounded-3xl bg-slate-200"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-8 w-2/3 rounded-lg bg-slate-200"></div>
                <div className="h-4 w-1/3 rounded bg-slate-200"></div>
                <div className="h-32 w-full rounded-2xl bg-slate-200"></div>
              </div>
              <div className="h-64 rounded-2xl bg-slate-200"></div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="mb-3 h-12 w-12 text-slate-400" />
        <h2 className="text-lg font-bold text-slate-800">Venue Tidak Ditemukan</h2>
        <button
          onClick={() => setActiveView('EXPLORE')}
          className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white"
        >
          Kembali ke Daftar Venue
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Back Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            onClick={() => setActiveView('EXPLORE')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.venueDetail.backToExplore}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: selectedVenue.name,
                    text: selectedVenue.description,
                    url: window.location.href,
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Tautan venue disalin!');
                }
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Bagikan</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {/* Photo Gallery Grid */}
        <div className="grid grid-cols-1 gap-3 overflow-hidden rounded-2xl md:grid-cols-3">
          <div className="relative h-72 w-full md:col-span-2 md:h-96 bg-slate-100">
            <img
              src={
                selectedVenue.images && selectedVenue.images.length > 0
                  ? selectedVenue.images[mainImageIndex] || selectedVenue.images[0]
                  : ''
              }
              alt={selectedVenue.name}
              className="h-full w-full object-cover object-center transition-opacity duration-300"
              onError={handleImageError}
            />
            {selectedVenue.isPromo && (
              <div className="absolute left-4 top-4 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow">
                {selectedVenue.promoBadge || 'Diskon Aktif'}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:grid-rows-2 md:h-96">
            {selectedVenue.images
              .map((img, idx) => ({ img, idx }))
              .filter((item) => item.idx !== mainImageIndex)
              .slice(0, 2)
              .map((item) => (
              <button
                key={item.idx}
                onClick={() => setMainImageIndex(item.idx)}
                className="h-36 overflow-hidden rounded-xl bg-slate-200 md:h-full w-full transition focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:opacity-90 relative group"
              >
                <img
                  src={item.img}
                  alt=""
                  className="h-full w-full object-cover object-center"
                  onError={handleImageError}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Grid: Left Info & Calendar, Right Quick Summary */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* LEFT: Venue Info, Field Selector, & Booking Calendar */}
          <div className="space-y-8 lg:col-span-2">
            {/* Header Title & Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {selectedVenue.sportTypes.map((st) => (
                  <span
                    key={st}
                    className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase text-emerald-800"
                  >
                    {SPORT_LABELS[st] || st}
                  </span>
                ))}
              </div>

              <h1 className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">
                {selectedVenue.name}
              </h1>

              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{selectedVenue.address}</span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {selectedVenue.description}
              </p>

              {/* Facilities Checklist */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t.venueDetail.facilitiesAvailable}
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedVenue.facilities.map((fac) => (
                    <div
                      key={fac}
                      className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{fac}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* FIELD SELECTOR */}
            {selectedVenue.fields.length > 1 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-black text-slate-900">
                  1. {t.venueDetail.selectField}
                </h3>
                <p className="text-xs text-slate-500">
                  Setiap lapangan memiliki jenis lantai dan tarif sewa yang berbeda
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedVenue.fields.map((f) => {
                    const isSelected = f.id === selectedFieldId;
                    return (
                      <button
                        key={f.id}
                        onClick={() => handleFieldChange(f.id)}
                        className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-600'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold uppercase text-emerald-700">
                            {SPORT_LABELS[f.sportType] || f.sportType}
                          </span>
                          {isSelected && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              Terpilih
                            </span>
                          )}
                        </div>
                        <h4 className="mt-1 font-black text-slate-900">{f.name}</h4>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Lantai: {f.floorType} • {f.type}
                        </p>
                        <div className="mt-3 flex items-center justify-between w-full border-t border-slate-200/60 pt-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400">Siang (06-16)</span>
                            <div className="font-bold text-slate-900">
                              Rp {f.priceNonPeak.toLocaleString('id-ID')}/jam
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400">Malam/Peak (16-23)</span>
                            <div className="font-bold text-emerald-700">
                              Rp {f.pricePeak.toLocaleString('id-ID')}/jam
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : activeField ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase px-2.5 py-0.5">
                        {SPORT_LABELS[activeField.sportType] || activeField.sportType}
                      </span>
                      <span className="text-xs text-slate-400">Fasilitas Utama</span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 mt-1">
                      {activeField.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lantai: {activeField.floorType} • Tipe: {activeField.type}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-left sm:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tarif Dasar
                    </span>
                    <div className="text-sm font-extrabold text-emerald-700">
                      Rp {activeField.priceNonPeak.toLocaleString('id-ID')}
                      <span className="text-xs font-normal text-slate-500">
                        {activeField.sportType === 'RENANG' ? ' / orang / jam' : ' / jam'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* SISTEM KALENDER & JADWAL (CORE FEATURE) */}
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-white p-6 shadow-md">
              <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
                    <Calendar className="h-4 w-4" />
                    <span>Core Feature Kalender &amp; Jadwal</span>
                  </div>
                  <h3 className="mt-0.5 text-lg font-black text-slate-900">
                    2. {t.venueDetail.selectDate}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bisa pilih lebih dari 1 jam sekaligus (multi-slot booking)
                  </p>
                </div>

                {/* Date Picker Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    min={getWibDateTime().todayKey}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Pemilih Kategori Pengguna & Pilihan Waktu / Paket */}
              {categoryGroups.length > 0 && (
                <div className="mt-5 rounded-3xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/40 p-4 sm:p-5 shadow-sm">
                  {/* Step 1: Kategori Penyewa */}
                  <div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-[11px] font-black text-white shadow-sm">
                          1
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                            Pilih Kategori Penyewa
                          </h4>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">
                        {categoryGroups.length} Kategori Tersedia
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {categoryGroups.map((group) => {
                        const isSelected = selectedCategoryLabel === group.label;
                        return (
                          <button
                            key={group.label}
                            type="button"
                            onClick={() => handleCategoryGroupChange(group)}
                            className={`group relative flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-500/30 scale-[1.01]'
                                : 'border-emerald-100 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40 shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`text-xs font-extrabold leading-snug line-clamp-2 ${
                                  isSelected ? 'text-white' : 'text-slate-900 group-hover:text-emerald-700'
                                }`}
                              >
                                {group.label}
                              </span>
                              <div
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                                  isSelected
                                    ? 'border-white bg-white text-emerald-600'
                                    : 'border-slate-300 bg-slate-50 text-transparent'
                                }`}
                              >
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                              <span
                                className={`font-semibold ${
                                  isSelected ? 'text-emerald-100' : 'text-slate-500'
                                }`}
                              >
                                {group.rates.length} pilihan tarif &amp; jam
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Pilihan Waktu & Tarif */}
                  {activeCategoryGroup && (
                    <div className="mt-5 border-t border-emerald-100 pt-4">
                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-[11px] font-black text-white shadow-sm">
                            2
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                              Pilih Waktu &amp; Tarif Yang Diinginkan
                            </h4>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Klik untuk memilih jendela waktu sewa
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {activeCategoryGroup.rates.map((rate) => {
                          const isRateSelected = selectedRateId === rate.id;
                          const isDaily = rate.unit === 'PER_HARI';
                          const isMultiHour =
                            rate.unit === 'PER_2_JAM' ||
                            rate.unit === 'PER_3_JAM' ||
                            rate.unit === 'PER_4_JAM';
                          const multiHourCount =
                            rate.unit === 'PER_2_JAM'
                              ? 2
                              : rate.unit === 'PER_3_JAM'
                              ? 3
                              : rate.unit === 'PER_4_JAM'
                              ? 4
                              : 1;
                          const isNight =
                            rate.timeStart && parseInt(rate.timeStart.split(':')[0], 10) >= 18;

                          return (
                            <div
                              key={rate.id}
                              onClick={() => handleRateSelect(rate)}
                              className={`group relative flex flex-col justify-between rounded-2xl border p-3.5 cursor-pointer transition-all duration-200 ${
                                isRateSelected
                                  ? 'border-emerald-600 bg-emerald-50/90 text-slate-900 shadow-md ring-2 ring-emerald-500/40'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-slate-50/80 shadow-xs'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                      isDaily
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : isMultiHour
                                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                        : isNight
                                        ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                    }`}
                                  >
                                    {isDaily ? (
                                      <>
                                        <Sparkles className="h-3 w-3 text-amber-600" />
                                        Paket Seharian
                                      </>
                                    ) : isMultiHour ? (
                                      <>
                                        <Sparkles className="h-3 w-3 text-blue-600" />
                                        Paket {multiHourCount} Jam
                                      </>
                                    ) : isNight ? (
                                      <>
                                        <Moon className="h-3 w-3 text-indigo-600" />
                                        Malam / Prime
                                      </>
                                    ) : (
                                      <>
                                        <Sun className="h-3 w-3 text-emerald-600" />
                                        Pagi - Siang
                                      </>
                                    )}
                                  </span>

                                  <div
                                    className={`flex h-4 w-4 items-center justify-center rounded-full border transition ${
                                      isRateSelected
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-slate-300 bg-white text-transparent'
                                    }`}
                                  >
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                  </div>
                                </div>

                                <div className="mt-2">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    <span>
                                      {rate.timeStart && rate.timeEnd
                                        ? `${rate.timeStart} - ${rate.timeEnd} WIB`
                                        : 'Sepanjang Hari (Bebas)'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-sm font-black text-emerald-700">
                                    Rp {rate.price.toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {activeField?.sportType === 'RENANG' && rate.unit === 'PER_JAM'
                                      ? '/ orang / jam'
                                      : rate.unit === 'PER_2_JAM'
                                      ? '/ 2 jam'
                                      : rate.unit === 'PER_3_JAM'
                                      ? '/ 3 jam'
                                      : rate.unit === 'PER_4_JAM'
                                      ? '/ 4 jam'
                                      : rate.unit === 'PER_HARI'
                                      ? '/ hari (flat)'
                                      : rate.unit === 'PER_PERTANDINGAN'
                                      ? '/ event'
                                      : '/ jam'}
                                  </span>
                                </div>
                              </div>

                              {/* Tombol Aksi Cepat Pilih Paket Seharian */}
                              {isRateSelected && isDaily && rate.category !== 'PERTANDINGAN' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectAllPackageSlots(rate);
                                  }}
                                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:from-amber-600 hover:to-amber-700 transition"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  <span>
                                    Pilih Semua Slot Paket ({rate.timeStart || '08:00'} - {rate.timeEnd || '20:00'})
                                  </span>
                                </button>
                              )}

                              {/* Tombol Aksi Cepat Pilih Paket Multi Jam */}
                              {isRateSelected && isMultiHour && rate.category !== 'PERTANDINGAN' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectMultiHourBlock(rate, multiHourCount);
                                  }}
                                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  <span>
                                    ⚡ Pilih Paket {multiHourCount} Jam
                                  </span>
                                </button>
                              )}

                              {isRateSelected && rate.category === 'PERTANDINGAN' && (
                                <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-amber-100 border border-amber-300 px-3 py-2 text-[11px] font-bold text-amber-900">
                                  <Award className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                  <span>Wajib Koordinasi &amp; Surat Rekomendasi</span>
                                </div>
                              )}

                              {isRateSelected && !isDaily && !isMultiHour && rate.timeStart && rate.timeEnd && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectAllHourlyWindowSlots(rate);
                                  }}
                                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                                >
                                  <Zap className="h-3 w-3" />
                                  <span>Pilih Semua Jam di Rentang Ini</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Info highlight waktu terpilih (hanya untuk kategori reguler) */}
                      {userCategory !== 'PERTANDINGAN' && selectedRate && selectedRate.timeStart && selectedRate.timeEnd && (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-emerald-100/60 px-3.5 py-2 text-xs font-semibold text-emerald-900 border border-emerald-200">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>
                              Waktu aktif: <strong>{selectedRate.timeStart} - {selectedRate.timeEnd} WIB</strong> (Slot pada jam ini ditandai khusus pada jadwal di bawah).
                            </span>
                          </div>
                          {selectedSlots.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedSlots([])}
                              className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline"
                            >
                              Reset Slot
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kontrol Jumlah Pengguna / Perenang untuk Kolam Renang */}
                  {activeField?.sportType === 'RENANG' && userCategory && userCategory !== 'PERTANDINGAN' && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-100/60 p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-emerald-950">
                            Jumlah Pengguna / Perenang
                          </h5>
                          <p className="text-[11px] text-emerald-700">
                            Tarif dihitung per orang per jam
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setSwimmerCount(Math.max(1, swimmerCount - 1))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300 bg-white font-black text-emerald-800 shadow-sm hover:bg-emerald-50 transition"
                        >
                          -
                        </button>
                        <span className="min-w-[4.5rem] text-center text-xs font-black text-emerald-950">
                          {swimmerCount} {t.common.people}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const maxLimit =
                              selectedSlots.length > 0
                                ? Math.min(
                                    ...selectedSlots.map(
                                      (s) =>
                                        s.remainingCapacity ??
                                        Math.max(
                                          0,
                                          (s.maxCapacity || 30) - (s.bookedCapacity || 0)
                                        )
                                    )
                                  )
                                : 30;
                            if (swimmerCount < maxLimit) {
                              setSwimmerCount(swimmerCount + 1);
                            } else {
                              alert(`Batas kuota maksimal untuk slot yang Anda pilih adalah ${maxLimit} orang.`);
                            }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300 bg-white font-black text-emerald-800 shadow-sm hover:bg-emerald-50 transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Banner Rekomendasi & WhatsApp Khusus Kategori Pertandingan / Kompetisi */}
                  {userCategory === 'PERTANDINGAN' && (
                    <div className="mt-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
                          <Award className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-900">
                              Khusus Event / Pertandingan
                            </span>
                          </div>
                          <h4 className="mt-1 text-sm font-black text-slate-900">
                            Pertandingan / Seleksi / Kejuaraan
                            {selectedRate && (
                              <span className="text-emerald-700 font-extrabold ml-1">
                                (Rp {selectedRate.price.toLocaleString('id-ID')} /{' '}
                                {selectedRate.unit === 'PER_HARI' ? 'hari' : 'event'})
                              </span>
                            )}
                          </h4>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                            Kegiatan pertandingan/turnamen memerlukan koordinasi jadwal dan surat rekomendasi resmi DISBUDPORA. Silakan hubungi langsung WhatsApp Admin untuk verifikasi dan penjadwalan.
                          </p>
                          <div className="mt-3">
                            <a
                              href={`https://wa.me/6281234567890?text=${encodeURIComponent(
                                `Halo Admin DISBUDPORA Sport Bekasi,\nSaya ingin mengajukan permohonan sewa venue ${selectedVenue.name} untuk kegiatan Pertandingan / Seleksi / Kompetisi pada tanggal ${selectedDate}.\nMohon info persyaratan surat rekomendasi dan verifikasi jadwal. Terima kasih.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span>Hubungi WhatsApp Admin DISBUDPORA</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {userCategory === 'PERTANDINGAN' ? (
                <div className="mt-6 rounded-2xl border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-6 text-center shadow-xs">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md">
                    <Award className="h-7 w-7" />
                  </div>
                  <h4 className="mt-3 text-base font-black text-slate-900">
                    Jadwal Slot Jam Dinonaktifkan (Khusus Pertandingan)
                  </h4>
                  <p className="mt-1.5 text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Untuk kegiatan <strong>Pertandingan / Seleksi / Kejuaraan resmi</strong>, lapangan disewakan secara penuh (sepanjang hari) dan tidak menggunakan sistem slot jam reguler. Silakan hubungi langsung WhatsApp Admin DISBUDPORA untuk verifikasi surat rekomendasi dan kesiapan lapangan.
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a
                      href={`https://wa.me/6281234567890?text=${encodeURIComponent(
                        `Halo Admin DISBUDPORA Sport Bekasi,\nSaya ingin mengajukan permohonan sewa venue ${selectedVenue.name} untuk kegiatan Pertandingan / Seleksi / Kompetisi pada tanggal ${selectedDate}.\nMohon info persyaratan surat rekomendasi dan verifikasi jadwal. Terima kasih.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-700 transition"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>Hubungi WhatsApp Admin DISBUDPORA</span>
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-emerald-100 border border-emerald-400" />
                      <span className="text-slate-600">Tersedia (Klik pilih)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-emerald-600" />
                      <span className="text-slate-900 font-bold">Terpilih ({selectedSlots.length})</span>
                    </div>
                    {selectedRate?.timeStart && selectedRate?.timeEnd && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded bg-emerald-100 border-2 border-emerald-500 ring-1 ring-emerald-400/50" />
                        <span className="text-emerald-900 font-extrabold">
                          Waktu Pilihan ({selectedRate.timeStart} - {selectedRate.timeEnd})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-slate-100 border border-slate-300" />
                      <span className="text-slate-600">Tersedia Lainnya</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-slate-200" />
                      <span className="text-slate-400">Booked / Penuh</span>
                    </div>
                  </div>

                  {/* Status / Error pemuatan jadwal */}
                  {(slotsLoading || slotsError) && (
                    <div
                      className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-[11px] font-semibold ${
                        slotsError
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {slotsError
                          ? `${slotsError} Jadwal di bawah adalah estimasi; ketersediaan sebenarnya diverifikasi server saat booking.`
                          : 'Memuat jadwal terbaru...'}
                      </span>
                    </div>
                  )}

                  {/* Hourly Grid (06:00 - 23:00) */}
                  <div className="mt-6">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Pagi - Siang (06:00 - 16:00 WIB • Tarif Non-Peak)
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {daySlots
                        .filter((s) => !s.isPeakHour)
                        .map((slot) => {
                          const isSelected = selectedSlots.some((s) => s.id === slot.id);
                          const isPool = activeField?.sportType === 'RENANG';
                          const remCap =
                            slot.remainingCapacity ??
                            Math.max(0, (slot.maxCapacity || 30) - (slot.bookedCapacity || 0));
                          const isPoolFull = isPool && remCap <= 0;
                          const isBooked = slot.status === 'BOOKED' || isPoolFull;
                          const isMaintenance = slot.status === 'MAINTENANCE';
                          const isPast = isSlotPast(selectedDate, slot.hour, slot.timeStart);
                          const isDisabled = isBooked || isMaintenance || isPast;
                          const isInWindow =
                            selectedRate?.timeStart && selectedRate?.timeEnd
                              ? rateCoversHour(
                                  {
                                    timeStart: selectedRate.timeStart,
                                    timeEnd: selectedRate.timeEnd,
                                  },
                                  slot.hour
                                )
                              : false;

                          return (
                            <button
                              key={slot.id}
                              disabled={isDisabled}
                              onClick={() => handleSlotToggle(slot)}
                              className={`relative flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-md scale-[1.02] ring-2 ring-emerald-500/50'
                                  : isBooked
                                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : isMaintenance
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 cursor-not-allowed'
                                  : isPast
                                  ? 'border-slate-200 bg-slate-100/70 text-slate-400 cursor-not-allowed opacity-60'
                                  : isInWindow
                                  ? 'border-emerald-400 bg-emerald-50/90 text-emerald-950 font-bold hover:bg-emerald-100 shadow-xs ring-2 ring-emerald-400/40'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40'
                              }`}
                            >
                              <div className="text-sm font-black">
                                {slot.timeStart} - {slot.timeEnd}
                              </div>
                              {isBooked ? (
                                <span className="mt-0.5 text-[10px] font-semibold uppercase text-slate-400">
                                  {isPoolFull ? 'Penuh (30/30)' : 'Booked'}
                                </span>
                              ) : isMaintenance ? (
                                <span className="mt-0.5 text-[10px] font-semibold uppercase text-amber-600">
                                  Turnamen
                                </span>
                              ) : isPast ? (
                                <span className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                                  Lewat
                                </span>
                              ) : isSelected ? (
                                <div className="mt-0.5 flex flex-col items-center gap-0.5">
                                  <span className="text-[11px] font-bold text-emerald-100">
                                    Rp {(slot.price / 1000).toFixed(0)}k
                                  </span>
                                  {isPool && (
                                    <span className="rounded-full bg-emerald-800 px-1.5 py-0.2 text-[8px] font-black text-emerald-100">
                                      Sisa {remCap} org
                                    </span>
                                  )}
                                  <span className="rounded-full bg-emerald-700 px-1.5 py-0.2 text-[8px] font-black uppercase text-white">
                                    ✓ Dipilih
                                  </span>
                                </div>
                              ) : isInWindow ? (
                                <div className="mt-0.5 flex flex-col items-center gap-0.5">
                                  <span className="text-[11px] font-black text-emerald-700">
                                    Rp {(slot.price / 1000).toFixed(0)}k
                                  </span>
                                  {isPool && (
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[8px] font-black text-emerald-800 border border-emerald-300">
                                      Sisa {remCap} org
                                    </span>
                                  )}
                                  <span className="rounded-full bg-emerald-200/90 px-1.5 py-0.2 text-[8px] font-black uppercase text-emerald-900">
                                    Waktu Pilihan
                                  </span>
                                </div>
                              ) : (
                                <div className="mt-0.5 flex flex-col items-center gap-0.5">
                                  <span className="text-[11px] font-bold text-slate-600">
                                    Rp {(slot.price / 1000).toFixed(0)}k
                                  </span>
                                  {isPool && (
                                    <span className={`rounded-full px-1.5 py-0.2 text-[8px] font-extrabold ${
                                      remCap <= 5
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}>
                                      Sisa {remCap} org
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                    </div>

                    <div className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Malam / Peak Hour (16:00 - 23:00 WIB • Tarif Prime)
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {daySlots
                        .filter((s) => s.isPeakHour)
                        .map((slot) => {
                          const isSelected = selectedSlots.some((s) => s.id === slot.id);
                          const isPool = activeField?.sportType === 'RENANG';
                          const remCap =
                            slot.remainingCapacity ??
                            Math.max(0, (slot.maxCapacity || 30) - (slot.bookedCapacity || 0));
                          const isPoolFull = isPool && remCap <= 0;
                          const isBooked = slot.status === 'BOOKED' || isPoolFull;
                          const isMaintenance = slot.status === 'MAINTENANCE';
                          const isPast = isSlotPast(selectedDate, slot.hour, slot.timeStart);
                          const isDisabled = isBooked || isMaintenance || isPast;
                          const isInWindow =
                            selectedRate?.timeStart && selectedRate?.timeEnd
                              ? rateCoversHour(
                                  {
                                    timeStart: selectedRate.timeStart,
                                    timeEnd: selectedRate.timeEnd,
                                  },
                                  slot.hour
                                )
                              : false;

                          return (
                            <button
                              key={slot.id}
                              disabled={isDisabled}
                              onClick={() => handleSlotToggle(slot)}
                              className={`relative flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-md scale-[1.02] ring-2 ring-emerald-500/50'
                                  : isBooked
                                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : isMaintenance
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 cursor-not-allowed'
                                  : isPast
                                  ? 'border-slate-200 bg-slate-100/70 text-slate-400 cursor-not-allowed opacity-60'
                                  : isInWindow
                                  ? 'border-emerald-400 bg-emerald-50/90 text-emerald-950 font-bold hover:bg-emerald-100 shadow-xs ring-2 ring-emerald-400/40'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40'
                              }`}
                            >
                              <div className="text-sm font-black">
                                {slot.timeStart} - {slot.timeEnd}
                              </div>
                              {isBooked ? (
                                <span className="mt-0.5 text-[10px] font-semibold uppercase text-slate-400">
                                  {isPoolFull ? 'Penuh (30/30)' : 'Booked'}
                                </span>
                              ) : isMaintenance ? (
                                <span className="mt-0.5 text-[10px] font-semibold uppercase text-amber-600">
                                  Turnamen
                                </span>
                              ) : isPast ? (
                                <span className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                                  Lewat
                                </span>
                              ) : isSelected ? (
                                <div className="mt-0.5 flex flex-col items-center gap-0.5">
                                  <span className="text-[11px] font-bold text-emerald-100">
                                    Rp {(slot.price / 1000).toFixed(0)}k
                                  </span>
                                  {isPool && (
                                    <span className="rounded-full bg-emerald-800 px-1.5 py-0.2 text-[8px] font-black text-emerald-100">
                                      Sisa {remCap} org
                                    </span>
                                  )}
                                  <span className="rounded-full bg-emerald-700 px-1.5 py-0.2 text-[8px] font-black uppercase text-white">
                                    ✓ Dipilih
                                  </span>
                                </div>
                              ) : isInWindow ? (
                                <div className="mt-0.5 flex flex-col items-center gap-0.5">
                                  <span className="text-[11px] font-black text-emerald-700">
                                    Rp {(slot.price / 1000).toFixed(0)}k
                                  </span>
                                  {isPool && (
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[8px] font-black text-emerald-800 border border-emerald-300">
                                      Sisa {remCap} org
                                    </span>
                                  )}
                                  <span className="rounded-full bg-emerald-200/90 px-1.5 py-0.2 text-[8px] font-black uppercase text-emerald-900">
                                    Waktu Pilihan
                                  </span>
                                </div>
                              ) : (
                                <div className="mt-0.5 flex flex-col items-center gap-0.5">
                                  <span className="text-[11px] font-bold text-slate-600">
                                    Rp {(slot.price / 1000).toFixed(0)}k
                                  </span>
                                  {isPool && (
                                    <span className={`rounded-full px-1.5 py-0.2 text-[8px] font-extrabold ${
                                      remCap <= 5
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}>
                                      Sisa {remCap} org
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR: Order Summary Floating Card */}
          <div className="lg:col-span-1">
            {userCategory === 'PERTANDINGAN' ? (
              <div className="sticky top-20 rounded-2xl border-2 border-amber-300 bg-white p-6 shadow-lg">
                <div className="flex items-center gap-2 text-amber-700">
                  <Award className="h-5 w-5 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Khusus Event &amp; Pertandingan
                  </span>
                </div>
                <h3 className="mt-1.5 text-base font-black text-slate-900">
                  Pengajuan Rekomendasi
                </h3>
                <p className="text-xs text-slate-500">
                  Pemesanan memerlukan verifikasi resmi DISBUDPORA
                </p>

                <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Venue:</span>
                    <span className="font-bold text-slate-900">{selectedVenue.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lapangan:</span>
                    <span className="font-bold text-emerald-700">{activeField?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kategori:</span>
                    <span className="font-bold text-amber-900">Pertandingan / Kompetisi</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tanggal Rencana:</span>
                    <span className="font-bold text-slate-900">{selectedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Durasi Sewa:</span>
                    <span className="font-bold text-slate-900">Sepanjang Hari (Event)</span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
                    <span>Tarif Resmi Event</span>
                  </div>
                  <div className="text-lg font-black text-emerald-800">
                    Rp {selectedRate ? selectedRate.price.toLocaleString('id-ID') : '2.000.000'}
                    <span className="text-xs font-normal text-slate-500"> / hari</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 leading-relaxed">
                    *Pembayaran dan administrasi resmi diselesaikan setelah surat rekomendasi dan verifikasi jadwal disetujui.
                  </p>
                </div>

                <a
                  href={`https://wa.me/6281234567890?text=${encodeURIComponent(
                    `Halo Admin DISBUDPORA Sport Bekasi,\nSaya ingin mengajukan permohonan sewa venue ${selectedVenue.name} untuk kegiatan Pertandingan / Seleksi / Kompetisi pada tanggal ${selectedDate}.\nMohon info persyaratan surat rekomendasi dan verifikasi jadwal. Terima kasih.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 py-3.5 text-xs font-black text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-700 hover:to-emerald-800 transition"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Hubungi WhatsApp Admin DISBUDPORA</span>
                </a>

                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Respon cepat jam kerja DISBUDPORA Kab. Bekasi</span>
                </div>
              </div>
            ) : (
              <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
                <h3 className="text-base font-black text-slate-900">{t.venueDetail.orderSummary}</h3>
                <p className="text-xs text-slate-500">
                  {activeLang === 'ID' ? 'Periksa tanggal, lapangan, & jam bermainmu' : 'Check your date, court, & playing hours'}
                </p>

                <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Venue:</span>
                    <span className="font-bold text-slate-900">{selectedVenue.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t.venueDetail.courtField}</span>
                    <span className="font-bold text-emerald-700">{activeField?.name}</span>
                  </div>
                  {selectedCategoryLabel && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 shrink-0">{t.venueDetail.rateCategory}</span>
                      <span className="font-bold text-slate-900 text-right line-clamp-2">
                        {selectedCategoryLabel}
                      </span>
                    </div>
                  )}
                  {selectedRate && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">{activeLang === 'ID' ? 'Pilihan Waktu:' : 'Time Selection:'}</span>
                      <span className="font-bold text-emerald-700">
                        {selectedRate.timeStart && selectedRate.timeEnd
                          ? `${selectedRate.timeStart} - ${selectedRate.timeEnd} WIB`
                          : 'Sepanjang Hari'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t.venueDetail.playDate}</span>
                    <span className="font-bold text-slate-900">{selectedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t.venueDetail.selectedSlots}</span>
                    <span className="font-bold text-slate-900">
                      {selectedSlots.length} {t.venueDetail.hours}
                    </span>
                  </div>
                </div>

                {/* Selected Slots Pills */}
                {selectedSlots.length > 0 && (
                  <div className="mt-4 rounded-xl bg-emerald-50 p-3">
                    <div className="text-[11px] font-bold uppercase text-emerald-800">
                      {activeLang === 'ID' ? 'Daftar Jam Terpilih:' : 'Selected Playing Hours:'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedSlots
                        .sort((a, b) => a.hour - b.hour)
                        .map((s) => (
                          <span
                            key={s.id}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white shadow-sm"
                          >
                            {s.timeStart} - {s.timeEnd}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Price Calculation */}
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>
                      {activeLang === 'ID' ? `Subtotal Sewa (${selectedSlots.length} jam)` : `Rental Subtotal (${selectedSlots.length} hr)`}
                    </span>
                    <span className="font-bold text-slate-900">
                      Rp {selectedTotalPrice.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                    <span>{activeLang === 'ID' ? 'Biaya Layanan Wibawa Mukti' : 'Wibawa Mukti Service Fee'}</span>
                    <span>Rp {selectedSlots.length > 0 ? '5.000' : '0'}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-900">
                    <span>{t.venueDetail.totalCost}</span>
                    <span className="text-emerald-600">
                      Rp{' '}
                      {(selectedSlots.length > 0 ? selectedTotalPrice + 5000 : 0).toLocaleString(
                        'id-ID'
                      )}
                    </span>
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  disabled={selectedSlots.length === 0}
                  onClick={handleProceedToCheckout}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold shadow-lg transition ${
                    selectedSlots.length > 0
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700 active:scale-98'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>{t.venueDetail.proceedToPayment}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>

                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Pembayaran aman dengan QRIS &amp; Virtual Account Bank</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          LOGIN GATE MODAL — Muncul jika user belum login saat booking
          ============================================================ */}
      {showLoginGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <ShieldCheck className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-lg font-black text-white">Wajib Masuk Dulu!</h3>
              <p className="mt-1 text-xs text-emerald-100/90 leading-relaxed">
                Untuk melanjutkan pemesanan lapangan, kamu harus masuk atau daftar akun terlebih dahulu.
              </p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              {/* Info kenapa wajib login */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3.5 space-y-1.5 text-xs text-blue-800">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Mengapa harus login?
                </div>
                <ul className="space-y-1 text-[11px] text-blue-700 leading-relaxed list-disc list-inside">
                  <li>Riwayat booking tersimpan di akunmu</li>
                  <li>Data NIK & pembayaran lebih aman</li>
                  <li>Notifikasi status verifikasi admin</li>
                  <li>Tidak perlu isi data berulang kali</li>
                </ul>
              </div>

              {/* Ringkasan slot yang dipilih */}
              {selectedSlots.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Slot yang akan dipesan:
                  </div>
                  <div className="font-bold text-slate-900">{selectedVenue?.name}</div>
                  <div className="text-slate-600 mt-0.5">
                    {selectedSlots.map(s => `${s.timeStart}–${s.timeEnd}`).join(', ')} WIB
                  </div>
                  <div className="mt-1.5 font-black text-emerald-700 text-sm">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedTotalPrice + 5000)}
                  </div>
                </div>
              )}

              {/* CTA Buttons */}
              <a
                href={`/login`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3.5 text-xs font-black text-white uppercase tracking-wider transition shadow-md shadow-emerald-500/20"
              >
                <ShieldCheck className="h-4 w-4" />
                Masuk ke Akun Saya
              </a>

              <a
                href={`/register`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600 py-3 text-xs font-black text-emerald-700 uppercase tracking-wider transition hover:bg-emerald-50"
              >
                Daftar Akun Baru — Gratis
              </a>

              <button
                onClick={() => setShowLoginGate(false)}
                className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-700 py-1 transition"
              >
                Batal, kembali pilih jadwal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
