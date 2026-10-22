"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Catat error ke console untuk debugging developer
    console.error('[Application Error Boundary caught error]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Header Bar */}
      <header className="w-full bg-white border-b border-slate-200 py-3.5 px-6 sm:px-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/images/logo.png"
            alt="Sport Bekasi"
            className="h-9 w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-slate-900 leading-none">
              disbudpora sport
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Kabupaten Bekasi
            </span>
          </div>
        </Link>
      </header>

      {/* Main Error Card */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 p-8 sm:p-10 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Terjadi Kendala Memuat Halaman
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Sistem mendeteksi adanya gangguan sementara pada peramban atau koneksi Anda.
              Silakan coba muat ulang halaman ini atau kembali ke beranda.
            </p>
          </div>

          {error?.digest && (
            <div className="rounded-lg bg-slate-100 p-2 text-[10px] text-slate-500 font-mono">
              ID Masalah: {error.digest}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                if (typeof reset === 'function') {
                  reset();
                } else {
                  window.location.reload();
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#05BB75] hover:bg-[#049a60] py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition-all active:scale-[0.99]"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Muat Ulang</span>
            </button>

            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-300 hover:border-slate-400 bg-white py-3 text-xs font-black uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-all active:scale-[0.99]"
            >
              <Home className="h-4 w-4" />
              <span>Ke Beranda</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-slate-400 font-medium">
        © 2026 Dinas Kebudayaan, Pemuda dan Olahraga (DISBUDPORA) Kabupaten Bekasi.
      </footer>
    </div>
  );
}
