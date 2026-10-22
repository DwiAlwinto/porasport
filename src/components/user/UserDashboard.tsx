import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { handleImageError, getFallbackImageForUrl } from '../../utils/imageUtils';
import { useApp } from '../../context/AppContext';
import {
  Booking,
  BookingStatus,
} from '../../types';
import {
  Calendar,
  Clock,
  QrCode,
  Star,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
  MessageSquare,
  User as UserIcon,
  Phone,
  Mail,
  Building2,
  ArrowRight,
  Upload,
  RefreshCw,
  Printer,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';

export const UserDashboard: React.FC = () => {
  const {
    activeUser,
    setActiveUser,
    bookings,
    bookingsLoading,
    refreshBookings,
    cancelBooking,
    uploadPaymentProofForBooking,
    addReview,
    setActiveView,
    venues,
    t,
    activeLang,
  } = useApp();

  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [reviewModalBooking, setReviewModalBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [activeQrModalBooking, setActiveQrModalBooking] = useState<Booking | null>(null);

  // Upload proof modal state
  const [selectedUploadBooking, setSelectedUploadBooking] = useState<Booking | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);

  // Real QR Code state & actions
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (activeQrModalBooking) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://disbudporasport.gabuspucung.id';
      const verifyToken = activeQrModalBooking.qrCodeToken || activeQrModalBooking.id;
      const verifyUrl = `${origin}/ticket/verify?token=${encodeURIComponent(verifyToken)}`;

      QRCode.toDataURL(verifyUrl, {
        width: 450,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('[QR Generation Error]:', err));
    } else {
      setQrDataUrl(null);
      setIsCopied(false);
    }
  }, [activeQrModalBooking]);

  const handleCopyToken = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handlePrintTicket = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Filter user bookings
  const userBookings = bookings.filter((b) => b.userId === activeUser?.id);
  const filteredBookings = userBookings.filter((b) => {
    if (statusTab === 'ALL') return true;
    if (statusTab === 'PENDING_PAYMENT') {
      return b.status === 'PENDING_PAYMENT' || b.status === 'MENUNGGU_VALIDASI';
    }
    return b.status === statusTab;
  });

  // 1. Sync data terbaru langsung dari server database saat dashboard dibuka
  useEffect(() => {
    refreshBookings();
  }, []);

  // 2. Auto-polling setiap 10 detik jika masih ada pesanan yang menunggu validasi admin
  useEffect(() => {
    const hasPending = userBookings.some(
      (b) => b.status === 'PENDING_PAYMENT' || b.status === 'MENUNGGU_VALIDASI'
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      refreshBookings();
    }, 10000);

    return () => clearInterval(interval);
  }, [userBookings]);

  const handleOpenReviewModal = (booking: Booking) => {
    setReviewModalBooking(booking);
    setRating(5);
    setComment('');
  };

  const handleSendReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalBooking) return;
    addReview(
      reviewModalBooking.venueId,
      rating,
      comment,
      reviewModalBooking.sportCategory
    );
    setReviewModalBooking(null);
  };

  const handleUploadProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadBooking || !uploadFile) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await uploadPaymentProofForBooking(selectedUploadBooking.id, uploadFile);
      if (res.success) {
        setUploadSuccessToast(`Bukti transfer #${selectedUploadBooking.id} berhasil diunggah!`);
        setSelectedUploadBooking(null);
        setUploadFile(null);
        setUploadFileName('');
        setTimeout(() => setUploadSuccessToast(null), 4000);
      } else {
        setUploadError(res.error || 'Gagal mengunggah bukti pembayaran.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Terjadi kesalahan saat unggah bukti.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      {/* Toast Notifikasi Sukses */}
      {uploadSuccessToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-xs font-bold text-emerald-700 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{uploadSuccessToast}</span>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top Profile Header */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-6 text-white sm:px-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <UserAvatar
                  src={activeUser?.avatar}
                  name={activeUser?.name}
                  sizeClassName="h-16 w-16"
                  className="rounded-2xl text-xl"
                  ringColor="ring-white/20"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black">{activeUser?.name || 'User'}</h1>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                      {activeUser?.role === 'MITRA_OWNER' ? t.userDashboard.userRoleMitra : t.userDashboard.userRoleRenter}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {activeUser?.email || ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {activeUser?.phone || ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshBookings()}
                  disabled={bookingsLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition disabled:opacity-60"
                  title="Sinkronkan status tiket dengan data terbaru server"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${bookingsLoading ? 'animate-spin' : ''}`} />
                  <span>{bookingsLoading ? 'Memeriksa...' : 'Perbarui Status'}</span>
                </button>
                <button
                  onClick={() => setActiveView('EXPLORE')}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                >
                  {t.userDashboard.orderNewCourt}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* STATUS TABS */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setStatusTab('ALL')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabAll} ({userBookings.length})
          </button>
          <button
            onClick={() => setStatusTab('PENDING_PAYMENT')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'PENDING_PAYMENT'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabPending} (
            {userBookings.filter((b) => b.status === 'PENDING_PAYMENT' || b.status === 'MENUNGGU_VALIDASI').length})
          </button>
          <button
            onClick={() => setStatusTab('PAID_SUCCESS')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'PAID_SUCCESS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabPaid} (
            {userBookings.filter((b) => b.status === 'PAID_SUCCESS').length})
          </button>
          <button
            onClick={() => setStatusTab('COMPLETED')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'COMPLETED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabCompleted} (
            {userBookings.filter((b) => b.status === 'COMPLETED').length})
          </button>
          <button
            onClick={() => setStatusTab('CANCELLED')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'CANCELLED'
                ? 'bg-slate-700 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabCancelled} ({userBookings.filter((b) => b.status === 'CANCELLED').length})
          </button>
        </div>

        {/* BOOKING HISTORY LIST */}
        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <Calendar className="mb-3 h-12 w-12 text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">
                {t.userDashboard.noBookingsTitle}
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                {t.userDashboard.noBookingsDesc}
              </p>
              <button
                onClick={() => setActiveView('EXPLORE')}
                className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                {t.userDashboard.exploreCourts}
              </button>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-slate-900">
                      #{booking.id}
                    </span>
                    <span className="text-xs text-slate-400">• {booking.createdAt}</span>
                  </div>
                  <div>
                    {(booking.status === 'PENDING_PAYMENT' || booking.status === 'MENUNGGU_VALIDASI') && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        {booking.status === 'MENUNGGU_VALIDASI' || booking.paymentProofUrl
                          ? t.userDashboard.statusPendingValidation
                          : t.userDashboard.statusPendingPayment}
                      </span>
                    )}
                    {booking.status === 'PAID_SUCCESS' && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        {t.userDashboard.statusPaidSuccess}
                      </span>
                    )}
                    {booking.status === 'COMPLETED' && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                        {t.userDashboard.statusCompleted}
                      </span>
                    )}
                    {booking.status === 'CANCELLED' && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                        {t.userDashboard.statusCancelled}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-4">
                    <img
                      src={booking.venueImage || getFallbackImageForUrl(booking.venueName, booking.sportCategory)}
                      alt={booking.venueName}
                      className="h-20 w-20 rounded-xl object-cover bg-slate-100 shrink-0"
                      onError={handleImageError}
                    />
                    <div>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {(t.categories as any)[booking.sportCategory] || booking.sportCategory}
                      </span>
                      <h3 className="mt-1 text-base font-black text-slate-900">
                        {booking.venueName}
                      </h3>
                      <p className="text-xs text-slate-500">{booking.venueAddress}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                        <span>📅 {booking.items[0]?.date}</span>
                        <span>•</span>
                        <span>
                          ⏰ {booking.items.map((i) => `${i.timeStart}-${i.timeEnd}`).join(', ')} WIB (
                          {booking.items.length} {t.userDashboard.hours})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="flex flex-col items-end justify-between gap-3 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-slate-400">{t.userDashboard.totalPrice}</div>
                      <div className="text-base font-black text-slate-900">
                        {new Intl.NumberFormat(activeLang === 'US' ? 'en-US' : 'id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          maximumFractionDigits: 0,
                        }).format(booking.grandTotal)}
                      </div>
                      <div className="text-[11px] text-slate-500">{t.userDashboard.via} {booking.paymentMethod}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {booking.status === 'PAID_SUCCESS' && (
                        <button
                          onClick={() => setActiveQrModalBooking(booking)}
                          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800"
                        >
                          <QrCode className="h-4 w-4 text-emerald-400" />
                          <span>{t.userDashboard.viewTicket}</span>
                        </button>
                      )}

                      {(booking.status === 'PENDING_PAYMENT' || booking.status === 'MENUNGGU_VALIDASI') && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedUploadBooking(booking);
                              setUploadFile(null);
                              setUploadFileName('');
                              setUploadError(null);
                            }}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
                          >
                            <Upload className="h-4 w-4" />
                            <span>{booking.paymentProofUrl || booking.status === 'MENUNGGU_VALIDASI' ? 'Ganti Bukti Bayar' : 'Unggah Bukti Bayar'}</span>
                          </button>
                          {booking.status === 'PENDING_PAYMENT' && (
                            <button
                              onClick={() => cancelBooking(booking.id)}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition"
                            >
                              {t.userDashboard.cancelOrder}
                            </button>
                          )}
                        </>
                      )}

                      {booking.status === 'COMPLETED' && !booking.hasReviewed && (
                        <button
                          onClick={() => handleOpenReviewModal(booking)}
                          className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-600"
                        >
                          <Star className="h-4 w-4 fill-white" />
                          <span>{t.userDashboard.giveReview}</span>
                        </button>
                      )}

                      {booking.status === 'COMPLETED' && booking.hasReviewed && (
                        <span className="text-xs font-semibold text-emerald-600">
                          {t.userDashboard.reviewSubmitted}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* REAL ONLINE QR CODE E-TICKET MODAL */}
      {activeQrModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            {/* Header Tiket Resmi */}
            <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black tracking-wide uppercase">DISBUDPORA KAB. BEKASI</h4>
                    <p className="text-[10px] text-emerald-200 font-semibold">Official Sports Pass &amp; E-Ticket</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveQrModalBooking(null)}
                  className="rounded-xl bg-white/10 p-1.5 text-white hover:bg-white/20 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 border-t border-white/15 pt-3">
                <span className="inline-block rounded-md bg-emerald-950/40 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-200">
                  #{activeQrModalBooking.id}
                </span>
                <h3 className="text-base font-black text-white mt-1">
                  {activeQrModalBooking.venueName}
                </h3>
                <p className="text-[11px] text-emerald-100/80">
                  {activeQrModalBooking.items[0]?.fieldName || 'Fasilitas Olahraga'} • {activeQrModalBooking.venueAddress}
                </p>
              </div>
            </div>

            {/* Konten QR Asli & Rincian */}
            <div className="p-5 text-center">
              {/* QR Code Container */}
              <div className="mx-auto my-2 w-56 p-3 rounded-2xl bg-white border-2 border-dashed border-slate-300 shadow-inner flex flex-col items-center justify-center min-h-[224px]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code E-Ticket ${activeQrModalBooking.id}`}
                    className="h-48 w-48 object-contain rounded-xl"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 w-48 text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-600 mb-2" />
                    <span className="text-xs">Menyiapkan QR Resmi...</span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Terverifikasi Lunas via {activeQrModalBooking.paymentMethod}</span>
              </div>

              <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                Scan kode QR ini menggunakan kamera ponsel petugas lapangan untuk verifikasi kedatangan resmi.
              </p>

              {/* Rincian Jadwal & Identitas */}
              <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Penyewa:</span>
                  <strong className="text-slate-800 font-bold">{activeQrModalBooking.senderName || activeUser?.name}</strong>
                </div>
                {activeQrModalBooking.nik && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">NIK/NISN:</span>
                    <strong className="font-mono text-slate-800">{activeQrModalBooking.nik}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Tanggal:</span>
                  <strong className="text-slate-800">
                    📅 {activeQrModalBooking.items[0]?.date ? new Date(activeQrModalBooking.items[0].date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jam Sewa:</span>
                  <strong className="font-mono text-emerald-700">
                    ⏰ {activeQrModalBooking.items.map((i) => i.timeStart).join(', ')} WIB
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Nominal:</span>
                  <strong className="text-slate-900 font-bold">
                    {formatRupiah(activeQrModalBooking.grandTotal)}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyToken(activeQrModalBooking.qrCodeToken || activeQrModalBooking.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{isCopied ? 'Tersalin!' : 'Salin Kode'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintTicket}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Cetak / Unduh</span>
                </button>
              </div>

              {/* Direct Verification Link (Testing / Shortcut) */}
              <div className="mt-3 border-t border-slate-100 pt-3">
                <a
                  href={`/ticket/verify?token=${encodeURIComponent(activeQrModalBooking.qrCodeToken || activeQrModalBooking.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Uji Buka Halaman Verifikasi Online Petugas</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW & RATING MODAL */}
      {reviewModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {t.userDashboard.reviewModalTitle}
              </h3>
              <button
                onClick={() => setReviewModalBooking(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendReview} className="mt-4 space-y-4">
              <div>
                <div className="text-xs font-bold text-slate-700">
                  Venue: {reviewModalBooking.venueName}
                </div>
                <div className="text-xs text-slate-400">
                  {t.userDashboard.shareExperience}
                </div>
              </div>

              {/* Star rating selector */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  {t.userDashboard.courtRating}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                        s <= rating
                          ? 'bg-amber-400 text-white scale-110 shadow-sm'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      <Star className={`h-5 w-5 ${s <= rating ? 'fill-white' : ''}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-slate-800">
                    {rating} {t.userDashboard.starsOf}
                  </span>
                </div>
              </div>

              {/* Comment text area */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  {t.userDashboard.reviewCommentLabel}
                </label>
                <textarea
                  rows={3}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t.userDashboard.reviewPlaceholder}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                {t.userDashboard.submitReview}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* MODAL UPLOAD BUKTI BAYAR */}
      {selectedUploadBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Unggah Bukti Bayar #{selectedUploadBooking.id}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedUploadBooking.venueName} • {selectedUploadBooking.items[0]?.date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUploadBooking(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadProofSubmit} className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200/60 text-xs flex justify-between items-center">
                <span className="text-slate-500">Total Nominal:</span>
                <span className="font-black text-emerald-700">
                  {new Intl.NumberFormat(activeLang === 'US' ? 'en-US' : 'id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    maximumFractionDigits: 0,
                  }).format(selectedUploadBooking.grandTotal)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Berkas Struk / Tangkapan Layar (JPG, PNG, WebP)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      setUploadError('Hanya berkas gambar (JPG, PNG, WEBP) yang diperbolehkan.');
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setUploadError('Ukuran berkas maksimal 5 MB.');
                      return;
                    }
                    setUploadError(null);
                    setUploadFile(file);
                    setUploadFileName(file.name);
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              {uploadFile && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <img
                    src={URL.createObjectURL(uploadFile)}
                    alt="Preview"
                    className="h-14 w-14 rounded-xl object-cover border border-emerald-300 shrink-0"
                  />
                  <div className="overflow-hidden text-xs">
                    <div className="font-bold text-slate-800 truncate">{uploadFileName}</div>
                    <div className="text-[11px] text-emerald-700">
                      {(uploadFile.size / 1024).toFixed(1)} KB • Siap diunggah
                    </div>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUploadBooking(null)}
                  className="w-1/2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="w-1/2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isUploading ? 'Mengunggah...' : 'Kirim Bukti'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
