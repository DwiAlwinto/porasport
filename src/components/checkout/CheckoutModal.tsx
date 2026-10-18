"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getSystemSettings } from '../../actions/settingsActions';
import {
  X,
  Clock,
  QrCode,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  UploadCloud,
  FileText,
  AlertCircle,
  Eye,
  Trash2,
  Download,
  Building,
  CreditCard,
  XCircle,
  Lock,
} from 'lucide-react';
import { Booking } from '../../types';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutModalOpen,
    setIsCheckoutModalOpen,
    activeBookingDraft,
    activeUser,
    completePayment,
    setActiveView,
    venues,
    t,
    activeLang,
  } = useApp();

  // 60 Minutes countdown timer in seconds (60 * 60 = 3600)
  const [secondsLeft, setSecondsLeft] = useState<number>(3600);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

  // Form input verification states
  const [nik, setNik] = useState<string>('');
  const [npwp, setNpwp] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isAmountConfirmed, setIsAmountConfirmed] = useState(false);

  // OCR Validation states
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'passed' | 'failed' | 'manual_review'>('idle');
  const [ocrResult, setOcrResult] = useState<any>(null);

  // Cancel booking state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // QRIS settings loaded dynamically from DB
  const [qrisUrl, setQrisUrl] = useState('/images/qris-disbudpora.png');
  const [qrisLabel, setQrisLabel] = useState('DISBUDPORA KAB. BEKASI');
  const [paymentNotesTxt, setPaymentNotesTxt] = useState('Rekening Resmi Dinas Kebudayaan, Pemuda dan Olahraga Kabupaten Bekasi.');
  const [isDownloadingQris, setIsDownloadingQris] = useState(false);

  useEffect(() => {
    if (!isCheckoutModalOpen) {
      setSecondsLeft(3600);
      setCompletedBooking(null);
      setIsProcessing(false);
      setNik('');
      setNpwp('');
      setSenderName('');
      setSenderPhone('');
      setPaymentProofFile(null);
      setProofFileName('');
      setFormError(null);
      setIsAmountConfirmed(false);
      setOcrStatus('idle');
      setOcrResult(null);
      setShowCancelConfirm(false);
      return;
    }

    // Auto-fill sender phone from user profile
    if (activeUser?.phone) {
      setSenderPhone(activeUser.phone);
    }

    // Load QRIS settings setiap kali modal dibuka
    getSystemSettings().then((s) => {
      if (s.qris_image_url) setQrisUrl(s.qris_image_url);
      if (s.qris_label) setQrisLabel(s.qris_label);
      if (s.payment_notes) setPaymentNotesTxt(s.payment_notes);
    });

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isCheckoutModalOpen]);

  if (!isCheckoutModalOpen || !activeBookingDraft) return null;

  const venue = venues.find((v) => v.id === activeBookingDraft.venueId);
  const subtotal = activeBookingDraft.items.reduce((sum, item) => sum + item.price, 0);
  const serviceFee = 0;
  const grandTotal = subtotal;

  // Format MM:SS
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timerString = `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat(activeLang === 'US' ? 'en-US' : 'id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Handle file picker for payment proof
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar struk/bukti transfer (JPG, PNG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB.');
      return;
    }

    setProofFileName(file.name);
    setPaymentProofFile(file);
    setFormError(null);
  };

  const handleRemoveProof = () => {
    setPaymentProofFile(null);
    setProofFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download QRIS image
  const handleDownloadQRIS = async () => {
    try {
      setIsDownloadingQris(true);
      const downloadEndpoint = `/api/download-qris?url=${encodeURIComponent(qrisUrl)}`;
      const link = document.createElement('a');
      link.href = downloadEndpoint;
      link.download = `QRIS-DISBUDPORA-BEKASI-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Download QRIS error:', e);
      window.open(qrisUrl, '_blank');
    } finally {
      setTimeout(() => setIsDownloadingQris(false), 600);
    }
  };

  // Submit proof and create booking in DB
  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAmountConfirmed) {
      setFormError('Mohon centang konfirmasi nominal transfer terlebih dahulu.');
      return;
    }

    // Validasi NIK
    const cleanNik = nik.trim().replace(/\D/g, '');
    if (!cleanNik || cleanNik.length < 16) {
      setFormError('Nomor Induk Kependudukan (NIK) wajib 16 digit angka.');
      return;
    }

    // Validasi bukti transfer
    if (!paymentProofFile) {
      setFormError('Silakan unggah foto / screenshot bukti transfer pembayaran QRIS.');
      return;
    }

    setIsProcessing(true);
    setFormError(null);
    setOcrStatus('processing');

    try {
      const realBooking = await completePayment('unused-id', 'QRIS', {
        nik: cleanNik,
        npwp: npwp.trim() || undefined,
        senderName: senderName.trim() || activeUser?.name,
        senderPhone: senderPhone.trim() || activeUser?.phone,
        paymentProofFile: paymentProofFile,
      });

      if (realBooking) {
        setCompletedBooking(realBooking);
        if (realBooking.ocrValidationResult) {
          setOcrResult(realBooking.ocrValidationResult);
          setOcrStatus(realBooking.status === 'PAID_SUCCESS' ? 'passed' : 'manual_review');
        } else {
          setOcrStatus('idle');
        }
      } else {
        setFormError('Gagal memproses pesanan. Silakan coba kembali.');
        setOcrStatus('failed');
      }
    } catch (err: unknown) {
      console.error(err);
      // Pesan dari server action yang dilempar sudah disanitasi di sisi server.
      setFormError('Terjadi kendala saat memproses pembayaran. Silakan coba lagi.');
      setOcrStatus('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative my-8 w-full max-w-2xl rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900">
                Pembayaran QRIS DISBUDPORA
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Pemerintah Kabupaten Bekasi • Dinas Kebudayaan, Pemuda &amp; Olahraga
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!completedBooking && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-600/20">
                <Clock className="h-3.5 w-3.5 animate-pulse" />
                <span>{timerString}</span>
              </div>
            )}
            <button
              onClick={() => setIsCheckoutModalOpen(false)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CONTENT BODY */}
        <div className="max-h-[80vh] overflow-y-auto p-6">

          {/* SLOT LOCK BANNER — tampil selama payment sedang berlangsung */}
          {!completedBooking && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
                <Lock className="h-4 w-4 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-amber-900">Slot Dikunci untuk Kamu</div>
                <div className="text-[11px] text-amber-700 leading-relaxed">
                  Selesaikan pembayaran dalam <span className="font-black text-amber-900">{timerString}</span> sebelum slot dilepas otomatis.
                </div>
              </div>
            </div>
          )}

          {completedBooking ? (
            /* VIEW 1: SUCCESS SUBMITTED VIEW */
            <div className="text-center py-4 space-y-5">
              {completedBooking.status === 'PAID_SUCCESS' ? (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
              ) : (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-600 ring-8 ring-amber-500/5">
                  <Clock className="h-8 w-8 animate-pulse" />
                </div>
              )}

              <div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${
                  completedBooking.status === 'PAID_SUCCESS'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {completedBooking.status === 'PAID_SUCCESS' ? 'LUNAS & Tiket Terbit' : 'Menunggu Validasi Admin'}
                </span>
                <h4 className="mt-2 text-xl font-black text-slate-900">
                  {completedBooking.status === 'PAID_SUCCESS'
                    ? 'Pembayaran Berhasil Divalidasi Otomatis!'
                    : 'Bukti Pembayaran Berhasil Dikirim!'}
                </h4>
                <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
                  {completedBooking.status === 'PAID_SUCCESS'
                    ? 'Nominal, tanggal, dan kata kunci struk cocok. Tiket sewa sudah terbit.'
                    : 'Data NIK, NPWP, dan struk transfer QRIS Anda telah kami terima. Tim Admin DISBUDPORA akan memvalidasi bukti Anda dengan notifikasi mutasi/email masuk.'}
                </p>
              </div>

              {/* OCR Validation Detail for MENUNGGU_VALIDASI */}
              {completedBooking.status === 'MENUNGGU_VALIDASI' && completedBooking.ocrValidationResult && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left space-y-2 text-xs">
                  <div className="font-bold text-blue-800 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    Detail Validasi OCR Otomatis
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`rounded-xl p-2 text-[10px] font-bold ${completedBooking.ocrValidationResult.amountMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      <div>{completedBooking.ocrValidationResult.amountMatch ? '✅' : '❌'}</div>
                      <div>Nominal</div>
                    </div>
                    <div className={`rounded-xl p-2 text-[10px] font-bold ${completedBooking.ocrValidationResult.dateMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      <div>{completedBooking.ocrValidationResult.dateMatch ? '✅' : '❌'}</div>
                      <div>Tanggal</div>
                    </div>
                    <div className={`rounded-xl p-2 text-[10px] font-bold ${completedBooking.ocrValidationResult.keywordMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      <div>{completedBooking.ocrValidationResult.keywordMatch ? '✅' : '❌'}</div>
                      <div>Kata Kunci</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-blue-700">
                    Admin akan mencocokkan dengan mutasi rekening BJB DISBUDPORA.
                  </div>
                </div>
              )}

              {/* Booking Summary Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Nomor Booking</span>
                  <span className="font-mono font-black text-slate-900">{completedBooking.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Venue</span>
                  <span className="font-bold text-slate-800">{completedBooking.venueName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jadwal Sewa</span>
                  <span className="font-bold text-slate-800">
                    {completedBooking.items[0]?.date} • {completedBooking.items.map(i => i.timeStart).join(', ')} WIB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Nominal</span>
                  <span className="font-black text-emerald-700">{formatRupiah(completedBooking.grandTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NIK Pemesan</span>
                  <span className="font-mono font-bold text-slate-700">{completedBooking.nik || '-'}</span>
                </div>
                {completedBooking.npwp && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">NPWP</span>
                    <span className="font-mono text-slate-700">{completedBooking.npwp}</span>
                  </div>
                )}
                {completedBooking.senderName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pengirim Transfer</span>
                    <span className="font-bold text-slate-700">{completedBooking.senderName}</span>
                  </div>
                )}
              </div>

              {/* Konfirmasi bukti transfer.
                 Komponen ini sengaja TIDAK merender berkas bukti dari server.
                  Nilai `paymentProofUrl` adalah path di bucket privat, bukan
                  URL yang bisa dibuka peramban. Membuat signed URL untuk
                  pengguna umum berarti membocorkan bukti transfer yang berisi
                  data rekening ke siapa pun yang punya tautannya. Pengguna
                  sudah melihat pratinjau berkas miliknya sendiri sebelum
                  mengunggah, jadi konfirmasi teks sudah cukup. */}
              {completedBooking.paymentProofUrl && (
                <div className="rounded-2xl border border-slate-200 p-3 bg-white text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Lampiran Bukti Transfer:
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50">
                      <ShieldCheck className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-slate-800">Screenshot Struk QRIS</div>
                      <div className="text-slate-400 text-[11px]">
                        Tersimpan di penyimpanan server dan menunggu verifikasi admin
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  onClick={() => {
                    setIsCheckoutModalOpen(false);
                    setActiveView('USER_DASHBOARD');
                  }}
                  className="rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  Lihat di Riwayat Pemesanan
                </button>
                <button
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            /* VIEW 2: CHECKOUT STEP: QRIS DISPLAY + PROOF FORM */
            <form onSubmit={handleSubmitProof} className="space-y-6">
              
              {/* ORDER SUMMARY BANNER */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                      Rincian Sewa Lapangan
                    </div>
                    <h4 className="mt-1 text-sm font-black text-slate-900">{venue?.name}</h4>
                    <p className="text-xs text-slate-600">
                      {activeBookingDraft.items[0]?.fieldName} • {activeBookingDraft.items[0]?.date} (
                      <span className="font-bold text-slate-900">
                        {activeBookingDraft.items.map((i) => `${i.timeStart}-${i.timeEnd}`).join(', ')} WIB
                      </span>
                      )
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total Bayar
                    </div>
                    <div className="text-lg font-black text-emerald-700">
                      {formatRupiah(grandTotal)}
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 1: SCAN QRIS DISBUDPORA */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                      1
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      Scan QRIS Resmi DISBUDPORA
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadQRIS}
                    disabled={isDownloadingQris}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition active:scale-95 disabled:opacity-50"
                  >
                    <Download className={`h-3.5 w-3.5 ${isDownloadingQris ? 'animate-bounce' : ''}`} />
                    {isDownloadingQris ? 'Mengunduh...' : 'Unduh QRIS'}
                  </button>
                </div>

                <div className="mt-4 flex flex-col items-center sm:flex-row sm:items-start sm:gap-6">
                  {/* Gambar Standee Poster QRIS DISBUDPORA Asli */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative group shrink-0 rounded-2xl border-2 border-slate-900/10 p-2 bg-white shadow-md">
                      <img
                        src={qrisUrl}
                        alt="QRIS DISBUDPORA Kabupaten Bekasi"
                        className="h-64 w-auto rounded-xl object-contain"
                      />
                      <div className="mt-1 text-center font-bold text-[10px] text-slate-700">
                        {qrisLabel}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadQRIS}
                      disabled={isDownloadingQris}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-[11px] font-bold border border-slate-200 transition active:scale-95"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-600" />
                      Download Barcode QRIS
                    </button>
                  </div>

                  {/* Petunjuk Pembayaran */}
                  <div className="mt-4 sm:mt-0 flex-1 space-y-3 text-xs text-slate-600">
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                      <div className="font-bold text-slate-900 mb-1">Cara Pembayaran:</div>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                        <li>Buka aplikasi M-Banking (BCA, Mandiri, BRI, BNI) atau E-Wallet (GoPay, OVO, Dana, ShopeePay).</li>
                        <li>Pilih menu <strong>Scan / Bayar QRIS</strong>.</li>
                        <li>Arahkan kamera ke QR Code <strong>DISBUDPORA</strong> di samping.</li>
                        <li>Masukkan nominal persis: <strong className="text-emerald-700">{formatRupiah(grandTotal)}</strong>.</li>
                        <li>Simpan screenshot / bukti transfer setelah pembayaran berhasil.</li>
                      </ol>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{paymentNotesTxt}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2: FORM DATA NIK, NPWP & UPLOAD BUKTI */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                    2
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Isi Data Verifikasi &amp; Bukti Transfer
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Data ini diperlukan untuk validasi pemesanan dan bukti transaksi sewa.
                    </p>
                  </div>
                </div>

                {/* Form Fields: NIK & NPWP */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Nomor Induk Kependudukan (NIK) *</span>
                      <span className="text-[10px] text-slate-400 font-normal">16 digit</span>
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      required
                      placeholder="Contoh: 3216012345670001"
                      value={nik}
                      onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>NPWP (Opsional)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Komunitas / PT</span>
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="Contoh: 01.234.567.8-413.000"
                      value={npwp}
                      onChange={(e) => setNpwp(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                </div>

                {/* Nama Pengirim Rekening */}
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Nama Pemilik Rekening / Akun E-Wallet Pengirim *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Sesuai aplikasi m-Banking</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Zagar (BCA) / Dimas (GoPay)"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                {/* Nomor Telepon Pengirim */}
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Nomor Telepon Pengirim *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Untuk notifikasi status pembayaran</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Contoh: 081234567890"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value.replace(/\D/g, ''))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    maxLength={13}
                  />
                </div>

                {/* Upload Bukti Transfer Box */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Unggah Bukti Transfer / Screenshot Pembayaran QRIS *
                  </label>

                  {/* Amount Confirmation Checkbox - REQUIRED before upload */}
                  <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 mb-3 cursor-pointer transition hover:bg-amber-100">
                    <input
                      type="checkbox"
                      checked={isAmountConfirmed}
                      onChange={(e) => setIsAmountConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      required
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      Saya telah mentransfer nominal <strong className="text-emerald-700">{formatRupiah(grandTotal)}</strong> TEPAT SESUAI tagihan.
                      <br />
                      <span className="text-red-600 font-semibold">Kesalahan nominal akan menyebabkan pesanan ditolak.</span>
                    </span>
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={!isAmountConfirmed}
                    className="hidden"
                  />

                  {paymentProofFile ? (
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50/50 p-3.5">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img
                          src={URL.createObjectURL(paymentProofFile)}
                          alt="Preview Struk"
                          className="h-14 w-14 rounded-xl object-cover border border-emerald-200 shrink-0"
                        />
                        <div className="overflow-hidden">
                          <div className="truncate text-xs font-bold text-slate-900">
                            {proofFileName || 'struk-transfer.jpg'}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-medium">
                            ✓ Bukti gambar siap diverifikasi
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveProof}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Hapus gambar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => isAmountConfirmed && fileInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 p-6 text-center cursor-pointer transition ${
                        isAmountConfirmed
                          ? 'border-dashed border-slate-300 bg-slate-50/80 hover:border-emerald-500 hover:bg-emerald-50/30'
                          : 'border-dashed border-slate-200 bg-slate-100/50 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
                      <div className="text-xs font-bold text-slate-800">
                        {isAmountConfirmed ? 'Klik untuk Mengunggah Foto Bukti Transfer' : 'Centang konfirmasi di atas untuk mengaktifkan unggah'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Format JPG atau PNG (Maks. 5 MB)
                      </div>
                    </div>
                  )}
                </div>

                {/* OCR Validation Status */}
                {ocrStatus !== 'idle' && (
                  <div className={`rounded-xl p-3 text-xs font-medium border ${
                    ocrStatus === 'processing'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : ocrStatus === 'passed'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : ocrStatus === 'manual_review'
                          ? 'border-blue-200 bg-blue-50 text-blue-800'
                          : 'border-red-200 bg-red-50 text-red-800'
                  }`}>
                    {ocrStatus === 'processing' && (
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                        <span>Memvalidasi bukti transfer dengan OCR...</span>
                      </div>
                    )}
                    {ocrStatus === 'passed' && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>✅ Validasi otomatis BERHASIL! Pesanan langsung LUNAS.</span>
                      </div>
                    )}
                    {ocrStatus === 'manual_review' && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold">⚠️ Validasi otomatis memerlukan review manual</div>
                          <div className="text-[10px] mt-0.5">
                            {ocrResult ? (
                              <>
                                {!ocrResult.amountMatch && <div>• Nominal tidak sesuai</div>}
                                {!ocrResult.dateMatch && <div>• Tanggal tidak sesuai hari ini</div>}
                                {!ocrResult.keywordMatch && <div>• Kata kunci DISBUDPORA/BJB/PAN tidak ditemukan</div>}
                              </>
                            ) : (
                              'Struk akan diverifikasi oleh admin DISBUDPORA'
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {ocrStatus === 'failed' && (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        <span>❌ Validasi gagal. Silakan coba unggah ulang dengan struk yang jelas.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {formError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isProcessing}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 py-4 text-sm font-black text-white shadow-xl shadow-emerald-600/30 transition hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Mengirim Bukti &amp; Menyimpan Data...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Kirim Bukti Pembayaran untuk Verifikasi</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* CANCEL BOOKING BUTTON */}
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 py-3 text-xs font-bold text-red-600 transition hover:bg-red-100"
              >
                <XCircle className="h-4 w-4" />
                Batalkan Pesanan
              </button>

              <p className="text-center text-[10px] text-slate-400">
                🔒 Pembayaran akan divalidasi oleh Admin DISBUDPORA sebelum e-Ticket diterbitkan.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* ============================================================
          CANCEL CONFIRM DIALOG
          ============================================================ */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
            <div className="bg-red-50 p-5 text-center border-b border-red-100">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-base font-black text-slate-900">Batalkan Pesanan?</h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Slot jam yang sudah kamu pilih akan <strong>dilepas kembali</strong> dan bisa dipesan orang lain.
                Kamu bisa memilih ulang jadwal setelah ini.
              </p>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                ⚠️ Jika sudah melakukan transfer QRIS, hubungi Admin DISBUDPORA untuk proses pengembalian dana.
              </div>
              <button
                onClick={() => {
                  setIsCheckoutModalOpen(false);
                  setShowCancelConfirm(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-red-600 hover:bg-red-700 py-3 text-xs font-black text-white uppercase tracking-wider transition"
              >
                <XCircle className="h-4 w-4" />
                Ya, Batalkan Pesanan
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-700 transition"
              >
                Kembali, Lanjutkan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
