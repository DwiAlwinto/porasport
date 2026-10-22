import React from 'react';
import { requireAdminSession } from '../../lib/requireAdmin';
import { getAdminPaymentStats, getAdminBookings } from '../../actions/adminActions';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Building2,
  CalendarDays,
  Users,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  QrCode,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const stats = await getAdminPaymentStats();
  const bookingsRes = await getAdminBookings({ status: 'ALL' });
  const recentBookings = bookingsRes?.slice(0, 5) || [];

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const statCards = [
    {
      title: 'Total Pendapatan Lunas',
      value: formatRupiah(stats.totalRevenue),
      desc: 'Akumulasi seluruh venue Kab. Bekasi',
      icon: DollarSign,
      color: 'from-emerald-600 to-teal-500',
      badge: '+Terverifikasi',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      title: 'Menunggu Verifikasi QRIS',
      value: `${stats.pendingCount} Pesanan`,
      desc: `Nominal: ${formatRupiah(stats.pendingAmount)}`,
      icon: Clock,
      color: 'from-amber-600 to-yellow-500',
      badge: 'Perlu Tindakan',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      title: 'Total Tiket Diterbitkan',
      value: `${stats.paidBookingsCount} Tiket`,
      desc: 'Pesanan berstatus PAID_SUCCESS',
      icon: CheckCircle2,
      color: 'from-blue-600 to-indigo-500',
      badge: 'Lunas',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      title: 'Omzet Hari Ini',
      value: formatRupiah(stats.todayRevenue),
      desc: `${stats.todayBookingsCount} transaksi per hari ini`,
      icon: TrendingUp,
      color: 'from-purple-600 to-pink-500',
      badge: 'Hari Ini',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-white via-surface to-emerald-50/50 p-8 shadow-xl shadow-slate-200/60">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 mb-3">
              <ShieldCheck className="h-4 w-4" />
              <span>Portal Administrator &amp; CMS DISBUDPORA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-fg tracking-tight">
              Selamat Datang, {session.name}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-fg-muted max-w-xl">
              Sistem pusat pengelolaan venue olahraga, audit mutasi pembayaran QRIS DISBUDPORA, jadwal lapangan, dan manajemen pengguna Kabupaten Bekasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/admin/venues"
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500"
            >
              <Building2 className="h-4 w-4" />
              <span>Kelola Fasilitas</span>
            </a>
            <a
              href="/admin/bookings"
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-bold text-fg-subtle transition hover:bg-subtle"
            >
              <QrCode className="h-4 w-4 text-emerald-700" />
              <span>Audit QRIS</span>
            </a>
          </div>
        </div>
      </div>

      {/* Financial Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-md shadow-slate-200/50 transition hover:-translate-y-1 hover:border-emerald-300"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr ${c.color} text-white shadow-md`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-bold text-fg-muted">{c.title}</p>
                <h3 className="mt-1 text-xl font-black text-fg tracking-tight">{c.value}</h3>
                <p className="mt-1 text-[11px] font-medium text-fg-faint">{c.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <a
          href="/admin/venues"
          className="group rounded-3xl border border-line bg-surface p-6 transition hover:border-emerald-400 hover:bg-surface-soft"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600">
              <Building2 className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-fg-faint transition group-hover:translate-x-1 group-hover:text-emerald-600" />
          </div>
          <h3 className="mt-4 text-base font-bold text-fg">CMS Fasilitas &amp; Konten</h3>
          <p className="mt-1 text-xs text-fg-muted leading-relaxed">
            Tambah venue baru, kelola lapangan, ubah tarif sewa jam, fasilitas penunjang, dan unggah foto venue.
          </p>
        </a>

        <a
          href="/admin/schedule"
          className="group rounded-3xl border border-line bg-surface p-6 transition hover:border-blue-400 hover:bg-surface-soft"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600">
              <CalendarDays className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-fg-faint transition group-hover:translate-x-1 group-hover:text-blue-600" />
          </div>
          <h3 className="mt-4 text-base font-bold text-fg">Blokir Jadwal &amp; Kasir Walk-in</h3>
          <p className="mt-1 text-xs text-fg-muted leading-relaxed">
            Kunci slot jam lapangan untuk perawatan rumput atau acara dinas, serta booking langsung pemesan on-the-spot.
          </p>
        </a>

        <a
          href="/admin/users"
          className="group rounded-3xl border border-line bg-surface p-6 transition hover:border-purple-400 hover:bg-surface-soft"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 text-purple-600">
              <Users className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-fg-faint transition group-hover:translate-x-1 group-hover:text-purple-600" />
          </div>
          <h3 className="mt-4 text-base font-bold text-fg">Manajemen User (Superadmin)</h3>
          <p className="mt-1 text-xs text-fg-muted leading-relaxed">
            Lihat data seluruh pengguna aplikasi dan tambahkan akun admin petugas loket baru ke sistem.
          </p>
        </a>
      </div>

      {/* Recent Bookings Table */}
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-md shadow-slate-200/50">
        <div className="flex items-center justify-between mb-5 border-b border-line pb-4">
          <div>
            <h3 className="text-base font-bold text-fg">Transaksi Pemesanan Terbaru</h3>
            <p className="text-xs text-fg-muted">5 pesanan terakhir yang masuk ke sistem Sport Bekasi</p>
          </div>
          <a
            href="/admin/bookings"
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
          >
            <span>Lihat Semua Pesanan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
                <tr className="border-b border-line text-[11px] font-extrabold uppercase text-fg-muted">
                  <th className="pb-3">ID Pesanan</th>
                  <th className="pb-3">Pemesan</th>
                  <th className="pb-3">Venue / Lapangan</th>
                  <th className="pb-3">Metode</th>
                  <th className="pb-3">Total Tagihan</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium">
                {recentBookings.map((b: any) => (
                  <tr key={b.id} className="hover:bg-surface-soft">
                    <td className="py-3 font-mono font-bold text-fg">{b.id}</td>
                    <td className="py-3 text-fg-subtle">
                      <div className="font-bold text-fg">{b.senderName || b.user?.name || 'Customer'}</div>
                      <div className="text-[10px] text-fg-faint font-mono">
                        {b.nik
                          ? `${b.nik.length === 10 ? 'NISN' : b.nik.length === 8 ? 'NPSN/NIM' : b.nik.length === 16 ? 'NIK' : 'ID'}: ${b.nik}`
                          : b.user?.email}
                      </div>
                    </td>
                    <td className="py-3 text-fg-subtle">{b.venue?.name || '-'}</td>
                    <td className="py-3 font-semibold text-emerald-700">{b.paymentMethod}</td>
                    <td className="py-3 font-bold text-fg">{formatRupiah(b.grandTotal)}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                          b.status === 'PAID_SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : b.status === 'PENDING_PAYMENT'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                      {b.status === 'PAID_SUCCESS'
                        ? 'Lunas'
                        : b.status === 'PENDING_PAYMENT'
                        ? 'Pending'
                        : 'Batal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
