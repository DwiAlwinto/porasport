"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  FileText,
  ShieldCheck,
  Maximize2,
  Send,
  RefreshCw,
  Lock,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Building2,
  User,
  Phone,
  Mail,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useAdminSession } from '@/context/AdminSessionContext';
import {
  getAdminPaymentStats,
  getAdminBookings,
  manualVerifyPayment,
  rejectPaymentWithReasonAction,
  getAdminVenuesWithFields,
  createSuperAdminBookingAction,
  updateSuperAdminBookingAction,
  deleteSuperAdminBookingAction,
} from '../../../actions/adminActions';
import { reTriggerOCRValidation } from '../../../actions/paymentValidationActions';
import { BookingStatus } from '@prisma/client';

const getIdentityLabel = (idNum?: string | null) => {
  if (!idNum) return 'NIK';
  const clean = idNum.trim();
  if (clean.length === 10) return 'NISN';
  if (clean.length === 8) return 'NPSN/NIM';
  if (clean.length === 16) return 'NIK';
  return 'ID / NIK';
};

const HOURS_LIST = [
  { hour: 6, label: '06:00 - 07:00' },
  { hour: 7, label: '07:00 - 08:00' },
  { hour: 8, label: '08:00 - 09:00' },
  { hour: 9, label: '09:00 - 10:00' },
  { hour: 10, label: '10:00 - 11:00' },
  { hour: 11, label: '11:00 - 12:00' },
  { hour: 12, label: '12:00 - 13:00' },
  { hour: 13, label: '13:00 - 14:00' },
  { hour: 14, label: '14:00 - 15:00' },
  { hour: 15, label: '15:00 - 16:00' },
  { hour: 16, label: '16:00 - 17:00' },
  { hour: 17, label: '17:00 - 18:00' },
  { hour: 18, label: '18:00 - 19:00' },
  { hour: 19, label: '19:00 - 20:00' },
  { hour: 20, label: '20:00 - 21:00' },
  { hour: 21, label: '21:00 - 22:00' },
  { hour: 22, label: '22:00 - 23:00' },
];

