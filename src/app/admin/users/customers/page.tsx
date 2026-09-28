"use client";

import React, { useState, useEffect, useTransition } from 'react';
import {
  Users,
  ShieldCheck,
  Search,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  ExternalLink,
  MessageCircle,
  Building2,
  CheckCircle2,
  XCircle,
  ShoppingBag,
} from 'lucide-react';
import {
  getCustomerUsersList,
  getCustomerBookingHistory,
} from '../../../../actions/userManagementActions';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();

  // Modal History State
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    const res = await getCustomerUsersList(search);
    if (res.success) {
      setCustomers(res.customers);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  // Open booking history modal
  const handleOpenHistory = async (customer: any) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);
    const res = await getCustomerBookingHistory(customer.id);
    if (res.success) {
      setCustomerBookings(res.bookings || []);
    }
    setLoadingHistory(false);
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatWhatsAppUrl = (phone?: string) => {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return `https://wa.me/${clean}`;
  };

  // Summary counts
  const totalRenters = customers.length;
  const totalBookingsSum = customers.reduce((acc, c) => acc + c.totalBookings, 0);
  const totalRevenueSum = customers.reduce((acc, c) => acc + c.totalSpent, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Navigation Tabs (Admin vs User Penyewa) */}
      <div className="flex border-b border-line">
        <a
          href="/admin/users/admins"
          className="flex items-center gap-2 border-b-2 border-transparent pb-3 px-4 text-xs font-bold text-fg-muted hover:text-fg transition"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Kelola Petugas Admin</span>
        </a>
        <a
          href="/admin/users/customers"
          className="flex items-center gap-2 border-b-2 border-emerald-500 pb-3 px-4 text-xs font-black text-emerald-700"
        >
          <Users className="h-4 w-4" />
          <span>Data User Penyewa ({totalRenters})</span>
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-fg tracking-tight flex items-center gap-2">
            <span>Daftar User Penyewa (Customer &amp; Masyarakat)</span>
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Data kontak, NIK, total belanja sewa, dan riwayat pesanan lapangan masyarakat Kabupaten Bekasi.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fg-muted">Total User Terdaftar</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-fg mt-2">{totalRenters} Penyewa</h3>
          <p className="text-[11px] text-fg-faint mt-0.5">Masyarakat &amp; Klub Olahraga</p>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fg-muted">Total Booking Dibuat</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-fg mt-2">{totalBookingsSum} Transaksi</h3>
          <p className="text-[11px] text-fg-faint mt-0.5">Akumulasi sewa lapangan</p>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fg-muted">Total Kontribusi Sewa</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-emerald-700 mt-2">{formatRupiah(totalRevenueSum)}</h3>
          <p className="text-[11px] text-fg-faint mt-0.5">Pendapatan lunas dari user</p>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-3xl border border-line bg-surface p-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
          <input
            type="text"
            placeholder="Cari nama penyewa, email, WhatsApp, atau NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-field py-2 pl-10 pr-4 text-xs font-semibold text-fg placeholder-slate-400 outline-none focus:border-emerald-500"
          />
        </form>
      </div>

      {/* Customers Table */}
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-xl shadow-slate-200/60 backdrop-blur-xl">
        {loading ? (
          <div className="py-20 text-center text-xs font-bold text-fg-faint">
            Memuat data penyewa...
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-xs text-fg-muted">
            Tidak ada user penyewa yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-field text-[11px] font-extrabold uppercase text-fg-muted">
                <tr>
                  <th className="p-4">Identitas Penyewa</th>
                  <th className="p-4">Kontak / WhatsApp</th>
                  <th className="p-4">NIK Pemesan</th>
                  <th className="p-4">Statistik Sewa</th>
                  <th className="p-4">Booking Terakhir</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium">
                {customers.map((c) => {
                  const waUrl = formatWhatsAppUrl(c.phone);
                  return (
                    <tr key={c.id} className="hover:bg-surface-soft transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-subtle text-fg font-bold text-xs border border-line-strong">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-fg">{c.name}</div>
                            <div className="text-[11px] text-fg-muted font-mono">{c.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-fg-subtle text-[11px]">{c.phone || '-'}</span>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 p-1 hover:bg-emerald-500/30"
                              title="Chat WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-mono text-[11px] text-fg-subtle">
                        {c.nik ? (
                          <span className="font-bold text-fg">{c.nik}</span>
                        ) : (
                          <span className="text-fg-faint italic">Belum mengisi NIK</span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-fg">
                          {c.totalBookings} kali sewa
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold">
                          Total: {formatRupiah(c.totalSpent)}
                        </div>
                      </td>

                      <td className="p-4 text-fg-subtle">
                        {c.lastBookingVenue !== '-' ? (
                          <div>
                            <div className="font-bold text-fg">{c.lastBookingVenue}</div>
                            <div className="text-[10px] text-fg-muted">
                              {c.lastBookingDate ? new Date(c.lastBookingDate).toLocaleDateString('id-ID') : '-'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-fg-faint italic">Belum pernah sewa</span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenHistory(c)}
                          className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition ml-auto"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Riwayat Sewa</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: RIWAYAT SEWA PENYEWA */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-3xl rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">
                    Riwayat Sewa Lapangan: {selectedCustomer.name}
                  </h3>
                  <p className="text-xs text-fg-muted">
                    {selectedCustomer.email} • {selectedCustomer.phone || '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-2">
              {loadingHistory ? (
                <div className="py-12 text-center text-xs font-bold text-fg-faint">
                  Memuat riwayat pemesanan...
                </div>
              ) : customerBookings.length === 0 ? (
                <div className="rounded-2xl border border-line bg-field p-8 text-center text-xs text-fg-muted">
                  Pengguna ini belum memiliki riwayat pemesanan lapangan.
                </div>
              ) : (
                <div className="space-y-3">
                  {customerBookings.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-line bg-field p-4 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-line pb-2">
                        <div className="font-mono font-bold text-fg">{b.id}</div>
                        <span
                          className={`rounded-lg px-2.5 py-0.5 text-[10px] font-bold ${
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
                            ? 'Menunggu Validasi'
                            : 'Dibatalkan'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-fg-subtle">
                        <div>
                          <span className="text-fg-faint">Venue:</span>{' '}
                          <strong className="text-fg">{b.venue?.name}</strong> ({b.venue?.city})
                        </div>
                        <div>
                          <span className="text-fg-faint">Metode Bayar:</span>{' '}
                          <strong className="text-emerald-700">{b.paymentMethod}</strong>
                        </div>
                        <div>
                          <span className="text-fg-faint">Lapangan:</span>{' '}
                          {b.items?.map((i: any) => i.field?.name).join(', ')}
                        </div>
                        <div>
                          <span className="text-fg-faint">Jam Sewa:</span>{' '}
                          {b.items?.map((i: any) => i.timeStart).join(', ')} WIB
                        </div>
                        <div>
                          <span className="text-fg-faint">Waktu Booking:</span>{' '}
                          {new Date(b.createdAt).toLocaleString('id-ID')}
                        </div>
                        <div className="text-sm font-black text-fg">
                          Total: {formatRupiah(b.grandTotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-subtle hover:bg-subtle"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
