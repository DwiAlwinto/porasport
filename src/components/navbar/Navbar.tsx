import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  ShoppingCart,
  Database,
  ChevronDown,
  Menu,
  X,
  Globe,
  ShieldCheck,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { TRANSLATIONS } from '../../utils/translations';
import { LoginGateModal } from '../auth/LoginGateModal';
import { UserAvatar } from '../common/UserAvatar';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    activeUser,
    setActiveUser,
    setIsSchemaModalOpen,
    bookings,
    activeLang,
    setActiveLang,
    t,
    isLoggedIn,
    logoutUser,
  } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);

  const activeBookingsCount = bookings.filter(
    (b) => b.userId === activeUser?.id && (b.status === 'PENDING_PAYMENT' || b.status === 'PAID_SUCCESS')
  ).length;

  const handleNavClick = (view: 'HOME' | 'EXPLORE' | 'USER_DASHBOARD') => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-5 sm:px-8">
        
        {/* LEFT: Brand Logo */}
        <div
          onClick={() => handleNavClick('HOME')}
          className="flex cursor-pointer items-center gap-3"
        >
          <img 
            src="/images/logo.png" 
            alt="Sport Bekasi Logo" 
            className="h-14 w-auto object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="text-[22px] font-extrabold tracking-tighter text-[#213555] lowercase leading-none">
              disbudpora sport
            </span>
          </div>
        </div>

        {/* CENTER: Desktop Nav Links */}
        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex text-[13px] font-bold text-slate-500 tracking-wide">
          <button
            onClick={() => handleNavClick('HOME')}
            className={`transition hover:text-[#05BB75] ${activeView === 'HOME' ? 'text-[#05BB75]' : ''}`}
          >
            {t.nav.home}
          </button>
          <button
            onClick={() => handleNavClick('EXPLORE')}
            className={`transition hover:text-[#05BB75] ${(activeView === 'EXPLORE' || activeView === 'VENUE_DETAIL') ? 'text-[#05BB75]' : ''}`}
          >
            {t.nav.venue}
          </button>
        </nav>

        {/* RIGHT: Actions & Auth */}
        <div className="hidden items-center justify-end gap-5 md:flex flex-1">
          
          <div className="flex items-center gap-1">
            {/* 1. Language Dropdown (Paling Kiri di Group Kanan) */}
            <div className="relative">
            <button
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
            >
              <Globe className="h-4 w-4" />
              <span>{activeLang === 'ID' ? 'ID' : 'EN'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLangDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
                <button
                  onClick={() => { setActiveLang('ID'); setIsLangDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold transition ${activeLang === 'ID' ? 'bg-[#05BB75]/10 text-[#05BB75]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Bahasa Indonesia
                </button>
                <button
                  onClick={() => { setActiveLang('US'); setIsLangDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold transition ${activeLang === 'US' ? 'bg-[#05BB75]/10 text-[#05BB75]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  English (US)
                </button>
              </div>
            )}
          </div>

          {/* 2. Admin Panel Shortcut
              Membuka route /admin (server-side guarded), bukan state React.
              Sebelumnya tombol ini menyetel activeView sehingga seluruh panel
              admin ikut ter-bundle ke setiap pengunjung dan hanya "disembunyikan"
              oleh state yang bisa dibalik lewat devtools. */}
          {activeUser?.role === 'ADMIN' && (
            <a
              href="/admin"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black tracking-wide transition bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ring-1 ring-emerald-600/20"
            >
              <ShieldCheck className="h-4 w-4 text-[#05BB75]" />
              Admin Finansial
            </a>
          )}

          {/* 3. Shopping Cart */}
          <button
            onClick={() => {
              if (!isLoggedIn) {
                setShowLoginGate(true);
              } else {
                handleNavClick('USER_DASHBOARD');
              }
            }}
            className="group relative flex h-10 items-center gap-2 rounded-full px-3 text-slate-600 transition hover:bg-slate-100"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5 transition-transform group-hover:scale-110" />
              {activeBookingsCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {activeBookingsCount}
                </span>
              )}
            </div>
          </button>
          </div>

          {/* Vertical Divider */}
          <div className="h-6 w-px bg-slate-200"></div>

          {/* 4. Auth Buttons */}
          <div className="relative flex items-center gap-3">

            {isLoggedIn ? (
              /* User Profile Logged In Dropdown */
              <div className="relative">
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 px-3 shadow-sm hover:border-emerald-500/50 transition group"
                >
                  <UserAvatar
                    src={activeUser?.avatar}
                    name={activeUser?.name}
                    sizeClassName="h-7 w-7"
                  />
                  <div className="text-left hidden lg:block">
                    <div className="text-xs font-bold text-slate-800 truncate max-w-[110px] leading-tight">
                      {activeUser?.name?.split(' ')[0] || 'User'}
                    </div>
                    <div className="text-[9px] text-[#05BB75] font-black uppercase tracking-wider">
                      Penyewa
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 transition" />
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 z-50">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <div className="text-xs font-black text-slate-900 truncate">{activeUser?.name || 'User'}</div>
                      <div className="text-[11px] text-slate-500 truncate">{activeUser?.email || ''}</div>
                    </div>
                    <button
                      onClick={() => {
                        handleNavClick('USER_DASHBOARD');
                        setIsUserDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#05BB75] transition"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span>{t.nav.myBookings}</span>
                    </button>
                    <button
                      onClick={async () => {
                        await logoutUser();
                        setIsUserDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t.nav.logout}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Public Not Logged In: MASUK & DAFTAR (Warna Tombol Sesuai Aplikasi Kita) */
              <div className="flex items-center gap-2">
                <a
                  href="/login"
                  className="px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-700 hover:text-[#05BB75] transition"
                >
                  {t.nav.login}
                </a>
                <a
                  href="/register"
                  className="rounded-full bg-[#05BB75] hover:bg-[#049a60] px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm shadow-emerald-500/20 transition active:scale-95"
                >
                  {t.nav.register}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={() => handleNavClick('USER_DASHBOARD')}
            className="relative p-1 text-slate-500"
          >
            <ShoppingCart className="h-5 w-5" />
            {activeBookingsCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#05BB75] text-[9px] font-bold text-white">
                {activeBookingsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded p-1.5 text-slate-700 hover:bg-slate-100"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {isMobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden shadow-lg">
          <div className="space-y-1">
            <button
              onClick={() => handleNavClick('HOME')}
              className={`block w-full rounded px-3 py-2 text-left text-sm font-bold ${
                activeView === 'HOME' ? 'text-[#05BB75] bg-[#05BB75]/10' : 'text-slate-600'
              }`}
            >
              {t.nav.home}
            </button>
            <button
              onClick={() => handleNavClick('EXPLORE')}
              className={`block w-full rounded px-3 py-2 text-left text-sm font-bold ${
                activeView === 'EXPLORE' ? 'text-[#05BB75] bg-[#05BB75]/10' : 'text-slate-600'
              }`}
            >
              {t.nav.venue}
            </button>
          </div>

          {/* Mobile Language Switcher */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-2 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Globe className="h-4 w-4 text-[#05BB75]" />
              <span>{activeLang === 'ID' ? 'Bahasa Indonesia' : 'English (US)'}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveLang('ID')}
                className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                  activeLang === 'ID' ? 'bg-[#05BB75] text-white' : 'bg-white text-slate-600'
                }`}
              >
                ID
              </button>
              <button
                onClick={() => setActiveLang('US')}
                className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                  activeLang === 'US' ? 'bg-[#05BB75] text-white' : 'bg-white text-slate-600'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            {isLoggedIn ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <UserAvatar
                    src={activeUser?.avatar}
                    name={activeUser?.name}
                    sizeClassName="h-10 w-10"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="font-black text-xs text-slate-900 truncate">{activeUser?.name || 'User'}</div>
                    <div className="text-[10px] text-slate-500 truncate">{activeUser?.email || ''}</div>
                    <span className="inline-block mt-0.5 text-[9px] font-black uppercase text-[#05BB75]">
                      Penyewa Terdaftar
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleNavClick('USER_DASHBOARD');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl bg-slate-100 p-2.5 text-xs font-bold text-slate-700"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{t.nav.myBookings}</span>
                </button>

                <button
                  onClick={async () => {
                    await logoutUser();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl bg-red-50 p-2.5 text-xs font-bold text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t.nav.logout}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <a
                  href="/login"
                  className="flex w-full items-center justify-center rounded-xl border border-slate-300 p-2.5 text-xs font-extrabold text-slate-700 uppercase"
                >
                  {t.nav.login}
                </a>
                <a
                  href="/register"
                  className="flex w-full items-center justify-center rounded-xl bg-[#05BB75] p-2.5 text-xs font-black text-white uppercase shadow-sm"
                >
                  {t.nav.register}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Login Gate Modal */}
      <LoginGateModal 
        isOpen={showLoginGate} 
        onClose={() => setShowLoginGate(false)} 
        message="Silakan masuk ke akun Anda untuk melihat keranjang dan riwayat pesanan."
      />
    </header>
  );
};
