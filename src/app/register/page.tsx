"use client";

import React, { useState, Suspense, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeReturnUrl } from '../../lib/safeUrl';
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { registerUserAction } from '../../actions/userAuthActions';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleEmailRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim() || !password) {
      setFormError('Nama lengkap, email, dan kata sandi wajib diisi.');
      return;
    }

    if (password.length < 6) {
      setFormError('Kata sandi minimal terdiri dari 6 karakter.');
      return;
    }

    startTransition(async () => {
      const res = await registerUserAction({
        name,
        email,
        phone,
        password,
      });

      if (res.success) {
        router.push(returnUrl);
        router.refresh();
      } else {
        setFormError(res.error || 'Gagal mendaftarkan akun. Silakan coba kembali.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Bar Navigation */}
      <header className="w-full bg-white border-b border-slate-200 py-3.5 px-6 sm:px-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <img
            src="/images/logo.png"
            alt="Sport Bekasi"
            className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
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

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </header>

      {/* Main Split Screen Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
          
          {/* Left Column: Sunset Basketball Visual Banner */}
          <div className="lg:col-span-6 relative p-8 flex flex-col justify-between overflow-hidden bg-slate-900 text-white">
            <img
              src="/images/register-banner.jpg"
              alt="Sports Community"
              className="absolute inset-0 h-full w-full object-cover object-center opacity-80 transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-black/30" />

           

            {/* Bottom Inspiring Quote */}
            <div className="relative z-10 space-y-2">
             
              <h3 className="text-2xl font-black tracking-tight leading-snug">
                Gabung Bersama Komunitas Olahraga Bekasi
              </h3>
              <p className="text-xs text-slate-200/90 leading-relaxed font-medium">
                Nikmati akses cepat pemesanan lapangan resmi, kemudahan pembayaran QRIS, dan transparansi jadwal real-time.
              </p>
            </div>
          </div>

          {/* Right Column: Registration Panel */}
          <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center">
            
            {/* Header Title & Subtitle */}
            <div className="space-y-3 mb-6">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                New Sports Experience.
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Ada ribuan orang yang suka berolahraga seperti kamu. Ayo mulai perjalanan berolahraga bersama —{' '}
                <span className="font-bold text-[#05BB75]">disbudpora sport
</span>.
              </p>
              <div className="h-1 w-10 bg-[#05BB75] rounded-full" />
            </div>

            {/* Error Notification */}
            {formError && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3.5">
              
              {/* 1. Official Google Register / Sign In Button */}
              <a
                href={`/api/auth/google?returnUrl=${encodeURIComponent(returnUrl)}`}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#1e293b] hover:bg-[#0f172a] text-white py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
              >
                {/* Official Google 'G' Icon */}
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.92H1.21v3.15C3.25 21.41 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.32 14.28c-.24-.72-.37-1.49-.37-2.28s.13-1.56.37-2.28V6.57H1.21C.44 8.11 0 9.99 0 12s.44 3.89 1.21 5.43l4.11-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.59 1.21 6.57l4.11 3.15c.94-2.82 3.58-4.97 6.68-4.97z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </a>

              {/* 2. Register With Email Toggle Button */}
              {!showEmailForm ? (
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 hover:border-slate-400 bg-white py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-all active:scale-[0.99]"
                >
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span>Register dengan Email</span>
                </button>
              ) : (
                /* Registration Input Form */
                <form onSubmit={handleEmailRegister} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Nama Lengkap
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: Muhammad Haidar"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#05BB75] focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Alamat Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#05BB75] focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      No. WhatsApp / HP (Opsional)
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="081234567890"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#05BB75] focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Kata Sandi (Min. 6 Karakter)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#05BB75] focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#05BB75] hover:bg-[#049a60] py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    {isPending ? (
                      <span>Mendaftarkan Akun...</span>
                    ) : (
                      <>
                        <span>Daftar Sekarang</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="w-full text-center text-[11px] font-semibold text-slate-500 hover:text-slate-800 pt-1"
                  >
                    Batal daftar via email
                  </button>
                </form>
              )}
            </div>

            {/* Switch to Login */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Sudah punya akun?{' '}
                <Link
                  href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
                  className="font-extrabold text-[#05BB75] hover:text-[#049a60] hover:underline"
                >
                  Login di sini
                </Link>
              </p>
            </div>

            {/* Legal Notice */}
            <p className="mt-5 text-center text-[10px] text-slate-400 leading-relaxed">
              Dengan melanjutkan, berarti Kamu menyetujui{' '}
              <span className="font-semibold text-slate-600">Kebijakan Privasi</span> dan{' '}
              <span className="font-semibold text-slate-600">Panduan Komunitas</span> DISBUDPORA Kab. Bekasi.
            </p>
          </div>
        </div>
      </main>

      {/* Footer minimal */}
      <footer className="py-4 text-center text-[11px] text-slate-400 font-medium">
        © 2026 Dinas Kebudayaan, Pemuda dan Olahraga (DISBUDPORA) Kabupaten Bekasi.
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-500">Memuat Halaman...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
