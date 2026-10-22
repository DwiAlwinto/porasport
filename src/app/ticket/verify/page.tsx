"use client";

import React, { useEffect, useState, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  CreditCard,
  QrCode,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { verifyTicketAction, checkInTicketAction, TicketVerificationResult } from '../../../actions/ticketActions';
import { getCurrentAdminAction } from '../../../actions/authActions';

function TicketVerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || searchParams.get('id') || '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TicketVerificationResult | null>(null);
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();
  const [checkInMsg, setCheckInMsg] = useState<string | null>(null);

  const fetchTicket = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ticketRes, adminRes] = await Promise.all([
      verifyTicketAction(token),
      getCurrentAdminAction(),
    ]);
    setData(ticketRes);
    if (adminRes.admin) {
      setAdminUser(adminRes.admin);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTicket();
  }, [token]);

  const handleCheckIn = () => {
    if (!data?.ticket) return;
    startTransition(async () => {
      const res = await checkInTicketAction(data.ticket!.id);
      if (res.success) {
        setCheckInMsg(res.message || 'Check-in berhasil!');
        fetchTicket();
      } else {
        alert(res.error || 'Gagal check-in.');
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="mx-auto w-full max-w-lg">
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wide text-white">DISBUDPORA KAB. BEKASI</h1>
              <p className="text-[11px] text-emerald-400 font-bold">Portal Validasi Resmi E-Ticket Olahraga</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Beranda</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="rounded-3xl border border-slate-800 bg-slate-800/50 p-8 text-center backdrop-blur-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="mt-4 text-xs font-bold text-slate-300">Memverifikasi keaslian tiket di database resmi...</p>
          </div>
        )}

        {/* Empty Token */}
        {!loading && !token && (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-2" />
            <h3 className="text-base font-bold text-white">Parameter Tiket Tidak Ditemukan</h3>
            <p className="mt-1 text-xs text-slate-400">
              Silakan scan QR Code yang tertera pada e-Ticket aplikasi DISBUDPORA Sport.
            </p>
          </div>
        )}

        {/* Error / Not Found */}
        {!loading && token && (!data || !data.success || !data.ticket) && (
          <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-400 mb-3" />
            <h3 className="text-lg font-black text-white">TIKET TIDAK VALID</h3>
            <p className="mt-1 text-xs text-red-300">
              {data?.error || 'Kode QR atau nomor booking tidak terdaftar pada sistem DISBUDPORA Kabupaten Bekasi.'}
            </p>
            <div className="mt-4 rounded-xl bg-slate-950/60 p-3 font-mono text-xs text-slate-400">
              Token: {token}
            </div>
          </div>
        )}

        {/* Valid or Found Ticket */}
        {!loading && data?.ticket && (
          <div className="space-y-4">
            {/* Status Hero Card */}
            <div
              className={`rounded-3xl border p-6 text-center shadow-2xl relative overflow-hidden ${
                data.ticket.isValid
                  ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-950/70 via-slate-900 to-slate-900'
                  : 'border-amber-500/40 bg-gradient-to-b from-amber-950/70 via-slate-900 to-slate-900'
              }`}
            >
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black tracking-wide uppercase shadow-lg mb-3 ${
                data.ticket.isValid ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'
              }">
                {data.ticket.isValid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>TIKET RESMI &amp; VALID (LUNAS)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    <span>STATUS: {data.ticket.status}</span>
                  </>
                )}
              </div>

              <div className="font-mono text-sm font-black text-slate-300">
                #{data.ticket.id}
              </div>
              <h2 className="mt-1 text-xl font-black text-white">
                {data.ticket.venueName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{data.ticket.venueAddress}</p>

              {/* Checked in stamp */}
              {data.ticket.checkedInAt && (
                <div className="mt-3 inline-block rounded-xl bg-blue-500/20 border border-blue-500/40 px-3 py-1.5 text-xs font-bold text-blue-300">
                  ℹ️ {data.ticket.checkedInAt}
                </div>
              )}
            </div>

            {/* Ticket Info Details */}
            <div className="rounded-3xl border border-slate-800 bg-slate-800/60 p-5 space-y-3 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs text-slate-400">Nama Penyewa</span>
                <span className="text-xs font-bold text-white">{data.ticket.customerName}</span>
              </div>

              {data.ticket.nik && (
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <span className="text-xs text-slate-400">NIK / NISN</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{data.ticket.nik}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs text-slate-400">Fasilitas / Lapangan</span>
                <span className="text-xs font-bold text-white">{data.ticket.fieldName}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs text-slate-400">Tanggal Sewa</span>
                <span className="text-xs font-bold text-white">
                  📅 {new Date(data.ticket.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs text-slate-400">Sesi Jam</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  ⏰ {data.ticket.timeSlots} WIB
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs text-slate-400">Jumlah Orang / Kuota</span>
                <span className="text-xs font-bold text-white">{data.ticket.quantity} Orang / Tiket</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs text-slate-400">Total Nominal</span>
                <span className="text-sm font-black text-emerald-400">
                  {formatRupiah(data.ticket.totalAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Metode Bayar</span>
                <span className="text-xs font-bold text-slate-200">
                  {data.ticket.paymentMethod} • Lunas
                </span>
              </div>
            </div>

            {/* Admin Action: Check-in button */}
            {adminUser && data.ticket.isValid && !data.ticket.checkedInAt && (
              <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
                <p className="text-xs text-emerald-300 font-semibold mb-2.5">
                  Petugas Terdeteksi: <strong>{adminUser.name}</strong> ({adminUser.role})
                </p>
                <button
                  onClick={handleCheckIn}
                  disabled={isPending}
                  className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg hover:bg-emerald-500 transition disabled:opacity-50"
                >
                  {isPending ? 'Memproses Check-in...' : 'Konfirmasi Check-in Masuk Lapangan'}
                </button>
              </div>
            )}

            {checkInMsg && (
              <div className="rounded-2xl bg-emerald-600/20 border border-emerald-500/40 p-3 text-center text-xs font-bold text-emerald-300">
                {checkInMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Watermark */}
      <div className="mt-8 text-center text-[11px] text-slate-500">
        Sistem Manajemen Fasilitas Olahraga DISBUDPORA Kabupaten Bekasi © 2026
      </div>
    </div>
  );
}

export default function TicketVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <TicketVerifyContent />
    </Suspense>
  );
}