export default function AdminBookingsPage() {
  const router = useRouter();
  const { role } = useAdminSession();
  const isSuperAdmin = role === 'SUPERADMIN';
  
  // Check if user is ADMIN or SUPERADMIN
  useEffect(() => {
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      router.push('/admin');
    }
  }, [role, router]);

  // Show loading while checking permissions
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Lock className="mx-auto h-12 w-12 text-fg-muted mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Akses Ditolak</h2>
          <p className="mt-2 text-fg-faint">Hanya ADMIN atau SUPERADMIN yang dapat mengakses halaman ini.</p>
        </div>
      </div>
    );
  }

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal State
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');


  // Superadmin CRUD Modals & State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [adminVenues, setAdminVenues] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({
    venueId: '',
    fieldId: '',
    dateStr: new Date().toISOString().split('T')[0],
    hour: 8,
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    nik: '',
    npwp: '',
    totalAmount: 10000,
    paymentMethod: 'TUNAI_CASH',
    status: 'PAID_SUCCESS' as BookingStatus,
    adminNotes: '',
  });

  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    senderName: '',
    senderPhone: '',
    nik: '',
    npwp: '',
    totalPrice: 0,
    status: 'PAID_SUCCESS' as BookingStatus,
    paymentMethod: 'TUNAI_CASH',
    adminNotes: '',
  });

  const [deletingBooking, setDeletingBooking] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const data = await getAdminBookings({ status: statusFilter, search });
    setBookings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Manual Verify Payment
  const handleVerify = (bookingId: string) => {
    startTransition(async () => {
      const res = await manualVerifyPayment(bookingId, 'VALIDATED-BY-ADMIN-EMAIL-DISBUDPORA');
      if (res.success) {
        showToast(`Pesanan #${bookingId} berhasil disetujui LUNAS!`);
        fetchData();
        if (selectedBooking?.id === bookingId) {
          setSelectedBooking((prev: any) => ({ ...prev, status: 'PAID_SUCCESS' }));
        }
      } else {
        alert(res.error || 'Gagal memverifikasi pembayaran.');
      }
    });
  };

  // Confirm Reject Payment
  const handleConfirmReject = () => {
    if (!selectedBooking || !rejectReason.trim()) return;

    startTransition(async () => {
      const res = await rejectPaymentWithReasonAction(selectedBooking.id, rejectReason.trim());
      if (res.success) {
        showToast(`Pesanan #${selectedBooking.id} ditolak dan slot dibuka kembali.`);
        setIsRejectModalOpen(false);
        setSelectedBooking(null);
        setRejectReason('');
        fetchData();
      } else {
        alert(res.error || 'Gagal menolak pembayaran.');
      }
    });
  };


  // Re-trigger OCR Validation
  const handleReTriggerOCR = (bookingId: string) => {
    startTransition(async () => {
      const res = await reTriggerOCRValidation(bookingId);
      if (res.success) {
        showToast(`OCR re-validation completed: ${res.newStatus}`);
        fetchData();
        if (selectedBooking?.id === bookingId) {
          setSelectedBooking((prev: any) => ({ 
            ...prev, 
            status: res.newStatus,
            ocrValidationResult: res.ocrResult,
            ocrProcessedAt: new Date().toISOString(),
          }));
        }
      } else {
        alert(res.error || 'Gagal menjalankan ulang validasi OCR.');
      }
    });
  };

  // Superadmin CRUD: Open Create Modal
  const handleOpenCreateModal = async () => {
    if (adminVenues.length === 0) {
      const v = await getAdminVenuesWithFields();
      setAdminVenues(v || []);
      if (v && v.length > 0) {
        setCreateForm(prev => ({
          ...prev,
          venueId: v[0].id,
          fieldId: v[0].fields?.[0]?.id || '',
        }));
      }
    }
    setIsCreateModalOpen(true);
  };

  // Superadmin CRUD: Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.venueId || !createForm.fieldId || !createForm.customerName) {
      alert('Mohon lengkapi venue, lapangan, dan nama pemesan.');
      return;
    }
    startTransition(async () => {
      const hourPad = String(createForm.hour).padStart(2, '0');
      const nextHourPad = String(Number(createForm.hour) + 1).padStart(2, '0');
      const res = await createSuperAdminBookingAction({
        venueId: createForm.venueId,
        fieldId: createForm.fieldId,
        dateStr: createForm.dateStr,
        hour: Number(createForm.hour),
        timeStart: `${hourPad}:00`,
        timeEnd: `${nextHourPad}:00`,
        customerName: createForm.customerName,
        customerPhone: createForm.customerPhone,
        customerEmail: createForm.customerEmail,
        nik: createForm.nik,
        npwp: createForm.npwp,
        totalAmount: Number(createForm.totalAmount),
        paymentMethod: createForm.paymentMethod,
        status: createForm.status,
        adminNotes: createForm.adminNotes,
      });

      if (res.success) {
        showToast(`Pesanan manual #${res.booking?.id} berhasil dibuat!`);
        setIsCreateModalOpen(false);
        fetchData();
      } else {
        alert(res.error || 'Gagal membuat pesanan manual.');
      }
    });
  };

  // Superadmin CRUD: Open Edit Modal
  const handleOpenEditModal = (booking: any) => {
    setEditingBooking(booking);
    setEditForm({
      senderName: booking.senderName || booking.user?.name || '',
      senderPhone: booking.senderPhone || booking.user?.phone || '',
      nik: booking.nik || '',
      npwp: booking.npwp || '',
      totalPrice: booking.grandTotal || booking.totalPrice || 0,
      status: booking.status || 'PAID_SUCCESS',
      paymentMethod: booking.paymentMethod || 'TUNAI_CASH',
      adminNotes: booking.adminNotes || '',
    });
  };

  // Superadmin CRUD: Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    startTransition(async () => {
      const res = await updateSuperAdminBookingAction({
        bookingId: editingBooking.id,
        senderName: editForm.senderName,
        senderPhone: editForm.senderPhone,
        nik: editForm.nik,
        npwp: editForm.npwp,
        totalPrice: Number(editForm.totalPrice),
        status: editForm.status,
        paymentMethod: editForm.paymentMethod,
        adminNotes: editForm.adminNotes,
      });

      if (res.success) {
        showToast(`Pesanan #${editingBooking.id} berhasil diperbarui!`);
        setEditingBooking(null);
        fetchData();
      } else {
        alert(res.error || 'Gagal memperbarui pesanan.');
      }
    });
  };

  // Superadmin CRUD: Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deletingBooking) return;
    startTransition(async () => {
      const res = await deleteSuperAdminBookingAction(deletingBooking.id);
      if (res.success) {
        showToast(res.message || `Pesanan #${deletingBooking.id} dan berkas bukti QRIS berhasil dibersihkan permanen!`);
        setDeletingBooking(null);
        fetchData();
      } else {
        alert(res.error || 'Gagal menghapus pesanan.');
      }
    });
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-xs font-bold text-emerald-700 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 mb-1">
            <CreditCard className="h-4 w-4" />
            <span>Audit Finansial &amp; Mutasi Bank</span>
          </div>
          <h1 className="text-2xl font-black text-fg tracking-tight">
            Validasi Pembayaran QRIS DISBUDPORA
          </h1>
          <p className="text-xs text-fg-muted">
            Data pesanan terbaru tampil paling atas. Cocokkan bukti transfer struk pembayaran yang diunggah warga dengan notifikasi mutasi rekening DISBUDPORA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CRUD Superadmin Button */}
          {isSuperAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Pesanan Manual</span>
              <span className="rounded bg-emerald-800 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200">
                Superadmin
              </span>
            </button>
          )}

        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-line bg-surface p-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
          <input
            type="text"
            placeholder="Cari ID pesanan, nama pemesan, email, NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-field py-2 pl-10 pr-4 text-xs font-semibold text-fg placeholder-slate-400 outline-none focus:border-emerald-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-fg-faint" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-line-strong bg-field px-3 py-2 text-xs font-bold text-fg outline-none focus:border-emerald-500"
          >
            <option value="ALL">Semua Status (Terbaru di Atas)</option>
            <option value="MENUNGGU_VALIDASI">⏳ Menunggu Verifikasi Struk (QRIS)</option>
            <option value="PENDING_PAYMENT">⏰ Menunggu Pembayaran (Belum Bayar)</option>
            <option value="PAID_SUCCESS">✅ Lunas &amp; Tiket Terbit</option>
            <option value="CANCELLED">❌ Dibatalkan / Ditolak</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-xl shadow-slate-200/60 backdrop-blur-xl">
        {loading ? (
          <div className="py-20 text-center text-xs font-bold text-fg-faint">
            Memuat transaksi pembayaran...
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center text-xs text-fg-muted">
            Tidak ada transaksi yang cocok dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-field text-[11px] font-extrabold uppercase text-fg-muted">
                <tr>
                  <th className="p-4">Pesanan &amp; Identitas</th>
                  <th className="p-4">Venue &amp; Lapangan</th>
                  <th className="p-4">Struk Transfer</th>
                  <th className="p-4">Total Tagihan</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Aksi Audit &amp; CRUD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-soft transition">
                    <td className="p-4">
                      <div className="font-mono font-bold text-fg">{b.id}</div>
                      <div className="font-semibold text-fg mt-0.5">
                        {b.senderName || b.user?.name || 'Customer'}
                      </div>
                      <div className="text-[10px] text-fg-muted font-mono">
                        {b.nik ? `${getIdentityLabel(b.nik)}: ${b.nik}` : b.user?.email}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        📅 {new Date(b.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB
                      </div>
                    </td>

                    <td className="p-4 text-fg-subtle">
                      <div className="font-bold text-fg">{b.venue?.name}</div>
                      <div className="text-[11px] text-fg-muted">
                        {b.items?.[0]?.field?.name} (
                        {b.items?.map((i: any) => i.timeStart).join(', ')})
                      </div>
                    </td>

                    <td className="p-4">
                      {b.paymentProofUrl ? (
                        <div
                          onClick={() => setPreviewImage(b.paymentProofUrl)}
                          className="group relative h-12 w-12 cursor-pointer overflow-hidden rounded-xl border border-line-strong bg-field"
                        >
                          <img
                            src={b.paymentProofUrl}
                            alt="Struk"
                            className="h-full w-full object-cover transition group-hover:scale-110"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                            <Maximize2 className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-fg-faint italic">Belum upload</span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="text-sm font-black text-emerald-700">
                        {formatRupiah(b.grandTotal)}
                      </div>
                      <div className="text-[10px] text-fg-muted font-semibold">{b.paymentMethod}</div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                          b.status === 'PAID_SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : b.status === 'MENUNGGU_VALIDASI'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : b.status === 'PENDING_PAYMENT'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {b.status === 'PAID_SUCCESS'
                          ? '✅ Lunas'
                          : b.status === 'MENUNGGU_VALIDASI'
                          ? '⏳ Menunggu Validasi'
                          : b.status === 'PENDING_PAYMENT'
                          ? '⏰ Menunggu Bayar'
                          : '❌ Dibatalkan'}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="rounded-xl border border-line-strong bg-subtle px-3 py-1.5 text-xs font-bold text-fg hover:bg-subtle-strong hover:text-fg transition"
                          title="Lihat Detail & Audit"
                        >
                          Audit
                        </button>
                        
                        {/* SUPERADMIN-ONLY ACTIONS: EDIT & DELETE */}
                        {isSuperAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(b)}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                              title="Edit Pesanan (Superadmin)"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setDeletingBooking(b)}
                              className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition flex items-center gap-1"
                              title="Hapus Pesanan (Superadmin)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Hapus</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL AUDIT DETAIL */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-2xl rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">
                    Audit Bukti Bayar #{selectedBooking.id}
                  </h3>
                  <p className="text-xs text-fg-muted">DISBUDPORA QRIS Payment Verification</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-2">
              <div className="flex items-center justify-between rounded-2xl bg-field p-4 border border-line">
                <div>
                  <span className="text-[10px] font-bold uppercase text-fg-faint">Status</span>
                  <div className="mt-1 font-bold text-fg">{selectedBooking.status}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-fg-faint">Metode</span>
                  <div className="mt-1 font-bold text-fg">{selectedBooking.paymentMethod}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-fg-faint">Nominal</span>
                  <div className="mt-1 text-sm font-black text-emerald-700">
                    {formatRupiah(selectedBooking.grandTotal)}
                  </div>
                </div>
              </div>

              {/* Data Identitas Pemesan */}
              <div className="rounded-2xl border border-line bg-field p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase text-fg-muted border-b border-line pb-1">
                  Data Identitas &amp; Pengirim
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-fg-faint">Nama Pemesan:</span>
                    <div className="font-bold text-fg">{selectedBooking.senderName || selectedBooking.user?.name}</div>
                  </div>
                  <div>
                    <span className="text-fg-faint">No. Telepon / WA:</span>
                    <div className="font-bold text-fg">{selectedBooking.senderPhone || selectedBooking.user?.phone || '-'}</div>
                  </div>
                  <div>
                    <span className="text-fg-faint">{getIdentityLabel(selectedBooking.nik)}:</span>
                    <div className="font-mono font-bold text-fg">{selectedBooking.nik || '-'}</div>
                  </div>
                  <div>
                    <span className="text-fg-faint">NPWP:</span>
                    <div className="font-mono font-bold text-fg">{selectedBooking.npwp || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Struk Foto */}
              {selectedBooking.paymentProofUrl && (
                <div className="rounded-2xl border border-line bg-field p-4">
                  <span className="text-[10px] font-bold uppercase text-fg-faint block mb-2">
                    Foto Struk Pembayaran QRIS:
                  </span>
                  <div className="flex justify-center bg-black/10 rounded-xl p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedBooking.paymentProofUrl}
                      alt="Struk Transfer"
                      className="max-h-72 object-contain rounded-lg cursor-pointer hover:opacity-90 transition"
                      onClick={() => setPreviewImage(selectedBooking.paymentProofUrl)}
                    />
                  </div>
                </div>
              )}

              {/* OCR Validation Result */}
              {selectedBooking.ocrValidationResult && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Hasil Deteksi Otomatis Vision OCR</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
                    <div className={`rounded-xl p-2.5 ${selectedBooking.ocrValidationResult.amountMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      <div>{selectedBooking.ocrValidationResult.amountMatch ? '✅' : '❌'}</div>
                      <div>Nominal Sesuai</div>
                    </div>
                    <div className={`rounded-xl p-2.5 ${selectedBooking.ocrValidationResult.dateMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      <div>{selectedBooking.ocrValidationResult.dateMatch ? '✅' : '❌'}</div>
                      <div>Tanggal Cocok</div>
                    </div>
                    <div className={`rounded-xl p-2.5 ${selectedBooking.ocrValidationResult.keywordMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      <div>{selectedBooking.ocrValidationResult.keywordMatch ? '✅' : '❌'}</div>
                      <div>Kata Kunci QRIS</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Detail Jadwal */}
              <div className="rounded-2xl border border-line bg-field p-4 space-y-1 text-fg-muted">
                <div>Venue: <strong>{selectedBooking.venue?.name}</strong></div>
                <div>Lapangan: <strong>{selectedBooking.items?.[0]?.field?.name}</strong></div>
                <div>Tanggal: <strong>{selectedBooking.items?.[0]?.date ? new Date(selectedBooking.items[0].date).toLocaleDateString('id-ID') : '-'}</strong></div>
                <div>Jam: <strong>{selectedBooking.items?.map((i: any) => i.timeStart).join(', ')} WIB</strong></div>
                {selectedBooking.adminNotes && (
                  <div className="mt-2 text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <strong>Catatan:</strong> {selectedBooking.adminNotes}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
              <button
                onClick={() => setSelectedBooking(null)}
                className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
              >
                Tutup
              </button>

              {/* Action buttons for PENDING_PAYMENT or MENUNGGU_VALIDASI */}
              {(selectedBooking.status === 'PENDING_PAYMENT' || selectedBooking.status === 'MENUNGGU_VALIDASI') && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsRejectModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Tolak</span>
                  </button>

                  <button
                    onClick={() => handleVerify(selectedBooking.id)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Setujui Lunas &amp; Terbitkan Tiket</span>
                  </button>
                </div>
              )}

              {(selectedBooking.status === 'MENUNGGU_VALIDASI' || selectedBooking.ocrValidationResult) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReTriggerOCR(selectedBooking.id)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Jalankan Ulang OCR</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUPERADMIN MODAL: CREATE MANUAL BOOKING */}
      {isSuperAdmin && isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-fg">Tambah Pesanan Manual</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Hak Akses: Superadmin
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-2 text-xs">
              {/* Venue & Lapangan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-fg mb-1">Venue / Gelanggang *</label>
                  <select
                    value={createForm.venueId}
                    onChange={(e) => {
                      const vId = e.target.value;
                      const selectedV = adminVenues.find(v => v.id === vId);
                      setCreateForm(prev => ({
                        ...prev,
                        venueId: vId,
                        fieldId: selectedV?.fields?.[0]?.id || '',
                      }));
                    }}
                    required
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-emerald-500"
                  >
                    {adminVenues.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-fg mb-1">Lapangan / Sektor *</label>
                  <select
                    value={createForm.fieldId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, fieldId: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-emerald-500"
                  >
                    {adminVenues
                      .find(v => v.id === createForm.venueId)
                      ?.fields?.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.name} ({f.sportType})</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Tanggal & Jam */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-fg mb-1">Tanggal Sewa *</label>
                  <input
                    type="date"
                    value={createForm.dateStr}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, dateStr: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-fg mb-1">Pilihan Jam Main *</label>
                  <select
                    value={createForm.hour}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, hour: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-emerald-500"
                  >
                    {HOURS_LIST.map((h) => (
                      <option key={h.hour} value={h.hour}>{h.label} WIB</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Pelanggan */}
              <div className="rounded-2xl border border-line bg-field/50 p-3.5 space-y-3">
                <div className="font-black text-emerald-800 uppercase text-[10px] tracking-wider">
                  Data Identitas Pemesan
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-fg mb-1">Nama Pemesan *</label>
                    <input
                      type="text"
                      placeholder="Contoh: Dwi Alwinto"
                      value={createForm.customerName}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, customerName: e.target.value }))}
                      required
                      className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-fg mb-1">No. WhatsApp / Telepon</label>
                    <input
                      type="text"
                      placeholder="081234567890"
                      value={createForm.customerPhone}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-fg mb-1">Email Pemesan</label>
                    <input
                      type="email"
                      placeholder="dwi@example.com"
                      value={createForm.customerEmail}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                      className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-fg mb-1">NIK / NISN / NIM</label>
                    <input
                      type="text"
                      placeholder="330521..."
                      value={createForm.nik}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, nik: e.target.value }))}
                      className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rincian Finansial & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-fg mb-1">Total Tagihan (Rp) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={createForm.totalAmount}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, totalAmount: Number(e.target.value) }))}
                    required
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-fg mb-1">Metode Bayar *</label>
                  <select
                    value={createForm.paymentMethod}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-emerald-500"
                  >
                    <option value="TUNAI_CASH">Tunai / Cash Kasir</option>
                    <option value="QRIS">QRIS Disbudpora</option>
                    <option value="TRANSFER_BJB">Transfer Bank BJB</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-fg mb-1">Status Awal *</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-emerald-500"
                  >
                    <option value="PAID_SUCCESS">Lunas Langsung</option>
                    <option value="MENUNGGU_VALIDASI">Menunggu Validasi</option>
                    <option value="PENDING_PAYMENT">Menunggu Pembayaran</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-fg mb-1">Catatan Admin</label>
                <textarea
                  rows={2}
                  placeholder="Catatan khusus booking langsung oleh Superadmin..."
                  value={createForm.adminNotes}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, adminNotes: e.target.value }))}
                  className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-line-strong px-4 py-2 font-bold text-fg-muted hover:bg-subtle"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan & Buat Pesanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPERADMIN MODAL: EDIT BOOKING */}
      {isSuperAdmin && editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-6 w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-fg">Edit Pesanan #{editingBooking.id}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Hak Akses: Superadmin
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-fg mb-1">Nama Pemesan / Pengirim</label>
                  <input
                    type="text"
                    value={editForm.senderName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, senderName: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-fg mb-1">No. Telepon / WhatsApp</label>
                  <input
                    type="text"
                    value={editForm.senderPhone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, senderPhone: e.target.value }))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-fg mb-1">NIK / Identitas</label>
                  <input
                    type="text"
                    value={editForm.nik}
                    onChange={(e) => setEditForm(prev => ({ ...prev, nik: e.target.value }))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-fg mb-1">NPWP</label>
                  <input
                    type="text"
                    value={editForm.npwp}
                    onChange={(e) => setEditForm(prev => ({ ...prev, npwp: e.target.value }))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-fg mb-1">Total Tagihan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={editForm.totalPrice}
                    onChange={(e) => setEditForm(prev => ({ ...prev, totalPrice: Number(e.target.value) }))}
                    required
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-fg mb-1">Metode Bayar</label>
                  <select
                    value={editForm.paymentMethod}
                    onChange={(e) => setEditForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-blue-500"
                  >
                    <option value="QRIS">QRIS Disbudpora</option>
                    <option value="TUNAI_CASH">Tunai / Cash</option>
                    <option value="TRANSFER_BJB">Transfer Bank BJB</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-fg mb-1">Status Pemesanan</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-blue-500"
                >
                  <option value="PAID_SUCCESS">✅ PAID_SUCCESS (Lunas &amp; Tiket Terbit)</option>
                  <option value="MENUNGGU_VALIDASI">⏳ MENUNGGU_VALIDASI (Struk Diunggah - Review)</option>
                  <option value="PENDING_PAYMENT">⏰ PENDING_PAYMENT (Belum Bayar)</option>
                  <option value="CANCELLED">❌ CANCELLED (Dibatalkan / Slot Dilepas)</option>
                  <option value="COMPLETED">🏆 COMPLETED (Selesai Bermain)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-fg mb-1">Catatan Admin</label>
                <textarea
                  rows={2}
                  value={editForm.adminNotes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, adminNotes: e.target.value }))}
                  className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs text-fg outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="rounded-xl border border-line-strong px-4 py-2 font-bold text-fg-muted hover:bg-subtle"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-black text-white hover:bg-blue-700 shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui Pesanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPERADMIN MODAL: DELETE CONFIRMATION */}
      {isSuperAdmin && deletingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-200 bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="h-10 w-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-fg">Hapus Pesanan Permanen?</h4>
                <p className="text-[11px] text-red-600 font-bold">Akses Khusus: Superadmin</p>
              </div>
            </div>

            <div className="my-4 rounded-2xl bg-field p-3.5 border border-line space-y-1.5 text-xs text-fg-muted">
              <div>Nomor Booking: <strong className="font-mono text-fg">{deletingBooking.id}</strong></div>
              <div>Nama Pemesan: <strong className="text-fg">{deletingBooking.senderName || deletingBooking.user?.name}</strong></div>
              <div>Venue: <strong className="text-fg">{deletingBooking.venue?.name}</strong></div>
              <div>Total Tagihan: <strong className="text-emerald-700">{formatRupiah(deletingBooking.grandTotal)}</strong></div>
            </div>

            <p className="text-xs text-fg-muted leading-relaxed">
              Tindakan ini akan <strong>menghapus pesanan secara permanen</strong> dari database, <strong>membersihkan file fisik bukti transfer/QRIS dari folder penyimpanan memori</strong>, dan <strong>mengembalikan kuota slot</strong> menjadi tersedia kembali untuk pengguna lain.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingBooking(null)}
                className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-black text-white hover:bg-red-700 shadow-md shadow-red-600/20 disabled:opacity-50"
              >
                {isPending ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REJECT REASON */}
      {isRejectModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60">
            <h4 className="text-base font-bold text-red-700 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Tolak Pembayaran Pesanan #{selectedBooking.id}
            </h4>
            <p className="mt-1 text-xs text-fg-muted">
              Slot jadwal akan dikembalikan ke status tersedia untuk umum.
            </p>
            <textarea
              rows={3}
              placeholder="Tulis alasan penolakan (misal: Nominal tidak sesuai / struk buram)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-3 w-full rounded-xl border border-line-strong bg-field p-3 text-xs text-fg outline-none focus:border-red-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim() || isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL PREVIEW LIGHTBOX */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm cursor-zoom-out"
        >
          <img
            src={previewImage}
            alt="Struk Full"
            className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-xl shadow-slate-200/60 border border-line-strong"
          />
        </div>
      )}
    </div>
  );
}
