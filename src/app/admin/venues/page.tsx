"use client";

import React, { useState, useEffect, useTransition } from 'react';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Image as ImageIcon,
  MapPin,
  Clock,
  Check,
  X,
  Upload,
  Layers,
  DollarSign,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  getCmsVenues,
  createOrUpdateVenue,
  deleteVenue,
  createOrUpdateField,
  deleteField,
  uploadFacilityImageAction,
} from '../../../actions/cmsActions';
import { SportCategory, UserCategory, RateUnit } from '@prisma/client';
import {
  categoriesForSport,
  getUserCategoryLabel,
  USER_CATEGORY_LABELS,
  RATE_UNIT_LABELS,
  STANDARD_TIME_WINDOWS,
} from '../../../lib/pricing';
import { VENUE_FACILITIES } from '../../../lib/venueConstants';

/** Satu baris tarif yang sedang diedit di form admin. */
type RateRow = {
  key: string;
  category: UserCategory;
  timeStart: string;
  timeEnd: string;
  price: string;
  unit: RateUnit;
};

let rateRowSeq = 0;
const newRateRow = (category: UserCategory, unit: RateUnit = 'PER_JAM'): RateRow => ({
  key: `rate-${++rateRowSeq}`,
  category,
  timeStart: '',
  timeEnd: '',
  price: '',
  unit,
});

const formatRupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');

const KABUPATEN_BEKASI_LOCATIONS = [
  'Wibawa Mukti',
  'Grand Wisata',
  'Tambun Selatan',
  'Sukatani',
  'Cibarusah',
  'Tarumajaya',
  'Cikarang Barat',
  'Cikarang Utara',
  'Cikarang Timur',
];

const SPORT_OPTIONS: { label: string; value: SportCategory }[] = [
  { label: 'Mini Soccer', value: 'MINI_SOCCER' },
  { label: 'Sepak Bola', value: 'SEPAK_BOLA' },
  { label: 'Lapangan Futsal', value: 'FUTSAL' },
  { label: 'Lapangan Voli', value: 'VOLI' },
  { label: 'Lapangan Tembak', value: 'MENEMBAK' },
  { label: 'Lapangan Tenis', value: 'TENIS' },
  { label: 'Bola Basket', value: 'BASKET' },
  { label: 'Kolam Renang', value: 'RENANG' },
  { label: 'Skateboard', value: 'SKATEPARK' },
  { label: 'Bulu Tangkis', value: 'BADMINTON' },
  { label: 'Stadion Utama', value: 'STADION' },
  { label: 'Trek Lari / Atletik', value: 'ATLETIK' },
  { label: 'Trek Sepatu Roda', value: 'ROLLER_SPORT' },
];

