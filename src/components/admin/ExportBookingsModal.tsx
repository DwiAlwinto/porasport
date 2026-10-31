"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { getAdminBookings, getAdminVenuesWithFields } from '@/actions/adminActions';
import { exportBookingsToExcel, exportBookingsToCSV } from '@/utils/exportBookingsToExcel';

interface ExportBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminName?: string;
  currentSearch?: string;
  currentStatusFilter?: string;
  cachedBookings?: any[];
}

export const ExportBookingsModal: React.FC<ExportBookingsModalProps> = ({
  isOpen,
  onClose,
  adminName,
  currentSearch = '',
  currentStatusFilter = 'ALL',
  cachedBookings = [],
}) => {
  const [periodPreset, setPeriodPreset] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('MONTH');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(currentStatusFilter || 'ALL');
  const [venueIdFilter, setVenueIdFilter] = useState<string>('ALL');
  const [exportFormat, setExportFormat] = useState<'XLSX' | 'CSV'>('XLSX');
  
  const [venues, setVenues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewStats, setPreviewStats] = useState<{ count: number; revenue: number } | null>(null);

  // Set default dates based on preset
  useEffect(() => {
    const today = new Date();
    const formatYmd = (d: Date) => d.toISOString().slice(0, 10);

    if (periodPreset === 'TODAY') {
      const todayStr = formatYmd(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (periodPreset === 'WEEK') {
      const pastWeek = new Date();
      pastWeek.setDate(pastWeek.getDate() - 7);
      setStartDate(formatYmd(pastWeek));
      setEndDate(formatYmd(today));
    } else if (periodPreset === 'MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatYmd(firstDay));
      setEndDate(formatYmd(today));
    } else if (periodPreset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  }, [periodPreset]);

  // Load venues list for filter
  useEffect(() => {
    if (isOpen && venues.length === 0) {
      getAdminVenuesWithFields().then((res) => {
        if (res && res.length > 0) setVenues(res);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsLoading(true);
    try {
      // Ambil data lengkap sesuai filter yang ditentukan di modal
      const data = await getAdminBookings({
        status: statusFilter,
        venueId: venueIdFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: currentSearch || undefined,
      });

      const selectedVenue = venues.find((v) => v.id === venueIdFilter);
      const venueLabel = venueIdFilter === 'ALL' ? 'Semua Venue (Kab. Bekasi)' : (selectedVenue?.name || venueIdFilter);

      let periodLabel = 'Semua Riwayat Waktu';
      if (periodPreset === 'TODAY') periodLabel = `Hari Ini (${startDate})`;
      else if (periodPreset === 'WEEK') periodLabel = `7 Hari Terakhir (${startDate} s/d ${endDate})`;
      else if (periodPreset === 'MONTH') periodLabel = `Bulan Ini (${startDate} s/d ${endDate})`;
      else if (periodPreset === 'CUSTOM' && (startDate || endDate)) periodLabel = `${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`;

      const statusMap: Record<string, string> = {
        'ALL': 'Semua Status Transaksi',
        'PAID_SUCCESS': 'Khusus Lunas (PAD Sah)',
        'COMPLETED': 'Selesai Bermain',
        'MENUNGGU_VALIDASI': 'Menunggu Validasi Struk',
        'PENDING_PAYMENT': 'Menunggu Pembayaran',
        'CANCELLED': 'Dibatalkan / Ditolak',
      };
      const statusLabel = statusMap[statusFilter] || statusFilter;

      const meta = {
        periodLabel,
        statusLabel,
        venueLabel,
        adminName: adminName || 'Admin DISBUDPORA',
      };

      if (exportFormat === 'XLSX') {
        exportBookingsToExcel(data, meta);
      } else {
        exportBookingsToCSV(data, meta);
      }

      onClose();
    } catch (err) {
      console.error('Failed to export bookings:', err);
      alert('Terjadi kesalahan saat mengekspor data laporan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        
        {/* Accent Bar Emerald */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400" />

        {/* Modal Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-b from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-sm border border-emerald-200">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                <span>DISBUDPORA KAB. BEKASI</span>
                <span>•</span>
                <span>MODUL LAPORAN FINANSIAL</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Ekspor Laporan Retribusi &amp; Pendapatan
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Format resmi ber-kop instansi, ringkasan PAD, dan 19 kolom audit detail.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scroll text-xs">
          
          {/* Preset Periode Tanggal */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-emerald-700" />
              <span>Rentang Waktu Transaksi:</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-bold text-[11px]">
              <button
                type="button"
                onClick={() => setPeriodPreset('TODAY')}
                className={`py-2 px-2.5 rounded-xl border transition text-center ${
                  periodPreset === 'TODAY'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('WEEK')}
                className={`py-2 px-2.5 rounded-xl border transition text-center ${
                  periodPreset === 'WEEK'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('MONTH')}
                className={`py-2 px-2.5 rounded-xl border transition text-center ${
                  periodPreset === 'MONTH'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('ALL')}
                className={`py-2 px-2.5 rounded-xl border transition text-center ${
                  periodPreset === 'ALL'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                Semua Waktu
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('CUSTOM')}
                className={`py-2 px-2.5 rounded-xl border transition text-center ${
                  periodPreset === 'CUSTOM'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                Pilih Tanggal
              </button>
            </div>

            {/* Custom Date Pickers */}
            {(periodPreset === 'CUSTOM' || periodPreset === 'MONTH' || periodPreset === 'WEEK') && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mulai Dari Tanggal:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPeriodPreset('CUSTOM');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sampai Dengan Tanggal:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPeriodPreset('CUSTOM');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Filter Status Transaksi */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-emerald-700" />
              <span>Status Transaksi yang Diekspor:</span>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            >
              <option value="ALL">Semua Status Transaksi (Audit Lengkap)</option>
              <option value="PAID_SUCCESS">✅ Khusus Transaksi LUNAS (Pendapatan Riil Masuk Kasda)</option>
              <option value="MENUNGGU_VALIDASI">⏳ Menunggu Validasi Struk Transfer (Antrean Kasir)</option>
              <option value="COMPLETED">🏆 Selesai Bermain</option>
              <option value="PENDING_PAYMENT">⏰ Menunggu Pembayaran (Belum Bayar)</option>
              <option value="CANCELLED">❌ Dibatalkan / Kedaluwarsa</option>
            </select>
          </div>

          {/* Filter Venue / Fasilitas */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-emerald-700" />
              <span>Fasilitas / Sarana Olahraga:</span>
            </label>
            <select
              value={venueIdFilter}
              onChange={(e) => setVenueIdFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            >
              <option value="ALL">Semua Venue &amp; Lapangan (Kabupaten Bekasi)</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.city || 'Kab. Bekasi'})
                </option>
              ))}
            </select>
          </div>

          {/* Pilihan Format Berkas */}
          <div className="space-y-1.5 pt-1">
            <label className="block font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-emerald-700" />
              <span>Pilihan Format Berkas:</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat('XLSX')}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition ${
                  exportFormat === 'XLSX'
                    ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  XLSX
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">Microsoft Excel (.xlsx)</div>
                  <div className="text-[10px] text-slate-500 leading-snug">Format resmi dengan Kop DISBUDPORA, Ringkasan Finansial PAD, &amp; Auto-Col Width.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('CSV')}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition ${
                  exportFormat === 'CSV'
                    ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="h-8 w-8 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  CSV
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">File CSV (.csv)</div>
                  <div className="text-[10px] text-slate-500 leading-snug">Format teks tabular universal untuk integrasi sistem database / SIPD BPKAD.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Info Card / Catatan Audit */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-[11px] text-emerald-950 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">Standar Akuntabilitas &amp; Audit Retribusi Daerah</div>
              <div className="text-emerald-800/90 text-[10.5px] leading-relaxed">
                Berkas yang diunduh mencakup NIK 16 digit pemesan, nomor registrasi tiket, rincian biaya sewa vs biaya layanan, serta rumus penjumlahan otomatis di akhir tabel.
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyiapkan Laporan...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Unduh Laporan ({exportFormat})</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
