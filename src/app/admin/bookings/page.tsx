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
  Sparkles,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useAdminSession } from '@/context/AdminSessionContext';
import {
  getAdminPaymentStats,
  getAdminBookings,
  manualVerifyPayment,
  rejectPaymentWithReasonAction,
  simulateWebhookTrigger,
} from '../../../actions/adminActions';
import { reTriggerOCRValidation } from '../../../actions/paymentValidationActions';

export default function AdminBookingsPage() {
  const router = useRouter();
  const { role } = useAdminSession();
  
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

  // Webhook Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simOrderId, setSimOrderId] = useState('');
  const [simStatus, setSimStatus] = useState<'settlement' | 'expire' | 'cancel'>('settlement');
  const [simResponse, setSimResponse] = useState<any>(null);

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

  // Run Webhook Simulation
  const handleRunSimulator = async () => {
    if (!simOrderId) return;
    setSimResponse(null);
    const res = await simulateWebhookTrigger(simOrderId, simStatus);
    setSimResponse(res);
    fetchData();
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
            Cocokkan bukti transfer struk pembayaran yang diunggah warga dengan notifikasi email mutasi bank DISBUDPORA.
          </p>
        </div>

        <button
          onClick={() => setShowSimulator(!showSimulator)}
          className="flex items-center gap-2 rounded-xl border border-line-strong bg-subtle px-4 py-2.5 text-xs font-bold text-fg-subtle hover:bg-subtle-strong hover:text-fg transition"
        >
          <Sparkles className="h-4 w-4 text-emerald-700" />
          <span>{showSimulator ? 'Tutup Simulator' : 'Simulator Webhook Gateway'}</span>
        </button>
      </div>

      {/* Webhook Simulator Collapsible */}
      {showSimulator && (
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-xl shadow-slate-200/60 animate-in fade-in">
          <h3 className="text-xs font-black uppercase text-emerald-700 tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Simulator Notifikasi Callback Payment Gateway (Xendit / Midtrans / QRIS)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Masukkan ID Pesanan (misal: GLR-...)"
              value={simOrderId}
              onChange={(e) => setSimOrderId(e.target.value)}
              className="rounded-xl border border-line-strong bg-field px-3 py-2 text-xs font-mono text-fg outline-none focus:border-emerald-500"
            />
            <select
              value={simStatus}
              onChange={(e) => setSimStatus(e.target.value as any)}
              className="rounded-xl border border-line-strong bg-field px-3 py-2 text-xs font-bold text-fg outline-none focus:border-emerald-500"
            >
              <option value="settlement">Settlement (Lunas Berhasil)</option>
              <option value="expire">Expire (Waktu Habis / Kedaluwarsa)</option>
              <option value="cancel">Cancel (Dibatalkan)</option>
            </select>
            <button
              onClick={handleRunSimulator}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
            >
              Tembakkan Event Webhook
            </button>
          </div>
          {simResponse && (
            <pre className="mt-3 rounded-xl bg-field p-3 text-[10px] font-mono text-emerald-700 overflow-x-auto">
              {JSON.stringify(simResponse, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-line bg-surface p-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
          <input
            type="text"
            placeholder="Cari ID pesanan, nama, email, NIK..."
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
            <option value="ALL">Semua Status Pesanan</option>
            <option value="PENDING_PAYMENT">⏳ Menunggu Verifikasi Admin</option>
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
                  <th className="p-4 text-right">Aksi Audit</th>
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
                        {b.nik ? `NIK: ${b.nik}` : b.user?.email}
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
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="rounded-xl border border-line-strong bg-subtle px-3 py-1.5 text-xs font-bold text-fg hover:bg-subtle-strong hover:text-fg transition"
                      >
                        Audit Pesanan
                      </button>
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
                  <div className="mt-1 font-bold text-emerald-700">{selectedBooking.status}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-fg-faint">Total Nominal</span>
                  <div className="text-lg font-black text-fg">{formatRupiah(selectedBooking.grandTotal)}</div>
                </div>
              </div>

              {selectedBooking.paymentProofUrl && (
                <div className="rounded-2xl border border-line bg-field p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-fg">Foto Struk Transfer QRIS:</span>
                    <button
                      onClick={() => setPreviewImage(selectedBooking.paymentProofUrl)}
                      className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Perbesar Struk</span>
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <img
                      src={selectedBooking.paymentProofUrl}
                      alt="Struk"
                      onClick={() => setPreviewImage(selectedBooking.paymentProofUrl)}
                      className="h-32 w-32 object-cover rounded-xl border border-line-strong cursor-pointer hover:scale-105 transition shrink-0"
                    />
                    <div className="space-y-1 text-fg-subtle">
                      <div>Nama Pemilik Rekening: <strong className="text-fg">{selectedBooking.senderName || '-'}</strong></div>
                      <div>NIK: <strong className="text-fg font-mono">{selectedBooking.nik || '-'}</strong></div>
                      {selectedBooking.npwp && <div>NPWP: <strong className="text-fg font-mono">{selectedBooking.npwp}</strong></div>}
                    </div>
                  </div>
                </div>
              )}

              {/* OCR Validation Results */}
              {selectedBooking.ocrValidationResult && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div className="font-bold text-blue-700 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Hasil Validasi OCR Otomatis
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className={`rounded-xl p-3 font-bold ${selectedBooking.ocrValidationResult.amountMatch ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      <div className="text-lg">{selectedBooking.ocrValidationResult.amountMatch ? '✅' : '❌'}</div>
                      <div className="text-[10px] uppercase">Nominal</div>
                      <div className="text-[10px] mt-1">
                        Diharapkan: {selectedBooking.ocrValidationResult.expectedAmount?.toLocaleString?.('id-ID') || '-'}
                      </div>
                      <div className="text-[10px]">
                        Terdeteksi: {selectedBooking.ocrValidationResult.detectedAmounts?.join(', ') || '-'}
                      </div>
                    </div>
                    <div className={`rounded-xl p-3 font-bold ${selectedBooking.ocrValidationResult.dateMatch ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      <div className="text-lg">{selectedBooking.ocrValidationResult.dateMatch ? '✅' : '❌'}</div>
                      <div className="text-[10px] uppercase">Tanggal</div>
                      <div className="text-[10px] mt-1">
                        {selectedBooking.ocrValidationResult.detectedDate ? `Terdeteksi: ${selectedBooking.ocrValidationResult.detectedDate}` : 'Tidak terdeteksi'}
                      </div>
                    </div>
                    <div className={`rounded-xl p-3 font-bold ${selectedBooking.ocrValidationResult.keywordMatch ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      <div className="text-lg">{selectedBooking.ocrValidationResult.keywordMatch ? '✅' : '❌'}</div>
                      <div className="text-[10px] uppercase">Kata Kunci</div>
                      <div className="text-[10px] mt-1">
                        {selectedBooking.ocrValidationResult.detectedKeywords?.length ? (
                          selectedBooking.ocrValidationResult.detectedKeywords.map((k: string) => (
                            <span key={k} className="inline-block bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] mr-0.5 mb-0.5">{k}</span>
                          ))
                        ) : (
                          <span className="text-red-700">Tidak ditemukan</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-blue-700">
                    {selectedBooking.ocrValidationResult.passed 
                      ? '✅ Semua parameter lolos - Pesanan seharusnya sudah LUNAS otomatis'
                      : '⚠️ Validasi otomatis gagal - Perlu review manual dengan mutasi BJB'}
                  </div>
                  {selectedBooking.ocrValidationResult.extractedText && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-fg-muted cursor-pointer hover:text-fg-subtle">
                        Lihat teks mentah OCR
                      </summary>
                      <pre className="mt-2 rounded bg-field p-2 text-[9px] text-fg-subtle overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {selectedBooking.ocrValidationResult.extractedText}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-line bg-field p-4 space-y-1 text-fg-subtle">
                <div className="font-bold text-fg mb-1">Venue &amp; Jadwal Lapangan:</div>
                <div>Venue: <strong>{selectedBooking.venue?.name}</strong></div>
                <div>Lapangan: <strong>{selectedBooking.items?.[0]?.field?.name}</strong></div>
                <div>Tanggal: <strong>{selectedBooking.items?.[0]?.date ? new Date(selectedBooking.items[0].date).toLocaleDateString('id-ID') : '-'}</strong></div>
                <div>Jam: <strong>{selectedBooking.items?.map((i: any) => i.timeStart).join(', ')} WIB</strong></div>
              </div>
            </div>

<div className="mt-5 flex items-center justify-between border-t border-line pt-3">
              <button
                onClick={() => setSelectedBooking(null)}
                className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
              >
                Tutup
              </button>

              {selectedBooking.status === 'PENDING_PAYMENT' && (
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
                    <span>Setujui Lunas & Terbitkan Tiket</span>
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