// Daftar fasilitas venue memakai satu sumber kebenaran agar nama yang ditulis
// admin persis sama dengan yang dicari filter di halaman Fasilitas.
const AVAILABLE_FACILITIES = VENUE_FACILITIES.map((f) => f.name);

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal State: Venue Form
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [venueName, setVenueName] = useState('');
  const [venueSlug, setVenueSlug] = useState('');
  const [venueCity, setVenueCity] = useState(KABUPATEN_BEKASI_LOCATIONS[0]);
  const [venueAddress, setVenueAddress] = useState('');
  const [venueHours, setVenueHours] = useState('06:00 - 23:00 WIB');
  const [venueDesc, setVenueDesc] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [venueImages, setVenueImages] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState(50000);
  const [maxPrice, setMaxPrice] = useState(350000);
  const [isPopular, setIsPopular] = useState(false);
  const [isPromo, setIsPromo] = useState(false);
  const [promoBadge, setPromoBadge] = useState('');

  // Modal State: Manage Fields
  const [activeVenueForFields, setActiveVenueForFields] = useState<any | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldSportType, setFieldSportType] = useState<SportCategory>('FUTSAL');
  const [fieldType, setFieldType] = useState('Indoor');
  const [fieldFloorType, setFieldFloorType] = useState('Rumput Sintetis');
  const [priceNonPeak, setPriceNonPeak] = useState(100000);
  const [pricePeak, setPricePeak] = useState(150000);

  // Modal State: Tarif per kategori
  const [fieldRates, setFieldRates] = useState<RateRow[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // Kategori yang relevan berubah mengikuti cabang olahraga yang dipilih,
  // supaya admin tidak ditawarin "Profesional" untuk lapangan basket.
  const availableCategories = React.useMemo(
    () => categoriesForSport(fieldSportType),
    [fieldSportType]
  );

  const resetFieldForm = () => {
    setEditingFieldId(null);
    setFieldName('');
    setFieldSportType('FUTSAL');
    setFieldType('Indoor');
    setFieldFloorType('Rumput Sintetis');
    setPriceNonPeak(100000);
    setPricePeak(150000);
    setFieldRates([]);
  };

  const addRateRow = (category: UserCategory, unit: RateUnit = 'PER_JAM') => {
    setFieldRates((prev) => [...prev, newRateRow(category, unit)]);
  };

  const updateRateRow = (key: string, patch: Partial<RateRow>) => {
    setFieldRates((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRateRow = (key: string) => {
    setFieldRates((prev) => prev.filter((r) => r.key !== key));
  };

  /**
   * Satu klik mengisi 7 baris tarif paket stadion: Sosial sepanjang hari,
   * lalu Lokal / Amatir / Profesional masing-masing dua slot waktu.
   */
  const applyStadiumPreset = () => {
    const rows: RateRow[] = [];
    const unit: RateUnit = 'PER_PERTANDINGAN';
    for (const category of ['LOKAL', 'AMATIR', 'PROFESIONAL'] as UserCategory[]) {
      for (const w of STANDARD_TIME_WINDOWS) {
        rows.push({ ...newRateRow(category, unit), timeStart: w.timeStart, timeEnd: w.timeEnd });
      }
    }
    rows.push(newRateRow('SOSIAL', unit));
    setFieldRates(rows);
    showToast('Paket Stadion dimuat: 7 baris tarif siap diisi nominalnya.');
  };

  const handleOpenEditField = (f: any) => {
    setEditingFieldId(f.id);
    setFieldName(f.name || '');
    setFieldSportType(f.sportType || 'FUTSAL');
    setFieldType(f.type || 'Indoor');
    setFieldFloorType(f.floorType || 'Rumput Sintetis');
    setPriceNonPeak(f.priceNonPeak ?? 0);
    setPricePeak(f.pricePeak ?? 0);
    setFieldRates(
      (f.rates || []).map((r: any) => ({
        key: `rate-${++rateRowSeq}`,
        category: r.category,
        timeStart: r.timeStart || '',
        timeEnd: r.timeEnd || '',
        price: String(r.price),
        unit: r.unit,
      }))
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchVenues = async () => {
    setLoading(true);
    const res = await getCmsVenues();
    if (res.success) {
      setVenues(res.venues);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Open Create Venue Modal
  const handleOpenCreateVenue = () => {
    setEditingVenueId(null);
    setVenueName('');
    setVenueSlug('');
    setVenueCity(KABUPATEN_BEKASI_LOCATIONS[0]);
    setVenueAddress('');
    setVenueHours('06:00 - 23:00 WIB');
    setVenueDesc('');
    setSelectedFacilities(['Parkir Luas', 'Toilet & Shower', 'Mushola']);
    setVenueImages(['/images/wibawamukti.png']);
    setMinPrice(50000);
    setMaxPrice(350000);
    setIsPopular(false);
    setIsPromo(false);
    setPromoBadge('');
    setIsVenueModalOpen(true);
  };

  // Open Edit Venue Modal
  const handleOpenEditVenue = (v: any) => {
    setEditingVenueId(v.id);
    setVenueName(v.name);
    setVenueSlug(v.slug);
    setVenueCity(v.city);
    setVenueAddress(v.address);
    setVenueHours(v.openingHours);
    setVenueDesc(v.description || '');
    setSelectedFacilities(v.facilities || []);
    setVenueImages(v.images || ['/images/wibawamukti.png']);
    setMinPrice(v.minPrice || 50000);
    setMaxPrice(v.maxPrice || 350000);
    setIsPopular(!!v.isPopular);
    setIsPromo(!!v.isPromo);
    setPromoBadge(v.promoBadge || '');
    setIsVenueModalOpen(true);
  };

  // Save Venue
  const handleSaveVenue = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createOrUpdateVenue({
        id: editingVenueId || undefined,
        name: venueName,
        slug: venueSlug || venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        city: venueCity,
        address: venueAddress,
        openingHours: venueHours,
        description: venueDesc,
        facilities: selectedFacilities,
        images: venueImages,
        minPrice,
        maxPrice,
        isPopular,
        isPromo,
        promoBadge,
      });

      if (res.success) {
        showToast(`Venue "${venueName}" berhasil disimpan!`);
        setIsVenueModalOpen(false);
        fetchVenues();
      } else {
        alert(res.error || 'Gagal menyimpan venue.');
      }
    });
  };

  // Delete Venue
  const handleDeleteVenue = (venue: any) => {
    if (!confirm(`Hapus venue "${venue.name}" beserta seluruh lapangannya?`)) return;
    startTransition(async () => {
      const res = await deleteVenue(venue.id);
      if (res.success) {
        showToast(`Venue "${venue.name}" berhasil dihapus.`);
        fetchVenues();
      } else {
        alert(res.error || 'Gagal menghapus venue.');
      }
    });
  };

  // Save Field
  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVenueForFields || !fieldName.trim()) return;

    // Hanya baris yang nominalnya sudah diisi yang dikirim.
    const rates = fieldRates
      .filter((r) => r.price !== '' && Number(r.price) > 0)
      .map((r) => ({
        category: r.category,
        timeStart: r.timeStart || null,
        timeEnd: r.timeEnd || null,
        price: Number(r.price),
        unit: r.unit,
      }));

    startTransition(async () => {
      const res = await createOrUpdateField({
        id: editingFieldId || undefined,
        venueId: activeVenueForFields.id,
        name: fieldName.trim(),
        sportType: fieldSportType,
        type: fieldType,
        floorType: fieldFloorType,
        priceNonPeak,
        pricePeak,
        rates,
      });

      if (res.success) {
        showToast(
          editingFieldId
            ? `Lapangan "${fieldName}" berhasil diperbarui!`
            : `Lapangan "${fieldName}" berhasil ditambahkan!`
        );
        resetFieldForm();
        fetchVenues();
      } else {
        alert(res.error || 'Gagal menyimpan lapangan.');
      }
    });
  };

  // Delete Field
  const handleDeleteField = (field: any) => {
    if (!confirm(`Hapus lapangan "${field.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteField(field.id);
      if (res.success) {
        showToast(`Lapangan "${field.name}" berhasil dihapus.`);
        fetchVenues();
        setActiveVenueForFields((prev: any) => ({
          ...prev,
          fields: prev.fields.filter((f: any) => f.id !== field.id),
        }));
      } else {
        alert(res.error || 'Gagal menghapus lapangan.');
      }
    });
  };

  // Image Upload Handler
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const res = await uploadFacilityImageAction({ base64, fileName: file.name });
      if (res.success && res.url) {
        setVenueImages((prev) => [res.url, ...prev]);
        showToast('Foto fasilitas berhasil diunggah!');
      } else {
        alert(res.error || 'Gagal mengunggah foto.');
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFacility = (fac: string) => {
    setSelectedFacilities((prev) =>
      prev.includes(fac) ? prev.filter((f) => f !== fac) : [...prev, fac]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-xs font-bold text-emerald-700 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 mb-1">
            <Building2 className="h-4 w-4" />
            <span>Content Management System (CMS)</span>
          </div>
          <h1 className="text-2xl font-black text-fg tracking-tight">
            Manajemen Fasilitas &amp; Venue
          </h1>
          <p className="text-xs text-fg-muted">
            Kelola data gelanggang olahraga, lapangan, jenis cabang olahraga, tarif, fasilitas penunjang, dan galeri foto.
          </p>
        </div>

        <button
          onClick={handleOpenCreateVenue}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-teal-600 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Venue Baru</span>
        </button>
      </div>

      {/* Venue List */}
      {loading ? (
        <div className="py-20 text-center text-xs font-bold text-fg-faint">
          Memuat data fasilitas dari database...
        </div>
      ) : venues.length === 0 ? (
        <div className="rounded-3xl border border-line bg-surface p-12 text-center text-fg-muted">
          Belum ada venue yang terdaftar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="flex flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface shadow-xl transition hover:border-line-strong"
            >
              <div>
                {/* Image header */}
                <div className="relative aspect-video w-full overflow-hidden bg-field">
                  <img
                    src={venue.images?.[0] || '/images/wibawamukti.png'}
                    alt={venue.name}
                    className="h-full w-full object-cover transition hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 rounded-full bg-surface border border-line-strong/80 px-3 py-1 text-[10px] font-extrabold text-emerald-700 backdrop-blur-md">
                    {venue.city}
                  </div>
                  {venue.isPopular && (
                    <div className="absolute top-3 right-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-black text-white shadow-md">
                      Populer
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-fg tracking-tight">{venue.name}</h3>
                    <p className="mt-1 text-xs text-fg-muted line-clamp-2 leading-relaxed">
                      {venue.address}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold text-fg-muted">
                    <span className="flex items-center gap-1.5 text-blue-700 font-bold">
                      <Layers className="h-3.5 w-3.5" />
                      {venue.fields?.length || 0} Lapangan
                    </span>
                    <span className="flex items-center gap-1 text-fg-faint">
                      <Clock className="h-3.5 w-3.5" />
                      {venue.openingHours}
                    </span>
                  </div>

                  {/* Sport Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {venue.fields && venue.fields.length > 0 ? (
                      Array.from(new Set(venue.fields.map((f: any) => f.sportType))).map((st: any) => (
                        <span
                          key={st}
                          className="rounded-md border border-line-strong bg-subtle px-2 py-0.5 text-[10px] font-bold text-fg-subtle"
                        >
                          {st}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-fg-faint italic">Belum ada lapangan</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-line p-4 bg-surface-soft flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    resetFieldForm();
                    setActiveVenueForFields(venue);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 transition"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Lapangan ({venue.fields?.length || 0})</span>
                </button>

                <button
                  onClick={() => handleOpenEditVenue(venue)}
                  className="rounded-xl border border-line-strong bg-subtle p-2 text-fg-subtle hover:bg-subtle-strong hover:text-fg transition"
                  title="Edit Venue"
                >
                  <Edit3 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => handleDeleteVenue(venue)}
                  className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-50 transition"
                  title="Hapus Venue"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT VENUE */}
      {isVenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-2xl rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">
                    {editingVenueId ? 'Edit Data Venue' : 'Tambah Venue Fasilitas Baru'}
                  </h3>
                  <p className="text-xs text-fg-muted">Kabupaten Bekasi Sport Facility</p>
                </div>
              </div>
              <button
                onClick={() => setIsVenueModalOpen(false)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVenue} className="mt-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-fg-subtle block mb-1">Nama Gelanggang / Venue</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Gelanggang Olahraga Tambun"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-fg-subtle block mb-1">Kecamatan / Lokasi (Kab. Bekasi)</label>
                  <select
                    value={venueCity}
                    onChange={(e) => setVenueCity(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                  >
                    {KABUPATEN_BEKASI_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-fg-subtle block mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Jl. Raya ..., Kelurahan ..., Kecamatan ..., Kabupaten Bekasi"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-medium text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-fg-subtle block mb-1">Jam Operasional</label>
                  <input
                    type="text"
                    value={venueHours}
                    onChange={(e) => setVenueHours(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-fg-subtle block mb-1">Harga Minimum (Rp)</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-fg-subtle block mb-1">Harga Maksimum (Rp)</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Upload Foto Venue */}
              <div>
                <label className="font-bold text-fg-subtle block mb-1">Foto Fasilitas &amp; Venue</label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-subtle px-4 py-2.5 text-xs font-bold text-fg hover:bg-subtle-strong">
                    <Upload className="h-4 w-4 text-emerald-700" />
                    <span>Upload Foto Baru</span>
                    <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                  </label>
                  <span className="text-[10px] text-fg-muted">PNG, JPG, atau WebP (Disimpan ke server)</span>
                </div>

                {venueImages.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto py-1">
                    {venueImages.map((img, idx) => (
                      <div key={idx} className="relative h-16 w-24 rounded-lg overflow-hidden border border-line-strong shrink-0">
                        <img src={img} alt="thumb" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setVenueImages(venueImages.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 rounded-full bg-red-600 p-0.5 text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fasilitas Checkbox */}
              <div>
                <label className="font-bold text-fg-subtle block mb-2">Fasilitas Penunjang Tersedia:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AVAILABLE_FACILITIES.map((fac) => (
                    <button
                      key={fac}
                      type="button"
                      onClick={() => toggleFacility(fac)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-semibold transition ${
                        selectedFacilities.includes(fac)
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-line bg-field text-fg-muted hover:bg-subtle'
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          selectedFacilities.includes(fac)
                            ? 'border-emerald-400 bg-emerald-500 text-white'
                            : 'border-line-strong'
                        }`}
                      >
                        {selectedFacilities.includes(fac) && <Check className="h-3 w-3" />}
                      </div>
                      <span>{fac}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-fg-subtle block mb-1">Deskripsi Fasilitas</label>
                <textarea
                  rows={3}
                  value={venueDesc}
                  onChange={(e) => setVenueDesc(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-medium text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-fg-subtle">
                  <input
                    type="checkbox"
                    checked={isPopular}
                    onChange={(e) => setIsPopular(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500 rounded"
                  />
                  <span>Tandai sebagai Venue Populer</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-fg-subtle">
                  <input
                    type="checkbox"
                    checked={isPromo}
                    onChange={(e) => setIsPromo(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500 rounded"
                  />
                  <span>Aktifkan Badge Promo</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsVenueModalOpen(false)}
                  className="rounded-xl border border-line-strong px-4 py-2.5 text-xs font-bold text-fg-muted hover:bg-subtle"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50"
                >
                  {editingVenueId ? 'Simpan Perubahan' : 'Terbitkan Venue Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KELOLA LAPANGAN PADA VENUE */}
      {activeVenueForFields && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-3xl rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">
                    Manajemen Lapangan: {activeVenueForFields.name}
                  </h3>
                  <p className="text-xs text-fg-muted">
                    Tambah atau hapus lapangan pada venue ini beserta tarif sewanya
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveVenueForFields(null)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {/* Existing Fields Table */}
              <div>
                <h4 className="text-xs font-extrabold uppercase text-fg-muted mb-3 tracking-wider">
                  Daftar Lapangan yang Sudah Aktif
                </h4>
                {activeVenueForFields.fields?.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-field p-6 text-center text-xs text-fg-faint">
                    Belum ada lapangan yang ditambahkan pada venue ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-line bg-field text-[11px] font-extrabold uppercase text-fg-muted">
                        <tr>
                          <th className="p-3">Nama Lapangan</th>
                          <th className="p-3">Cabang Olahraga</th>
                          <th className="p-3">Tipe &amp; Lantai</th>
                          <th className="p-3">Tarif Kategori</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line bg-surface font-medium">
                        {activeVenueForFields.fields.map((f: any) => (
                          <tr
                            key={f.id}
                            className={`hover:bg-surface-soft ${
                              editingFieldId === f.id ? 'bg-emerald-50' : ''
                            }`}
                          >
                            <td className="p-3 font-bold text-fg">{f.name}</td>
                            <td className="p-3">
                              <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                {f.sportType}
                              </span>
                            </td>
                            <td className="p-3 text-fg-subtle">
                              {f.type} • {f.floorType}
                            </td>
                            <td className="p-3">
                              {f.rates?.length ? (
                                <div className="space-y-0.5">
                                  <div className="text-[10px] font-bold text-emerald-700">
                                    {f.rates.length} tarif kategori
                                  </div>
                                  <div className="text-[10px] text-fg-muted">
                                    {formatRupiah(Math.min(...f.rates.map((r: any) => r.price)))} -{' '}
                                    {formatRupiah(Math.max(...f.rates.map((r: any) => r.price)))}
                                  </div>
                                  <details className="group">
                                    <summary className="cursor-pointer text-[10px] font-bold text-fg-subtle hover:text-emerald-700">
                                      Lihat rincian
                                    </summary>
                                    <ul className="mt-1 space-y-0.5 border-l-2 border-line pl-2">
                                      {f.rates.map((r: any) => (
                                        <li key={r.id} className="text-[10px] text-fg-muted">
                                          <span className="font-bold text-fg-subtle">
                                            {r.label || getUserCategoryLabel(r.category as UserCategory, f.sportType)}
                                          </span>{' '}
                                          {r.timeStart
                                            ? `${r.timeStart} - ${r.timeEnd}`
                                            : 'sepanjang hari'}{' '}
                                          · {formatRupiah(r.price)} /{' '}
                                          {f.sportType === 'RENANG' && r.unit === 'PER_JAM' ? 'orang / jam' : (RATE_UNIT_LABELS[r.unit as RateUnit] ?? r.unit)}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                </div>
                              ) : (
                                <div className="text-[10px] text-fg-muted">
                                  <div className="font-bold text-fg-subtle">Belum ada tarif kategori</div>
                                  <div className="text-emerald-700">
                                    {formatRupiah(f.priceNonPeak)} / {formatRupiah(f.pricePeak)}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditField(f)}
                                  className="rounded-lg border border-blue-200 bg-blue-50 p-1.5 text-blue-700 transition hover:bg-blue-100"
                                  title="Edit Lapangan & Tarif"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteField(f)}
                                  className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 transition hover:bg-red-100"
                                  title="Hapus Lapangan"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Form Tambah Lapangan Baru */}
              <div className="rounded-2xl border border-line bg-field p-5">
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                  <Plus className="h-4 w-4" />
                  {editingFieldId ? 'Edit Lapangan' : 'Tambah Lapangan Baru ke Venue Ini'}
                </h4>

                <form onSubmit={handleSaveField} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">Nama Lapangan</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Lapangan Futsal A (Vinyl)"
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        className="w-full rounded-xl border border-line-strong bg-surface p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">Cabang Olahraga</label>
                      <select
                        value={fieldSportType}
                        onChange={(e) => {
                          const next = e.target.value as SportCategory;
                          setFieldSportType(next);
                          // Buang baris tarif yang kategorinya tidak lagi relevan
                          // untuk cabang olahraga yang baru dipilih.
                          const allowed = categoriesForSport(next);
                          setFieldRates((prev) => {
                            const kept = prev.filter((r) => allowed.includes(r.category));
                            return kept.length === prev.length
                              ? prev
                              : kept.map((r) => ({ ...r, category: allowed[0] }));
                          });
                        }}
                        className="w-full rounded-xl border border-line-strong bg-surface p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                      >
                        {SPORT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">Tipe Area</label>
                      <select
                        value={fieldType}
                        onChange={(e) => setFieldType(e.target.value)}
                        className="w-full rounded-xl border border-line-strong bg-surface p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                      >
                        <option value="Indoor">Indoor (Dalam Ruangan)</option>
                        <option value="Outdoor">Outdoor (Luar Ruangan)</option>
                        <option value="Semi-Outdoor">Semi-Outdoor (Beratap Terbuka)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">Jenis Lantai / Permukaan</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Rumput Sintetis / Vinyl Taraflex / Hardcourt"
                        value={fieldFloorType}
                        onChange={(e) => setFieldFloorType(e.target.value)}
                        className="w-full rounded-xl border border-line-strong bg-surface p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">
                        Tarif Siang / Non-Peak (cadangan)
                      </label>
                      <input
                        type="number"
                        value={fieldRates.length ? 'Otomatis dari tarif' : priceNonPeak}
                        disabled={fieldRates.length > 0}
                        onChange={(e) => setPriceNonPeak(Number(e.target.value))}
                        className="w-full rounded-xl border border-line-strong bg-surface p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500 disabled:bg-subtle disabled:text-fg-muted"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">
                        Tarif Malam / Peak Hour (cadangan)
                      </label>
                      <input
                        type="number"
                        value={fieldRates.length ? 'Otomatis dari tarif' : pricePeak}
                        disabled={fieldRates.length > 0}
                        onChange={(e) => setPricePeak(Number(e.target.value))}
                        className="w-full rounded-xl border border-line-strong bg-surface p-2.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500 disabled:bg-subtle disabled:text-fg-muted"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] leading-relaxed text-fg-muted">
                    Dua kolom di atas dipakai sebagai cadangan untuk lapangan yang belum
                    punya tarif kategori. Begitu tarif di bawah diisi, keduanya dihitung
                    otomatis dari rentang tarif terkecil dan terbesar.
                  </p>

                  {/* Tarif per kategori pengguna */}
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                          <DollarSign className="h-4 w-4" />
                          Tarif per Kategori Pengguna
                        </h5>
                        <p className="mt-0.5 text-[10px] text-fg-muted">
                          Kategori yang tersedia untuk{' '}
                          <span className="font-bold">{fieldSportType.replace(/_/g, ' ')}</span>:{' '}
                          {availableCategories.map((c) => USER_CATEGORY_LABELS[c]).join(', ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={applyStadiumPreset}
                          className="rounded-lg border border-emerald-200 bg-surface px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Isi Paket Stadion
                        </button>
                        <button
                          type="button"
                          onClick={() => addRateRow(availableCategories[0])}
                          className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[11px] font-bold text-fg-subtle transition hover:bg-subtle"
                        >
                          + Tambah Baris
                        </button>
                      </div>
                    </div>

                    {fieldRates.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line-strong bg-surface p-4 text-center text-[11px] text-fg-muted">
                        Belum ada tarif kategori. Tekan{' '}
                        <span className="font-bold text-emerald-700">Isi Paket Stadion</span>{' '}
                        untuk lapangan stadion, atau{' '}
                        <span className="font-bold text-fg-subtle">+ Tambah Baris</span> untuk
                        mengisi manual.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {fieldRates.map((row, idx) => (
                          <div
                            key={row.key}
                            className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-surface p-2.5 sm:grid-cols-12 sm:items-end"
                          >
                            <div className="sm:col-span-3">
                              <label className="mb-1 block text-[10px] font-bold uppercase text-fg-muted">
                                Kategori
                              </label>
                              <select
                                value={row.category}
                                onChange={(e) =>
                                  updateRateRow(row.key, {
                                    category: e.target.value as UserCategory,
                                  })
                                }
                                className="w-full rounded-lg border border-line-strong bg-surface p-2 text-[11px] font-semibold text-fg outline-none focus:border-emerald-500"
                              >
                                {availableCategories.map((c) => (
                                  <option key={c} value={c}>
                                    {USER_CATEGORY_LABELS[c]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="sm:col-span-3">
                              <label className="mb-1 block text-[10px] font-bold uppercase text-fg-muted">
                                Rentang Waktu
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={row.timeStart}
                                  onChange={(e) =>
                                    updateRateRow(row.key, { timeStart: e.target.value })
                                  }
                                  className="w-full rounded-lg border border-line-strong bg-surface p-2 text-[11px] font-semibold text-fg outline-none focus:border-emerald-500"
                                />
                                <span className="text-[10px] text-fg-muted">-</span>
                                <input
                                  type="time"
                                  value={row.timeEnd}
                                  onChange={(e) =>
                                    updateRateRow(row.key, { timeEnd: e.target.value })
                                  }
                                  className="w-full rounded-lg border border-line-strong bg-surface p-2 text-[11px] font-semibold text-fg outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>

                            <div className="sm:col-span-3">
                              <label className="mb-1 block text-[10px] font-bold uppercase text-fg-muted">
                                Tarif (Rp)
                              </label>
                              <input
                                type="number"
                                placeholder="Contoh: 55000000"
                                value={row.price}
                                onChange={(e) =>
                                  updateRateRow(row.key, { price: e.target.value })
                                }
                                className="w-full rounded-lg border border-line-strong bg-surface p-2 text-[11px] font-semibold text-fg outline-none focus:border-emerald-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-[10px] font-bold uppercase text-fg-muted">
                                Satuan
                              </label>
                              <select
                                value={row.unit}
                                onChange={(e) =>
                                  updateRateRow(row.key, { unit: e.target.value as RateUnit })
                                }
                                className="w-full rounded-lg border border-line-strong bg-surface p-2 text-[11px] font-semibold text-fg outline-none focus:border-emerald-500"
                              >
                                {(Object.keys(RATE_UNIT_LABELS) as RateUnit[]).map((u) => (
                                  <option key={u} value={u}>
                                    {RATE_UNIT_LABELS[u]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex justify-end sm:col-span-1">
                              <button
                                type="button"
                                onClick={() => removeRateRow(row.key)}
                                className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                                title="Hapus baris tarif"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                          <span className="font-semibold text-fg-muted">
                            {fieldRates.length} baris tarif
                            {fieldRates.length > 0 && fieldRates.every((r) => r.price !== '' && Number(r.price) > 0)
                              ? ` · total ${formatRupiah(
                                  fieldRates.reduce((s, r) => s + Number(r.price || 0), 0)
                                )} per kategori/waktu`
                              : ' · lengkapi nominal yang masih kosong'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFieldRates([])}
                            className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 font-bold text-fg-subtle transition hover:bg-subtle"
                          >
                            Kosongkan Tarif
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    {(editingFieldId || fieldRates.length > 0 || fieldName) && (
                      <button
                        type="button"
                        onClick={resetFieldForm}
                        className="rounded-xl border border-line-strong px-4 py-2.5 text-xs font-bold text-fg-subtle transition hover:bg-subtle"
                      >
                        Batal / Reset
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {editingFieldId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      <span>{editingFieldId ? 'Simpan Perubahan' : 'Tambahkan Lapangan'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setActiveVenueForFields(null)}
                className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-subtle hover:bg-subtle"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
