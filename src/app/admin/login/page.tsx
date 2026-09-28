"use client";

import React, { useState, useTransition } from 'react';
import { Lock, Mail, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { adminLoginAction } from '../../../actions/authActions';

export default function AdminLoginPage() {
  // Kosongkan form: kredensial admin tidak boleh ikut terkirim ke browser.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const res = await adminLoginAction({ email, password });
      if (res.success) {
        // Berhasil login -> reload page untuk memastikan cookie terkirim
        window.location.href = '/admin';
      } else {
        setErrorMessage(res.error || 'Login gagal, periksa email dan kata sandi Anda.');
      }
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/70 px-4 py-12 selection:bg-emerald-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-amber-100/50 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/60">
          {/* Top gradient accent */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          <div className="px-7 pb-8 pt-10 sm:px-9 sm:pb-9">
            {/* Header Branding */}
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-200/80 bg-gradient-to-tr from-white to-slate-50 p-2 shadow-lg shadow-slate-200/50">
                <img
                  src="/images/logo.png"
                  alt="Logo DISBUDPORA Sport Bekasi"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-[28px]">
                Portal Admin CMS
              </h1>
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                DISBUDPORA Kabupaten Bekasi &bull; Sistem Manajemen Fasilitas
              </p>
            </div>

            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600 animate-in fade-in">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5 text-xs">
              <div>
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  Email Kedinasan / Akun Admin
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="admin@sportbekasi.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 shadow-sm outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    Kata Sandi
                  </label>
                  <span className="text-[10px] font-medium text-slate-400">
                    Akses terenkripsi
                  </span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs font-semibold text-slate-900 shadow-sm outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 hover:shadow-xl hover:shadow-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{isPending ? 'Memverifikasi Akses...' : 'Masuk ke Portal Admin'}</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>
              </div>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] font-medium leading-relaxed text-slate-400">
          Hak akses terbatas. Seluruh aktivitas pada portal ini tercatat dalam log audit sistem.
        </p>
      </div>
    </div>
  );
}
