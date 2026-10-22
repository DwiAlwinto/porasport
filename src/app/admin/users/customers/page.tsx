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
  UserPlus,
  Pencil,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  X,
  Loader2,
} from 'lucide-react';
import { useAdminSession } from '@/context/AdminSessionContext';
import {
  getCustomerUsersList,
  getCustomerBookingHistory,
  createCustomerUserAction,
  updateCustomerUserAction,
  deleteCustomerUserAction,
} from '../../../../actions/userManagementActions';

export default function AdminCustomersPage() {
  const { role } = useAdminSession();
  const isSuperAdmin = role === 'SUPERADMIN';

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal History State
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Superadmin CRUD State: Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Superadmin CRUD State: Edit Modal
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    newPassword: '',
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Superadmin CRUD State: Delete Modal
  const [deletingCustomer, setDeletingCustomer] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

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

  // Superadmin CRUD: Create Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim()) {
      alert('Nama lengkap dan email wajib diisi.');
      return;
    }
    setActionLoading(true);
    const res = await createCustomerUserAction({
      name: createForm.name,
      email: createForm.email,
      phone: createForm.phone || undefined,
      password: createForm.password || undefined,
    });
    setActionLoading(false);
    if (res.success) {
      showToast(`User penyewa ${res.customer?.name} berhasil ditambahkan!`);
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', email: '', phone: '', password: '' });
      fetchCustomers();
    } else {
      alert(res.error || 'Gagal menambahkan user penyewa.');
    }
  };

  // Superadmin CRUD: Open Edit Modal
  const handleOpenEditModal = (c: any) => {
    setEditingCustomer(c);
    setEditForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      newPassword: '',
    });
    setShowEditPassword(false);
  };

  // Superadmin CRUD: Update Customer
  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      alert('Nama dan email wajib diisi.');
      return;
    }
    setActionLoading(true);
    const res = await updateCustomerUserAction({
      userId: editingCustomer.id,
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone || undefined,
      newPassword: editForm.newPassword || undefined,
    });
    setActionLoading(false);
    if (res.success) {
      showToast(`Data penyewa ${res.customer?.name} berhasil diperbarui!`);
      setEditingCustomer(null);
      fetchCustomers();
    } else {
      alert(res.error || 'Gagal memperbarui data penyewa.');
    }
  };

  // Superadmin CRUD: Delete Customer
  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setActionLoading(true);
    const res = await deleteCustomerUserAction(deletingCustomer.id);
    setActionLoading(false);
    if (res.success) {
      showToast(res.message || `Akun penyewa ${deletingCustomer.name} berhasil dihapus permanen.`);
      setDeletingCustomer(null);
      fetchCustomers();
    } else {
      alert(res.error || 'Gagal menghapus user penyewa.');
    }
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
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-2xl shadow-emerald-900/30 animate-bounce">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMsg}</span>
        </div>
      )}

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

      {/* Header & Superadmin Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-fg tracking-tight flex items-center gap-2">
            <span>Daftar User Penyewa (Customer &amp; Masyarakat)</span>
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Data kontak, NIK, total belanja sewa, dan riwayat pesanan lapangan masyarakat Kabupaten Bekasi.
          </p>
        </div>

        {/* Superadmin Add User Button */}
        {isSuperAdmin && (
          <button
            onClick={() => {
              setCreateForm({ name: '', email: '', phone: '', password: '' });
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            <span>Tambah User Penyewa</span>
            <span className="rounded bg-emerald-800 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200">
              Superadmin
            </span>
          </button>
        )}
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
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Riwayat Sewa (Bisa diakses ADMIN & SUPERADMIN) */}
                          <button
                            onClick={() => handleOpenHistory(c)}
                            className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                            title="Lihat Riwayat Sewa Lapangan"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Riwayat</span>
                          </button>

                          {/* Tombol CRUD (KHUSUS SUPERADMIN) */}
                          {isSuperAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(c)}
                                className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 transition"
                                title="Edit Data Penyewa (Superadmin)"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => setDeletingCustomer(c)}
                                className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition"
                                title="Hapus Akun Penyewa Permanen (Superadmin)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Hapus</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: RIWAYAT SEWA PENYEWA (ADMIN & SUPERADMIN) */}
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

      {/* MODAL 2: TAMBAH USER PENYEWA BARU (KHUSUS SUPERADMIN) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-fg">Tambah User Penyewa</h3>
                    <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 border border-emerald-300">
                      Superadmin
                    </span>
                  </div>
                  <p className="text-xs text-fg-muted">Daftarkan akun masyarakat / penyewa baru secara manual</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-fg mb-1">
                  Nama Lengkap Pemesan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso / PB Djarum"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full rounded-xl border border-line-strong bg-field py-2.5 px-3.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-fg mb-1">
                  Alamat Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="Contoh: budi@gmail.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full rounded-xl border border-line-strong bg-field py-2.5 px-3.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-fg mb-1">
                  Nomor WhatsApp / HP (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-line-strong bg-field py-2.5 px-3.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-fg">Kata Sandi Akun</label>
                  <span className="text-[10px] text-fg-faint">Default: disbudpora123</span>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    placeholder="Kosongkan jika ingin default: disbudpora123"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full rounded-xl border border-line-strong bg-field py-2.5 pl-3.5 pr-10 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg"
                  >
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-fg-muted mt-1">
                  Minimal 8 karakter jika diisi manual. User dapat mengubahnya setelah login.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-line-strong px-4 py-2.5 text-xs font-bold text-fg-subtle hover:bg-subtle transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Simpan Penyewa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT USER PENYEWA (KHUSUS SUPERADMIN) */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-fg">Edit Data Penyewa</h3>
                    <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 border border-amber-300">
                      Superadmin
                    </span>
                  </div>
                  <p className="text-xs text-fg-muted font-mono">{editingCustomer.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditCustomer} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-fg mb-1">
                  Nama Lengkap Pemesan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-line-strong bg-field py-2.5 px-3.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-fg mb-1">
                  Alamat Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-xl border border-line-strong bg-field py-2.5 px-3.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-fg mb-1">
                  Nomor WhatsApp / HP
                </label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-line-strong bg-field py-2.5 px-3.5 text-xs font-semibold text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-900">Reset Sandi Baru (Opsional)</label>
                  <span className="text-[10px] text-amber-700">Kosongkan bila tidak diganti</span>
                </div>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="Masukkan sandi baru (min. 8 karakter)..."
                    value={editForm.newPassword}
                    onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                    className="w-full rounded-xl border border-amber-300 bg-surface py-2.5 pl-3.5 pr-10 text-xs font-semibold text-fg outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg"
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setEditingCustomer(null)}
                  className="rounded-xl border border-line-strong px-4 py-2.5 text-xs font-bold text-fg-subtle hover:bg-subtle transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 shadow-md shadow-amber-600/20 transition disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: HAPUS USER PENYEWA PERMANEN (KHUSUS SUPERADMIN) */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-md rounded-3xl border border-red-200 bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 border border-red-200 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-red-600">Hapus Akun Penyewa</h3>
                  <span className="rounded bg-red-100 text-red-800 text-[10px] font-black uppercase px-2 py-0.5 border border-red-300">
                    Superadmin
                  </span>
                </div>
                <p className="text-xs text-fg-muted">Tindakan permanen dan berisiko tinggi</p>
              </div>
            </div>

            <div className="my-5 space-y-3 text-xs leading-relaxed text-fg-subtle">
              <p>
                Apakah Anda yakin ingin menghapus akun penyewa <strong className="text-fg">{deletingCustomer.name}</strong> (<span className="font-mono text-fg">{deletingCustomer.email}</span>)?
              </p>
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-3.5 text-[11px] text-red-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-900">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Pembersihan Otomatis Seluruh Relasi &amp; Berkas:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Seluruh riwayat pesanan sewa penyewa akan dihapus.</li>
                  <li>Kuota jadwal lapangan yang terhubung akan dilepas otomatis.</li>
                  <li><strong>Seluruh berkas bukti transfer QRIS di storage cloud akan dibersihkan</strong> tanpa menyisakan berkas sampah.</li>
                </ul>
              </div>
              <p className="text-[11px] text-fg-faint">
                Tindakan ini tidak dapat dibatalkan setelah dikonfirmasi.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setDeletingCustomer(null)}
                className="rounded-xl border border-line-strong px-4 py-2.5 text-xs font-bold text-fg-subtle hover:bg-subtle transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteCustomer}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 shadow-md shadow-red-600/20 transition disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

