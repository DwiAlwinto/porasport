"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  BellRing,
  RefreshCw,
  Check,
  X,
  ArrowRight,
  Landmark,
  Calendar,
  Lock,
  FileCheck2,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onClick={onClose}
    >
      {/* Modal Dialog Card */}
      <div
        className="relative my-auto w-full max-w-xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden text-slate-800 transition-all transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pemda-terms-title"
      >
        {/* Sleek Emerald & Gold Hairline Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500" />

        {/* Modal Header */}
        <div className="relative px-6 pt-5 pb-4 sm:px-7 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Crest Badge */}
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/80">
                <Image
                  src="/images/logo.png"
                  alt="Lambang Kabupaten Bekasi"
                  width={38}
                  height={38}
                  className="object-contain"
                  priority
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">
                  <Landmark className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Pemkab Bekasi • DISBUDPORA</span>
                </div>
                <h3
                  id="pemda-terms-title"
                  className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug"
                >
                  Ketentuan Pemesanan Fasilitas Olahraga
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Informasi transparansi jadwal &amp; jaminan perlindungan penyewa
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Tutup dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="px-6 py-5 sm:px-7 space-y-3.5 max-h-[calc(84vh-140px)] overflow-y-auto">
          {/* Reservation Context Strip */}
          {(venueName || bookingDate) && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <MapPin className="h-3 w-3 text-emerald-600" />
                  Fasilitas Terpilih
                </div>
                <div className="font-extrabold text-slate-900">
                  {venueName} {fieldNames ? `• ${fieldNames}` : ''}
                </div>
                {bookingDate && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    <span>{bookingDate}</span>
                  </div>
                )}
              </div>

              {totalCostFormatted && (
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total Tarif
                  </div>
                  <div className="font-black text-emerald-700 text-sm sm:text-base">
                    {totalCostFormatted}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Official Government Notice (Requested Exact Statement) */}
          <div className="relative rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-4 sm:p-4.5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs">
                <FileCheck2 className="h-4.5 w-4.5" />
              </div>

              <div className="space-y-1.5 text-xs text-slate-800 leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-amber-950 text-xs sm:text-sm">
                    Pemberitahuan Agenda Resmi Kedinasan
                  </span>
                  <span className="rounded-md bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900">
                    Penting
                  </span>
                </div>

                <p className="text-slate-700 font-medium leading-relaxed sm:text-[12.5px]">
                  Dengan melanjutkan pemesanan fasilitas olahraga Kabupaten Bekasi ini, Anda memahami dan menyetujui bahwa jadwal penggunaan <strong className="text-slate-900 font-bold">dapat dijadwalkan ulang ke tanggal lain</strong> apabila terdapat <strong className="text-slate-900 font-extrabold">agenda resmi Pemerintah Daerah</strong> pada waktu yang bersamaan.
                </p>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-900 font-semibold pt-0.5">
                  <Info className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <span>
                    Kami akan menginformasikan penyesuaian jadwal tersebut kepada Anda melalui pemberitahuan lebih lanjut.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Citizen Protection Micro-Cards */}
          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-extrabold uppercase tracking-wider text-slate-500">
                Jaminan Hak Perlindungan Penyewa:
              </span>
              <span className="font-semibold text-emerald-700 text-[10px]">
                100% Bebas Biaya Penyesuaian
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {/* Pillar 1 */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs mb-2">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-emerald-950">
                    Reschedule Gratis
                  </h4>
                  <p className="mt-1 text-[11px] text-emerald-800/90 leading-snug">
                    Bebas ganti tanggal dalam 30 hari tanpa potongan biaya.
                  </p>
                </div>
              </div>

              {/* Pillar 2 */}
              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs mb-2">
                    <BellRing className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-teal-950">
                    Notifikasi Terpadu
                  </h4>
                  <p className="mt-1 text-[11px] text-teal-800/90 leading-snug">
                    Info dikirim ke WhatsApp &amp; menu Pesanan Akun Anda.
                  </p>
                </div>
              </div>

              {/* Pillar 3 */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-white shadow-xs mb-2">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Sewa Sah Kas Daerah
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-600 leading-snug">
                    Pembayaran sah dan tercatat resmi pada kas Pemkab.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Checkbox Agreement */}
          <div
            onClick={() => setHasAgreed(!hasAgreed)}
            className={`mt-1 flex items-start gap-3 rounded-2xl border p-3.5 transition-all cursor-pointer select-none ${
              hasAgreed
                ? 'border-emerald-500 bg-emerald-50/70 shadow-2xs ring-1 ring-emerald-500/30'
                : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                hasAgreed
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {hasAgreed && <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </div>

            <div className="space-y-0.5">
              <label className="text-xs font-bold text-slate-800 leading-snug cursor-pointer block">
                Saya telah memahami dan menyetujui ketentuan agenda resmi Pemerintah Daerah Kabupaten Bekasi.
              </label>
              <p className="text-[10px] text-slate-400">
                {hasAgreed
                  ? '✓ Persetujuan telah dikonfirmasi. Anda dapat melanjutkan ke pembayaran.'
                  : 'Centang kotak ini untuk mengaktifkan tombol lanjut ke pembayaran.'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer (Clean & Seamless, No dark bottom bar) */}
        <div className="px-6 py-4 sm:px-7 border-t border-slate-100 bg-slate-50/70 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition text-center"
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
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 shadow-sm ${
              hasAgreed
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/25 hover:shadow-md active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {!hasAgreed && <Lock className="h-3.5 w-3.5 opacity-60" />}
            <span>Setuju &amp; Lanjutkan Pemesanan</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
