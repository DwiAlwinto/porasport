import React, { useState, useMemo, useEffect } from 'react';
import { handleImageError, getFallbackImageForUrl } from '../../utils/imageUtils';
import { useApp } from '../../context/AppContext';
import {
  Venue,
  VenueField,
  FieldSlot,
  BookingItem,
} from '../../types';
import {
  generateDaySlotsForField,
} from '../../lib/slotUtils';
import { getPublicFieldSlots } from '../../actions/venueActions';
import { USER_CATEGORY_LABELS, getUserCategoryLabel } from '../../lib/pricing';
import type { UserCategory } from '@prisma/client';
import {
  MapPin,
  Star,
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
} from 'lucide-react';

export const VenueDetailPage: React.FC = () => {
  const {
    selectedVenue,
    setActiveView,
    startBookingCheckout,
    reviews,
    isLoggedIn,
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

  // Kategori pengguna penewa, menentukan tarif mana yang berlaku
  const [userCategory, setUserCategory] = useState<UserCategory | null>(null);

  // Jumlah orang / perenang khusus tarif per orang / jam (Kolam Renang Aquatic)
  const [swimmerCount, setSwimmerCount] = useState<number>(1);

  // Active field object
  const activeField = useMemo(() => {
    const fields = selectedVenue?.fields ?? [];
    return fields.find((f) => f.id === selectedFieldId) || fields[0];
  }, [selectedVenue, selectedFieldId]);

  // Kategori yang punya tarif pada lapangan aktif beserta label dinamisnya
  const availableCategories = useMemo<{ category: UserCategory; label: string }[]>(() => {
    const rates = activeField?.rates ?? [];
    const map = new Map<UserCategory, string>();
    for (const r of rates) {
      if (r.isActive !== false && !map.has(r.category)) {
        const displayLabel = r.label?.trim() || getUserCategoryLabel(r.category, activeField?.sportType);
        map.set(r.category, displayLabel);
      }
    }
    return Array.from(map.entries()).map(([category, label]) => ({ category, label }));
  }, [activeField]);

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
    setSelectedSlots([]); // reset selection when field changes
  };

  // Ganti lapangan atau kategori => pilihan slot lama tidak valid lagi
  const handleCategoryChange = (category: UserCategory | null) => {
    setUserCategory(category);
    setSelectedSlots([]);
  };

  // Calculate total price of selected slots
  const selectedTotalPrice = useMemo(() => {
    const base = selectedSlots.reduce((sum, s) => sum + s.price, 0);
    if (activeField?.sportType === 'RENANG' && userCategory !== 'PERTANDINGAN') {
      return base * swimmerCount;
    }
    return base;
  }, [selectedSlots, activeField, userCategory, swimmerCount]);

  const handleProceedToCheckout = () => {
    if (selectedSlots.length === 0 || !activeField || !selectedVenue) return;

    // AUTH GATE: Wajib login sebelum bisa lanjut booking
    if (!isLoggedIn) {
      setShowLoginGate(true);
      return;
    }

    const isAquaticPerson = activeField.sportType === 'RENANG' && userCategory !== 'PERTANDINGAN';
    const items: BookingItem[] = selectedSlots.map((s) => ({
      slotId: s.id,
      fieldId: activeField.id,
      fieldName: isAquaticPerson && swimmerCount > 1
        ? `${activeField.name} (${swimmerCount} Orang)`
        : activeField.name,
      date: s.date,
      timeStart: s.timeStart,
      timeEnd: s.timeEnd,
      price: isAquaticPerson ? s.price * swimmerCount : s.price,
      isPeakHour: s.isPeakHour,
    }));

    startBookingCheckout(selectedVenue.id, activeField.sportType, items, userCategory);
  };

  const venueReviews = reviews.filter((r) => r.venueId === selectedVenue?.id);

  // Semua hook sudah selesai dipanggil; aman untuk keluar lebih awal di sini.
  if (!selectedVenue) {
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
            <span>Kembali ke Hasil Pencarian</span>
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
                    {st}
                  </span>
                ))}
                <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-300">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>{selectedVenue.rating}</span>
                  <span className="text-slate-500">({selectedVenue.reviewCount} ulasan)</span>
                </span>
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
                  Fasilitas &amp; Layanan Venue
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
                  1. Pilih Lapangan / Court
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
                            {f.sportType}
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
                        {activeField.sportType}
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
                      {activeField.sportType === 'RENANG' ? 'Tarif Dasar PERDA' : 'Tarif Dasar'}
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
                    2. Pilih Tanggal &amp; Slot Jam Bermain
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
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Pemilih Kategori Pengguna + Tabel Tarif */}
              {availableCategories.length > 0 && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                        Kategori Penyewa
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        Tarif mengikuti kategori dan jam yang dipilih
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map((item) => (
                      <button
                        key={item.category}
                        type="button"
                        onClick={() => handleCategoryChange(item.category)}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          userCategory === item.category
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                            : 'border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 overflow-x-auto rounded-xl border border-emerald-200 bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="border-b border-emerald-200 bg-emerald-50 text-[10px] font-extrabold uppercase text-emerald-800">
                        <tr>
                          <th className="px-3 py-2">Kategori</th>
                          <th className="px-3 py-2">Waktu</th>
                          <th className="px-3 py-2 text-right">Tarif</th>
                          <th className="px-3 py-2 text-right">Satuan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                        {activeField?.rates?.map((r) => {
                          const isActive = userCategory === r.category;
                          return (
                            <tr
                              key={r.id}
                              className={
                                isActive ? 'bg-emerald-50 font-bold text-emerald-900' : ''
                              }
                            >
                              <td className="px-3 py-2">
                                {r.label || getUserCategoryLabel(r.category, activeField?.sportType)}
                              </td>
                              <td className="px-3 py-2">
                                {r.timeStart ? `${r.timeStart} - ${r.timeEnd}` : 'Sepanjang hari'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                Rp {r.price.toLocaleString('id-ID')}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500">
                                {activeField?.sportType === 'RENANG' && r.unit === 'PER_JAM'
                                  ? 'per orang / jam'
                                  : r.unit === 'PER_HARI'
                                  ? 'per hari'
                                  : r.unit === 'PER_PERTANDINGAN'
                                  ? 'per pertandingan'
                                  : 'per jam'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {!userCategory && (
                    <p className="mt-2 text-[11px] font-semibold text-amber-700">
                      Pilih kategori di atas agar harga slot dan total tagihan terhitung
                      akurat.
                    </p>
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
                            Tarif resmi PERDA dihitung per orang per jam
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
                          {swimmerCount} Orang
                        </span>
                        <button
                          type="button"
                          onClick={() => setSwimmerCount(swimmerCount + 1)}
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
                            Pertandingan / Seleksi / Kejuaraan (Rp 3.500.000 / hari)
                          </h4>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                            Sesuai PERDA, kegiatan pertandingan/kompetisi memerlukan <strong>Surat Rekomendasi Resmi DISBUDPORA</strong>. Silakan hubungi langsung WhatsApp Admin untuk verifikasi rekomendasi dan penjadwalan.
                          </p>
                          <div className="mt-3">
                            <a
                              href={`https://wa.me/6281234567890?text=${encodeURIComponent(
                                `Halo Admin DISBUDPORA Sport Bekasi,
Saya ingin mengajukan permohonan sewa venue ${selectedVenue.name} untuk kegiatan Pertandingan / Seleksi / Kompetisi pada tanggal ${selectedDate}.
Mohon info persyaratan surat rekomendasi dan verifikasi jadwal. Terima kasih.`
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
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded bg-emerald-100 border border-emerald-400" />
                  <span className="text-slate-600">Tersedia (Klik pilih)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded bg-emerald-600" />
                  <span className="text-slate-900 font-bold">Terpilih ({selectedSlots.length})</span>
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
                      const isBooked = slot.status === 'BOOKED';
                      const isMaintenance = slot.status === 'MAINTENANCE';

                      return (
                        <button
                          key={slot.id}
                          disabled={isBooked || isMaintenance}
                          onClick={() => handleSlotToggle(slot)}
                          className={`relative flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-md scale-[1.02]'
                              : isBooked
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                              : isMaintenance
                              ? 'border-amber-200 bg-amber-50 text-amber-700 cursor-not-allowed'
                              : 'border-emerald-200 bg-emerald-50/50 text-slate-800 hover:bg-emerald-100'
                          }`}
                        >
                          <div className="text-sm font-black">
                            {slot.timeStart} - {slot.timeEnd}
                          </div>
                          <div
                            className={`mt-0.5 text-[11px] font-bold ${
                              isSelected ? 'text-emerald-100' : 'text-emerald-700'
                            }`}
                          >
                            Rp {(slot.price / 1000).toFixed(0)}k
                          </div>
                          {isBooked && (
                            <span className="mt-0.5 text-[10px] font-semibold uppercase text-slate-400">
                              Booked
                            </span>
                          )}
                          {isMaintenance && (
                            <span className="mt-0.5 text-[10px] font-semibold uppercase text-amber-600">
                              Turnamen
                            </span>
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
                      const isBooked = slot.status === 'BOOKED';
                      const isMaintenance = slot.status === 'MAINTENANCE';

                      return (
                        <button
                          key={slot.id}
                          disabled={isBooked || isMaintenance}
                          onClick={() => handleSlotToggle(slot)}
                          className={`relative flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-md scale-[1.02]'
                              : isBooked
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                              : isMaintenance
                              ? 'border-amber-200 bg-amber-50 text-amber-700 cursor-not-allowed'
                              : 'border-emerald-200 bg-emerald-50/50 text-slate-800 hover:bg-emerald-100'
                          }`}
                        >
                          <div className="text-sm font-black">
                            {slot.timeStart} - {slot.timeEnd}
                          </div>
                          <div
                            className={`mt-0.5 text-[11px] font-bold ${
                              isSelected ? 'text-emerald-100' : 'text-emerald-700'
                            }`}
                          >
                            Rp {(slot.price / 1000).toFixed(0)}k
                          </div>
                          {isBooked && (
                            <span className="mt-0.5 text-[10px] font-semibold uppercase text-slate-400">
                              Booked
                            </span>
                          )}
                          {isMaintenance && (
                            <span className="mt-0.5 text-[10px] font-semibold uppercase text-amber-600">
                              Turnamen
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* User Reviews Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">
                Ulasan &amp; Rating dari Pemain ({selectedVenue.reviewCount})
              </h3>
              <div className="mt-4 space-y-4">
                {venueReviews.length === 0 ? (
                  <p className="text-xs text-slate-400">Belum ada ulasan untuk venue ini.</p>
                ) : (
                  venueReviews.map((rev) => (
                    <div key={rev.id} className="border-b border-slate-100 pb-4 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={rev.userAvatar}
                            alt={rev.userName}
                            className="h-8 w-8 rounded-full object-cover"
                            onError={handleImageError}
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900">{rev.userName}</div>
                            <div className="text-[10px] text-slate-400">{rev.createdAt}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span>{rev.rating}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">{rev.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: Order Summary Floating Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
              <h3 className="text-base font-black text-slate-900">Ringkasan Pesanan</h3>
              <p className="text-xs text-slate-500">
                Periksa tanggal, lapangan, &amp; jam bermainmu
              </p>

              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Venue:</span>
                  <span className="font-bold text-slate-900">{selectedVenue.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lapangan:</span>
                  <span className="font-bold text-emerald-700">{activeField?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal:</span>
                  <span className="font-bold text-slate-900">{selectedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Slot Jam Dipilih:</span>
                  <span className="font-bold text-slate-900">
                    {selectedSlots.length} Jam
                  </span>
                </div>
              </div>

              {/* Selected Slots Pills */}
              {selectedSlots.length > 0 && (
                <div className="mt-4 rounded-xl bg-emerald-50 p-3">
                  <div className="text-[11px] font-bold uppercase text-emerald-800">
                    Daftar Jam Terpilih:
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
                  <span>Subtotal Sewa ({selectedSlots.length} jam)</span>
                  <span>Rp {selectedTotalPrice.toLocaleString('id-ID')}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span>Biaya Layanan Wibawa Mukti</span>
                  <span>Rp {selectedSlots.length > 0 ? '5.000' : '0'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-900">
                  <span>Total Bayar</span>
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
                <span>Lanjut ke Pembayaran</span>
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Pembayaran aman dengan QRIS &amp; Virtual Account Bank</span>
              </div>
            </div>
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
