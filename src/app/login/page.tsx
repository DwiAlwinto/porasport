"use client";

import React, { useState, useEffect, Suspense, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Sparkles,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { loginUserAction, getCurrentUserAction } from '../../actions/userAuthActions';
import { safeReturnUrl } from '../../lib/safeUrl';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));
  const errorMessage = searchParams.get('error');
  const infoParam = searchParams.get('info');
  const emailParam = searchParams.get('email') || '';
  const hasAccountParam =
    searchParams.get('has_account') === 'true' || searchParams.get('registered') === 'true';
  const isGoogleDevMode = searchParams.get('google_dev_mode') === 'true';
  const stateParam = searchParams.get('state') || '';

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(Boolean(emailParam || infoParam));
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(errorMessage || null);
  const [isPending, startTransition] = useTransition();

  // State untuk Dev Simulator Google jika belum ada Google Client ID di .env
  const [devEmail, setDevEmail] = useState('budi.santoso@gmail.com');
  const [devName, setDevName] = useState('Budi Santoso');

  // Guard: Pengalihan pintar untuk pengguna yang sudah login
  useEffect(() => {
    let isMounted = true;

    getCurrentUserAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.user) {
          router.replace(returnUrl || '/dashboard');
          return;
        }

        // Tandai has_registered jika datang dari register atau login langsung
        if (hasAccountParam || infoParam === 'already_registered' || emailParam) {
          try {
            localStorage.setItem('has_registered', 'true');
            document.cookie = 'has_registered=true; path=/; max-age=31536000';
          } catch (e) {}
        }

        setIsCheckingSession(false);
      })
      .catch(() => {
        if (isMounted) setIsCheckingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [hasAccountParam, infoParam, emailParam, returnUrl, router]);

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim() || !password) {
      setFormError('Silakan isi alamat email dan kata sandi Anda.');
      return;
    }

    startTransition(async () => {
      const res = await loginUserAction({ email, password });
      if (res.success) {
        try {
          localStorage.setItem('has_registered', 'true');
          document.cookie = 'has_registered=true; path=/; max-age=31536000';
        } catch (e) {}
        router.push(returnUrl || '/dashboard');
        router.refresh();
      } else {
        setFormError(res.error || 'Email atau kata sandi tidak sesuai.');
      }
    });
  };

  const handleSimulateGoogleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!devEmail || !devName) return;
    window.location.href = `/api/auth/google/callback?state=${encodeURIComponent(
      stateParam
    )}&dev_email=${encodeURIComponent(devEmail)}&dev_name=${encodeURIComponent(devName)}`;
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#05BB75] border-t-transparent" />
          <span>Memeriksa status akun...</span>
        </div>
      </div>
    );
  }

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
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
          
          {/* Left Column: Athletic Visual Banner */}
          <div className="lg:col-span-6 relative p-8 flex flex-col justify-between overflow-hidden bg-slate-900 text-white">
            <img
              src="/images/login-banner.jpg"
              alt="Sport Athlete"
              className="absolute inset-0 h-full w-full object-cover object-top opacity-75 transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-black/30" />

           

            {/* Bottom Inspiring Quote */}
            <div className="relative z-10 space-y-2">
              <h3 className="text-2xl font-black tracking-tight leading-snug">
                Olahraga Lebih Nyaman & Terjadwal
              </h3>
              <p className="text-xs text-slate-200/90 leading-relaxed font-medium">
                Pesan lapangan stadion, mini soccer, basket, badminton, hingga renang di Kabupaten Bekasi hanya dengan sekali klik.
              </p>
            </div>
          </div>

          {/* Right Column: Authentication Panel */}
          <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center">
            
            {/* Header Title & Subtitle */}
            <div className="space-y-3 mb-6">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                Selamat Datang.
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Ribuan orang telah merasakan pengalaman seru berolahraga bersama kami. Sekarang giliran kamu! —{' '}
                <span className="font-bold text-[#05BB75]">disbudpora sport</span>.
              </p>
              <div className="h-1 w-10 bg-[#05BB75] rounded-full" />
            </div>

            {/* Notification jika dialihkan dari register karena sudah terdaftar */}
            {infoParam === 'already_registered' && !formError && (
              <div className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs shadow-sm">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-950">
                      Perangkat Anda sudah terdaftar di sistem DISBUDPORA.
                    </p>
                    <p className="text-emerald-800 text-[11px] leading-relaxed">
                      Silakan masuk dengan email dan kata sandi Anda untuk melanjutkan.
                    </p>
                    <div className="pt-1">
                      <Link
                        href={`/register?new_account=true&returnUrl=${encodeURIComponent(returnUrl)}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                      >
                        <span>Ingin mendaftarkan akun baru dengan email lain?</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Notification */}
            {formError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{formError}</span>
                </div>
                {formError.toLowerCase().includes('belum terdaftar') && (
                  <div className="pt-1 border-t border-red-200/60 ml-6.5">
                    <Link
                      href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`}
                      className="inline-flex items-center gap-1.5 font-extrabold text-[#05BB75] hover:text-[#049a60] hover:underline text-xs"
                    >
                      <span>Daftar (Register) Akun Sekarang</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Google Dev Mode Simulator Modal / Alert */}
            {isGoogleDevMode && (
              <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <Info className="h-4 w-4 text-amber-600" />
                  <span>Mode Pengujian Google OAuth (Lokal)</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Kredensial <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">GOOGLE_CLIENT_ID</code> belum diisi di file <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env</code>. Anda dapat menguji login akun Google simulasi berikut ini:
                </p>
                <form onSubmit={handleSimulateGoogleLogin} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nama Lengkap Google"
                    value={devName}
                    onChange={(e) => setDevName(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    type="email"
                    placeholder="nama@gmail.com"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-amber-600 py-2 text-xs font-black text-white hover:bg-amber-700 transition"
                  >
                    Simulasikan Masuk dengan Akun Google Ini
                  </button>
                </form>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3.5">
              
              {/* 1. Official Google Login Button */}
              <a
                href={`/api/auth/google?mode=login&returnUrl=${encodeURIComponent(returnUrl)}`}
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

              {/* 2. Login With Email Toggle Button */}
              {!showEmailForm ? (
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 hover:border-slate-400 bg-white py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-all active:scale-[0.99]"
                >
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span>Login dengan Email</span>
                </button>
              ) : (
                /* Email & Password Form */
                <form onSubmit={handleEmailLogin} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Email Akun
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Kata Sandi
                      </label>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-11 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#05BB75] focus:border-transparent transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 transition"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#05BB75] hover:bg-[#049a60] py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    {isPending ? (
                      <span>Memverifikasi...</span>
                    ) : (
                      <>
                        <span>Masuk</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="w-full text-center text-[11px] font-semibold text-slate-500 hover:text-slate-800 pt-1"
                  >
                    Batal masuk via email
                  </button>
                </form>
              )}
            </div>

            {/* Switch to Register */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Kamu belum punya akun?{' '}
                <Link
                  href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`}
                  className="font-extrabold text-[#05BB75] hover:text-[#049a60] hover:underline"
                >
                  Register di sini
                </Link>
              </p>
            </div>

            {/* Legal Notice */}
            <p className="mt-5 text-center text-[10px] text-slate-400 leading-relaxed">
              Dengan melanjutkan, berarti Kamu menyetujui{' '}
              <span className="font-semibold text-slate-600">Kebijakan Privasi</span> dan{' '}
              <span className="font-semibold text-slate-600">Ketentuan Layanan</span> DISBUDPORA Kab. Bekasi.
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-500">Memuat Halaman...</div>}>
      <LoginContent />
    </Suspense>
  );
}
