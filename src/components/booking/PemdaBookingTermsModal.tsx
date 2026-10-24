"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  CalendarCheck2,
  BellRing,
  RefreshCw,
  Check,
  X,
  ArrowRight,
  Landmark,
  Calendar,
  Lock,
  FileCheck2,
  Sparkles,
  MapPin,
  Info,
} from 'lucide-react';

interface PemdaBookingTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgreeAndProceed: () => void;
  venueName?: string;
  fieldNames?: string;
  bookingDate?: string;
  totalCostFormatted?: string;
}

export const PemdaBookingTermsModal: React.FC<PemdaBookingTermsModalProps> = ({
  isOpen,
  onClose,
  onAgreeAndProceed,
  venueName,
  fieldNames,
  bookingDate,
  totalCostFormatted,
}) => {
  const [hasAgreed, setHasAgreed] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-300"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      {/* Modal Dialog Card */}
      <div
        className="relative my-auto w-full max-w-2xl rounded-[28px] sm:rounded-[32px] bg-white shadow-[0_30px_90px_-20px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/10 overflow-hidden text-slate-800 transition-all transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pemda-terms-modal-title"
      >
        {/* Luxury Tri-Color Metallic Accent Bar */}
        <div className="relative h-2 w-full bg-gradient-to-r from-emerald-600 via-amber-500 to-teal-700">
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
        </div>

        {/* Executive Header */}
        <div className="relative px-6 pt-6 pb-5 sm:px-8 border-b border-slate-100 bg-gradient-to-b from-stone-50/90 via-white to-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 sm:gap-4">
              {/* Crest Medallion with Gold Foil Trim */}
              <div className="relative flex h-13 w-13 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white via-amber-50/40 to-stone-100 p-2 shadow-[0_8px_20px_-6px_rgba(217,119,6,0.25)] ring-1 ring-amber-400/40">
                <Image
                  src="/images/logo.png"
                  alt="Lambang Kabupaten Bekasi"
                  width={42}
                  height={42}
                  className="object-contain drop-shadow-xs"
                  priority
                />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-600/20">
                    <Landmark className="h-3 w-3 text-emerald-700" />
                    Pemerintah Kabupaten Bekasi
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800 ring-1 ring-amber-600/20">
                    <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                    Disbudpora
                  </span>
                </div>
                <h3
                  id="pemda-terms-modal-title"
                  className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug"
                >
                  Ketentuan Pemesanan Sarana Olahraga
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tata tertib penyewaan aset daerah &amp; transparansi jadwal kedinasan
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="group -mr-1 -mt-1 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Tutup dialog"
            >
              <X className="h-5 w-5 transition group-hover:rotate-90 duration-200" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="px-6 py-5 sm:px-8 space-y-4 max-h-[calc(86vh-170px)] overflow-y-auto">
          {/* Reservation Ticket Strip (Boarding Pass / VIP Style) */}
          {(venueName || bookingDate) && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-3.5 sm:p-4 shadow-2xs">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 h-20 w-20 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <MapPin className="h-3 w-3 text-emerald-600" />
                    Fasilitas &amp; Lapangan Terpilih
                  </div>
                  <div className="text-xs sm:text-sm font-black text-slate-900">
                    {venueName}{' '}
                    {fieldNames && (
                      <span className="font-semibold text-slate-600">
                        • {fieldNames}
                      </span>
                    )}
                  </div>
                  {bookingDate && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      <span>{bookingDate}</span>
                    </div>
                  )}
                </div>

                {totalCostFormatted && (
                  <div className="sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Total Tarif Resmi
                    </div>
                    <div className="text-base sm:text-lg font-black text-emerald-700 tracking-tight">
                      {totalCostFormatted}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Termasuk PAD Daerah
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Core Official Covenant Card (Pernyataan Resmi Pemda) */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/80 via-white to-stone-50/70 p-4 sm:p-5 shadow-sm">
            {/* Subtle Watermark Stamp */}
            <div className="absolute -bottom-4 -right-4 pointer-events-none select-none opacity-5">
              <Image
                src="/images/logo.png"
                alt=""
                width={140}
                height={140}
                className="grayscale"
              />
            </div>

            <div className="flex items-start gap-3.5 relative z-10">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-200/80">
                <FileCheck2 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>

              <div className="space-y-2 text-xs leading-relaxed text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-amber-950 tracking-tight">
                    Pemberitahuan Agenda Resmi Kedinasan
                  </span>
                  <span className="rounded-md bg-amber-200/60 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-900">
                    Penting
                  </span>
                </div>

                <div className="rounded-xl bg-white/80 p-3 sm:p-3.5 border border-amber-200/60 shadow-2xs font-medium text-slate-700 space-y-2">
                  <p className="leading-relaxed sm:text-[13px]">
                    Dengan melanjutkan pemesanan fasilitas olahraga Kabupaten Bekasi ini, Anda memahami dan menyetujui bahwa jadwal penggunaan <span className="font-bold text-slate-900">dapat dijadwalkan ulang ke tanggal lain</span> apabila terdapat <strong className="font-extrabold text-slate-900 underline decoration-amber-400 decoration-2 underline-offset-2">agenda resmi Pemerintah Daerah</strong> pada waktu yang bersamaan.
                  </p>
                  <p className="text-[11px] sm:text-xs text-amber-900 font-semibold flex items-start gap-1.5 pt-1 border-t border-amber-100">
                    <Info className="h-3.5 w-3.5 shrink-0 text-amber-700 mt-0.5" />
                    <span>
                      Kami akan menginformasikan penyesuaian jadwal tersebut kepada Anda melalui pemberitahuan lebih lanjut.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Citizen Protection Micro-Cards (Pilar Kepastian Hak Warga) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                3 Jaminan Hak Perlindungan Penyewa:
              </span>
              <span className="text-[10px] font-semibold text-emerald-700">
                100% Dilindungi Disbudpora
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Pillar 1 */}
              <div className="group relative rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/60 to-white p-3.5 transition-all hover:border-emerald-400 hover:shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm mb-2.5 group-hover:scale-105 transition">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-black text-emerald-950">
                    Reschedule 100% Gratis
                  </h4>
                  <p className="mt-1 text-[11px] text-emerald-900/85 leading-snug">
                    Bebas memilih jadwal baru dalam kurun 30 hari tanpa denda atau biaya tambahan.
                  </p>
                </div>
                <div className="mt-2 text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                  Bebas Biaya Administrasi
                </div>
              </div>

              {/* Pillar 2 */}
              <div className="group relative rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/60 to-white p-3.5 transition-all hover:border-blue-400 hover:shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm mb-2.5 group-hover:scale-105 transition">
                    <BellRing className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-black text-blue-950">
                    Notifikasi Dini Terpadu
                  </h4>
                  <p className="mt-1 text-[11px] text-blue-900/85 leading-snug">
                    Pemberitahuan resmi dikirim ke WhatsApp aktif dan notifikasi akun dashboard Anda.
                  </p>
                </div>
                <div className="mt-2 text-[9px] font-bold text-blue-700 uppercase tracking-wider">
                  Prioritas Informasi
                </div>
              </div>

              {/* Pillar 3 */}
              <div className="group relative rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50/80 to-white p-3.5 transition-all hover:border-slate-400 hover:shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm mb-2.5 group-hover:scale-105 transition">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-black text-slate-900">
                    Legalitas Kas Daerah
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-600 leading-snug">
                    Pembayaran sewa Anda sah dan tercatat pada kas daerah Pemkab Bekasi.
                  </p>
                </div>
                <div className="mt-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  Bukti Reservasi Sah
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Checkbox Agreement with Luxury Tactile Feedback */}
          <div
            onClick={() => setHasAgreed(!hasAgreed)}
            className={`group relative mt-1 flex items-start gap-3.5 rounded-2xl border p-4 transition-all duration-200 cursor-pointer select-none ${
              hasAgreed
                ? 'border-emerald-500 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/40 shadow-sm ring-1 ring-emerald-500/30'
                : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
                hasAgreed
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm scale-105'
                  : 'border-slate-300 bg-white group-hover:border-slate-400'
              }`}
            >
              {hasAgreed ? (
                <Check className="h-3.5 w-3.5 stroke-[3] animate-in zoom-in-50 duration-150" />
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs sm:text-[13px] font-bold text-slate-800 leading-snug cursor-pointer block">
                Saya telah membaca, memahami, dan menyetujui ketentuan agenda resmi kedinasan Pemerintah Daerah Kabupaten Bekasi.
              </label>
              <p className="text-[10px] text-slate-400">
                {hasAgreed
                  ? '✓ Persetujuan telah dikonfirmasi. Anda dapat melanjutkan ke langkah pembayaran.'
                  : 'Centang kotak di atas sebagai tanda persetujuan untuk mengaktifkan tombol lanjut.'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 sm:px-8 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition text-center"
          >
            Kembali / Pilih Waktu Lain
          </button>

          <button
            type="button"
            disabled={!hasAgreed}
            onClick={() => {
              if (hasAgreed) {
                onAgreeAndProceed();
              }
            }}
            className={`w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-md ${
              hasAgreed
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-800 text-white shadow-emerald-600/30 hover:shadow-lg active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {!hasAgreed && <Lock className="h-3.5 w-3.5 opacity-60" />}
            <span>Setuju &amp; Lanjutkan Pemesanan</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Institutional Sub-Footer Bar */}
        <div className="bg-slate-900 px-6 py-2 sm:px-8 text-center text-[10px] text-slate-400 font-medium tracking-wide flex items-center justify-center gap-2">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span>Sistem Resmi Reservasi Sarana Olahraga Pemerintah Kabupaten Bekasi</span>
        </div>
      </div>
    </div>
  );
};
