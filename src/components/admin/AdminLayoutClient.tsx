"use client";

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  CalendarDays,
  Users,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Menu,
  X,
  Sparkles,
  QrCode,
  PhoneCall,
} from 'lucide-react';
import { adminLogoutAction } from '../../actions/authActions';
import { AdminSessionProvider } from '../../context/AdminSessionContext';

interface AdminLayoutClientProps {
  session: {
    userId: string;
    email: string;
    name: string;
    role: string;
  };
  children: React.ReactNode;
}

export const AdminLayoutClient: React.FC<AdminLayoutClientProps> = ({ session, children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Jika di halaman login, tampilkan children langsung tanpa sidebar
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await adminLogoutAction();
    router.push('/admin/login');
    router.refresh();
  };

  const navItems = [
    {
      name: 'Dashboard Ringkasan',
      href: '/admin',
      icon: LayoutDashboard,
      active: pathname === '/admin',
    },
    {
      name: 'Banner Promo Homepage',
      href: '/admin/settings/banners',
      icon: Sparkles,
      badge: 'UI',
      active: pathname.startsWith('/admin/settings/banners'),
    },
    {
      name: 'CMS Fasilitas & Venue',
      href: '/admin/venues',
      icon: Building2,
      active: pathname.startsWith('/admin/venues'),
    },
    {
      name: 'Validasi Pembayaran QRIS',
      href: '/admin/bookings',
      icon: CreditCard,
      active: pathname.startsWith('/admin/bookings'),
    },
    {
      name: 'Blokir Jadwal & Kasir',
      href: '/admin/schedule',
      icon: CalendarDays,
      active: pathname.startsWith('/admin/schedule'),
    },
    {
      name: 'Data User Penyewa',
      href: '/admin/users/customers',
      icon: Users,
      badge: 'Penyewa',
      active: pathname === '/admin/users/customers',
    },
    {
      name: 'Kelola Petugas Admin',
      href: '/admin/users/admins',
      icon: ShieldCheck,
      badge: 'Superadmin',
      active: pathname === '/admin/users/admins' || pathname === '/admin/users',
    },
    {
      name: 'Pengaturan QRIS',
      href: '/admin/settings/qris',
      icon: QrCode,
      badge: 'Pembayaran',
      active: pathname.startsWith('/admin/settings/qris'),
    },
    {
      name: 'Kontak & Footer',
      href: '/admin/settings/footer',
      icon: PhoneCall,
      badge: 'Konten',
      active: pathname.startsWith('/admin/settings/footer'),
    },
  ];

  return (
    <div className="flex min-h-screen bg-canvas font-sans text-fg selection:bg-emerald-500 selection:text-white">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between border-b border-line px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-soft p-1 shadow-sm">
              <img
                src="/images/logo.png"
                alt="Logo Sport Bekasi"
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-black tracking-tight text-fg">
                SPORT BEKASI
                <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-extrabold text-emerald-700">
                  CMS
                </span>
              </div>
              <p className="text-[10px] font-medium text-fg-muted">DISBUDPORA Kab. Bekasi</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-1.5 text-fg-muted transition hover:bg-subtle hover:text-fg lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
          <div className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-fg-faint">
            Menu Utama
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-xl border px-3.5 py-3 text-xs font-bold transition-all ${
                  item.active
                    ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 shadow-sm'
                    : 'border-transparent text-fg-subtle hover:bg-subtle hover:text-fg'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition ${
                      item.active ? 'text-emerald-600' : 'text-fg-muted group-hover:text-fg'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Bottom User Profile & Actions */}
        <div className="space-y-3 border-t border-line bg-surface-soft p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-xs font-bold text-white">
              {session.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-fg">{session.name}</p>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="truncate text-[10px] font-semibold text-emerald-700">{session.role}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-2 text-[11px] font-bold text-fg-subtle transition hover:bg-subtle hover:text-fg"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Web Publik</span>
            </a>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-2 text-fg-muted transition hover:bg-subtle hover:text-fg lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-fg-muted">Pusat Kendali DISBUDPORA</span>
              <span className="text-fg-faint">/</span>
              <span className="text-xs font-bold text-emerald-700">Kabupaten Bekasi</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 sm:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span>Sistem Aktif &amp; Terlindungi</span>
            </div>
          </div>
        </header>

        {/* Page Children */}
        <main className="flex-1 overflow-y-auto bg-canvas p-6 lg:p-8">
          <AdminSessionProvider session={session}>
            {children}
          </AdminSessionProvider>
        </main>
      </div>
    </div>
  );
};
