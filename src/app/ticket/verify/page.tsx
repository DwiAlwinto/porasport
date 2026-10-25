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
                  : data.ticket.isAlreadyCheckedIn
                  ? 'border-red-500/60 bg-gradient-to-b from-red-950/80 via-slate-900 to-slate-900'
                  : 'border-amber-500/40 bg-gradient-to-b from-amber-950/70 via-slate-900 to-slate-900'
              }`}
            >
              <div
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black tracking-wide uppercase shadow-lg mb-3 ${
                  data.ticket.isValid
                    ? 'bg-emerald-500 text-slate-950'
                    : data.ticket.isAlreadyCheckedIn
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-500 text-slate-950'
                }`}
              >
                {data.ticket.isValid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>TIKET RESMI &amp; VALID (LUNAS)</span>
                  </>
                ) : data.ticket.isAlreadyCheckedIn ? (
                  <>
                    <XCircle className="h-4 w-4" />
                    <span>TIKET SUDAH DIGUNAKAN (CHECKED-IN)</span>
                  </>
                ) : data.ticket.isExpired ? (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    <span>TIKET KEDALUWARSA</span>
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

            {/* Peringatan Double Check-in (Anti Screenshot Sharing - Poin 3) */}
            {data.ticket.isAlreadyCheckedIn && (
              <div className="rounded-3xl border-2 border-red-500 bg-red-950/80 p-5 text-center shadow-2xl space-y-2.5">
                <div className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white shadow-md">
                  <XCircle className="h-4 w-4" />
                  <span>⛔ PERINGATAN KERAS: TIKET SUDAH DIGUNAKAN</span>
                </div>
                <h3 className="text-base font-black text-white">
                  DILARANG CHECK-IN ULANG (PENCEGAHAN SCREENSHOT)
                </h3>
                <p className="text-xs text-red-200">
                  Tiket ini telah dipakai masuk ke lapangan pada:
                </p>
                <div className="rounded-xl bg-slate-950/80 border border-red-500/50 p-2.5 font-mono text-xs font-bold text-red-300">
                  {data.ticket.checkedInAt}
                </div>
                <p className="text-[11px] text-red-300/80">
                  Petugas gerbang dilarang mengizinkan masuk rombongan lain yang membawa salinan/screenshot dari tiket yang sama.
                </p>
              </div>
            )}

            {/* Peringatan Kedaluwarsa / Jadwal Belum Tiba (Poin 10) */}
            {data.ticket.isExpired && (
              <div className="rounded-3xl border-2 border-rose-500/60 bg-rose-950/70 p-4 text-center space-y-1.5 shadow-xl">
                <div className="inline-flex items-center gap-1.5 font-black text-rose-300 text-xs uppercase tracking-wider">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <span>TIKET KEDALUWARSA (JADWAL TELAH LEWAT)</span>
                </div>
                <p className="text-xs text-rose-200">
                  {data.ticket.timingNotice}
                </p>
              </div>
            )}

            {data.ticket.isFuture && (
              <div className="rounded-3xl border-2 border-amber-500/60 bg-amber-950/70 p-4 text-center space-y-1.5 shadow-xl">
                <div className="inline-flex items-center gap-1.5 font-black text-amber-300 text-xs uppercase tracking-wider">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  <span>JADWAL SEWA BELUM BERLAKU</span>
                </div>
                <p className="text-xs text-amber-200">
                  {data.ticket.timingNotice}
                </p>
              </div>
            )}

            {!data.ticket.isExpired && !data.ticket.isFuture && data.ticket.timingNotice && (
              <div
                className={`rounded-2xl border p-3 text-xs flex items-center justify-between ${
                  data.ticket.sessionStatus === 'ACTIVE'
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                    : data.ticket.sessionStatus === 'EARLY'
                    ? 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                    : 'border-slate-700 bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>{data.ticket.timingNotice}</span>
                </div>
                {data.ticket.sessionStatus === 'ACTIVE' && (
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                    Sesi Aktif
                  </span>
                )}
              </div>
            )}

            {/* Banner Verifikasi Tarif Subsidi Pelajar / Siswa (Poin 12) */}
            {data.ticket.requiresIdVerification && (
              <div className="rounded-3xl border-2 border-yellow-400 bg-gradient-to-r from-yellow-950/90 via-slate-900 to-yellow-950/90 p-4.5 text-xs text-yellow-200 space-y-2 shadow-xl">
                <div className="flex items-center gap-2 font-black text-yellow-300 text-sm">
                  <span className="text-lg">🎓</span>
                  <span>{data.ticket.userCategoryLabel || 'TARIF SUBSIDI PEMDA'}</span>
                </div>
                <p className="text-yellow-100 font-bold leading-relaxed bg-yellow-900/40 border border-yellow-500/40 rounded-xl p-2.5">
                  {data.ticket.verificationInstruction}
                </p>
              </div>
            )}

            {/* Banner Khusus Penyesuaian Agenda Dinas Pemda */}
            {(data.ticket as any).rescheduleStatus === 'PENDING_CUSTOMER' && (
              <div className="rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-900 p-5 text-xs text-amber-200 space-y-2.5 shadow-xl">
                <div className="flex items-center gap-2 font-black text-amber-300 text-sm">
                  <Building2 className="h-5 w-5 text-amber-400 shrink-0" />
                  <span>PENYESUAIAN JADWAL KEDINASAN PEMKAB BEKASI</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Fasilitas olahraga pada jadwal ini dialihkan sementara sehubungan dengan agenda resmi kedinasan Pemerintah Kabupaten Bekasi ({(data.ticket as any).rescheduleReason || 'Kegiatan Kedinasan Daerah'}).
                </p>
                <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 text-xs">
                  <span className="text-slate-400 block text-[10px] font-semibold">Jadwal Semula:</span>
                  <span className="text-slate-400 line-through">
                    {(data.ticket as any).rescheduleOriginalDate || data.ticket.date}
                  </span>{' '}
                  <span className="text-amber-300 font-bold">
                    ({(data.ticket as any).rescheduleOriginalTime || data.ticket.timeSlots})
                  </span>
                </div>
                <div className="text-[11px] text-emerald-300 font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Hak Bebas Geser Tanggal (Gratis 100%) dapat dipilih langsung di Dashboard Penyewa.</span>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 py-2.5 text-xs font-black text-slate-950 hover:from-amber-400 hover:to-emerald-500 shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Buka Dashboard untuk Geser Jadwal Sekarang</span>
                </button>
              </div>
            )}

            {(data.ticket as any).rescheduleStatus === 'RESOLVED' && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    Jadwal Baru Resmi Disetujui: <strong className="text-white font-bold">{(data.ticket as any).rescheduleTargetDate || data.ticket.date}</strong>
                  </span>
                </div>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300 uppercase tracking-wider">
                  Rescheduled
                </span>
              </div>
            )}

            {/* Ticket Info Details */}
            <div className="rounded-3xl border border-slate-800 bg-slate-800/60 p-5 space-y-3 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs text-slate-400">Nama Penyewa</span>
                <span className="text-xs font-bold text-white">{data.ticket.customerName}</span>
              </div>

              {data.ticket.nik && (
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <span className="text-xs text-slate-400">NIK / NISN</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400">{data.ticket.nik}</span>
                    {data.ticket.isVerifiedByAdmin ? (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                        Admin View
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                        Sensor Privasi
                      </span>
                    )}
                  </div>
                </div>
              )}

              {data.ticket.userCategoryLabel && (
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <span className="text-xs text-slate-400">Kategori Tarif</span>
                  <span className="text-xs font-bold text-yellow-300">{data.ticket.userCategoryLabel}</span>
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
