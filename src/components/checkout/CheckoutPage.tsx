"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getSystemSettings } from '../../actions/settingsActions';
import {
  Clock,
  QrCode,
  CheckCircle2,
  Trash2,
  AlertCircle,
  UploadCloud,
  XCircle,
  FileText,
  Lock,
  ArrowRight,
  Download,
  Eye,
} from 'lucide-react';
import { Booking } from '../../types';

export const CheckoutPage: React.FC = () => {
  const {
    activeBookingDraft,
    setActiveBookingDraft,
    cancelActiveBookingDraft,
    activeUser,
    completePayment,
    setActiveView,
    venues,
    t,
    activeLang,
  } = useApp();

  const [step, setStep] = useState<1 | 2>(1);

  // 10 Minutes (600s) countdown timer
  const LOCK_DURATION = 600;
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedEnd = sessionStorage.getItem('gelora_checkout_end_time_v1');
        if (storedEnd) {
          const diff = Math.round((parseInt(storedEnd, 10) - Date.now()) / 1000);
          if (diff > 0) return diff;
        }
      } catch {}
    }
    return LOCK_DURATION;
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);
  const completedBookingRef = useRef<Booking | null>(null);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  // Form input verification states
  const [nik, setNik] = useState<string>('');
  const [npwp, setNpwp] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [customerNote, setCustomerNote] = useState<string>('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isTnCAccepted, setIsTnCAccepted] = useState(false);
  const [isAmountConfirmed, setIsAmountConfirmed] = useState(false);

  // OCR Validation states
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'passed' | 'failed' | 'manual_review'>('idle');
  const [ocrResult, setOcrResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // QRIS settings loaded dynamically from DB
  const [qrisUrl, setQrisUrl] = useState('/images/qris-disbudpora.png');
  const [qrisLabel, setQrisLabel] = useState('DISBUDPORA KAB. BEKASI');
  const [paymentNotesTxt, setPaymentNotesTxt] = useState('Rekening Resmi Dinas Kebudayaan, Pemuda dan Olahraga Kabupaten Bekasi.');
  const [isDownloadingQris, setIsDownloadingQris] = useState(false);

  // Deteksi apakah booking ini untuk kategori Pelajar / Sekolah / Institusi Pendidikan
  const isEducationOrStudent = React.useMemo(() => {
    if (!activeBookingDraft) return false;
    const cat = activeBookingDraft.userCategory;
    const label = (activeBookingDraft.userCategoryLabel || '').toLowerCase();
    const keywords = [
      'sekolah',
      'pelajar',
      'siswa',
      'perguruan tinggi',
      'institusi',
      'mahasiswa',
      'kampus',
      'universitas',
      'student',
      'school'
    ];
    if (keywords.some((k) => label.includes(k))) return true;
    if (cat === 'AMATIR') return true;
    return false;
  }, [activeBookingDraft]);

  useEffect(() => {
    // Load QRIS settings
    getSystemSettings().then((s) => {
      if (s.qris_image_url) setQrisUrl(s.qris_image_url);
      if (s.qris_label) setQrisLabel(s.qris_label);
      if (s.payment_notes) setPaymentNotesTxt(s.payment_notes);
    });

    if (typeof window !== 'undefined') {
      let storedEnd = sessionStorage.getItem('gelora_checkout_end_time_v1');
      if (!storedEnd) {
        const expiresAtMs = activeBookingDraft?.expiresAt
          ? new Date(activeBookingDraft.expiresAt).getTime()
          : null;
        storedEnd = (expiresAtMs && expiresAtMs > Date.now()
          ? expiresAtMs
          : Date.now() + LOCK_DURATION * 1000
        ).toString();
        try {
          sessionStorage.setItem('gelora_checkout_end_time_v1', storedEnd);
        } catch {}
      }

      const updateTimer = () => {
        // Jangan jalankan countdown timer jika pesanan sudah berhasil dibuat
        if (completedBookingRef.current) return;

        const rawEnd = sessionStorage.getItem('gelora_checkout_end_time_v1');
        // Jika sessionStorage sudah dibersihkan karena submit selesai, jangan picu timeout!
        if (!rawEnd) return;

        const end = parseInt(rawEnd, 10);
        if (isNaN(end) || end <= 0) return;

        const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
        setSecondsLeft(remaining);

        if (remaining <= 0 && !completedBookingRef.current) {
          setShowTimeoutModal(true);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  // Warning when leaving tab or closing window while draft is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeBookingDraft && !completedBooking) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeBookingDraft, completedBooking]);

  const handleConfirmCancel = () => {
    setShowCancelConfirmModal(false);
    cancelActiveBookingDraft();
    setActiveView('VENUE_DETAIL');
  };

  const handleTimeoutAcknowledge = () => {
    setShowTimeoutModal(false);
    if (!completedBooking && !completedBookingRef.current) {
      cancelActiveBookingDraft();
    }
    setActiveView('VENUE_DETAIL');
  };

  // Auto-fill sender phone from user profile
  useEffect(() => {
    if (activeUser?.phone && !senderPhone) {
      setSenderPhone(activeUser.phone);
    }
  }, [activeUser, senderPhone]);

  if (!activeBookingDraft && !completedBooking) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800">{t.checkout.noActiveOrder}</h2>
        <p className="mt-2 text-sm text-slate-500 mb-6">{t.checkout.selectScheduleFirst}</p>
        <button
          onClick={() => setActiveView('EXPLORE')}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          {t.checkout.searchCourt}
        </button>
      </div>
    );
  }

  const venueId = activeBookingDraft?.venueId || completedBooking?.venueId;
  const venue = venues.find((v) => v.id === venueId);
  const subtotal = activeBookingDraft
    ? activeBookingDraft.items.reduce((sum, item) => sum + item.price, 0)
    : (completedBooking?.grandTotal || completedBooking?.totalPrice || 0);
  const serviceFee = 0;
  const grandTotal = subtotal;

  // Format MM:SS
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timerString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat(activeLang === 'US' ? 'en-US' : 'id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Handle file picker for payment proof
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Mohon pilih file gambar struk/bukti transfer (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Ukuran file maksimal 5 MB.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setProofFileName(file.name);
    setPaymentProofFile(file);
    setFormError(null);
  };

  const handleRemoveProof = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
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

    if (!isTnCAccepted) {
      setFormError('Mohon setujui Syarat & Ketentuan terlebih dahulu.');
      return;
    }

    if (!isAmountConfirmed) {
      setFormError('Mohon centang konfirmasi nominal transfer terlebih dahulu.');
      return;
    }

    // Validasi NIK / NISN / NIM / NPSN
    let cleanId = '';
    if (isEducationOrStudent) {
      cleanId = nik.trim().replace(/[^a-zA-Z0-9-]/g, '');
      if (!cleanId || cleanId.length < 8) {
        setFormError(t.checkout.identityOrNikError || 'Nomor identitas (NISN / NIM / NPSN / NIK) minimal 8 karakter.');
        return;
      }
    } else {
      cleanId = nik.trim().replace(/\D/g, '');
      if (!cleanId || cleanId.length !== 16) {
        setFormError('Nomor Induk Kependudukan (NIK) wajib 16 digit angka.');
        return;
      }
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
      const realBooking = await completePayment(
        activeBookingDraft?.bookingId || 'unused-id',
        'QRIS',
        {
          nik: cleanId,
          npwp: npwp.trim() || undefined,
          senderName: senderName.trim() || activeUser?.name,
          senderPhone: senderPhone.trim() || activeUser?.phone,
          paymentProofFile: paymentProofFile,
        }
      );

      if (realBooking) {
        setCompletedBooking(realBooking);
        completedBookingRef.current = realBooking;
        setShowTimeoutModal(false);
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
      console.error('[CheckoutPage] Error:', err);
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memproses pembayaran. Silakan coba lagi.';
      setFormError(msg);
      setOcrStatus('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveItem = () => {
    // For now, if they remove the only item, we cancel and go back
    setActiveView('VENUE_DETAIL');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        
        {/* PROGRESS BAR */}
        {!completedBooking && (
          <div className="mb-10 px-4">
            <div className="relative flex items-center justify-between">
              {/* Line */}
              <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-slate-200"></div>
              <div 
                className="absolute left-0 top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-[#ff5722] transition-all duration-500"
                style={{ width: step === 1 ? '50%' : '100%' }}
              ></div>

              {/* Step 1 Indicator */}
              <div className="flex flex-col items-center">
                <div className={`flex h-4 w-4 items-center justify-center rounded-full shadow-sm ring-4 ring-slate-50 ${step >= 1 ? 'bg-[#ff5722]' : 'bg-slate-300'}`}>
                </div>
                <span className={`mt-3 text-sm font-bold ${step >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {t.checkout.validateItems}
                </span>
              </div>

              {/* Step 2 Indicator */}
              <div className="flex flex-col items-center">
                <div className={`flex h-4 w-4 items-center justify-center rounded-full shadow-sm ring-4 ring-slate-50 ${step >= 2 ? 'bg-[#ff5722]' : 'bg-slate-300'}`}>
                </div>
                <span className={`mt-3 text-sm font-bold ${step >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {t.checkout.dataAndPayment}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TIMER */}
        {!completedBooking && (
          <div className={`mb-6 mx-auto max-w-2xl flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xs transition-colors ${
            secondsLeft < 120
              ? 'border-red-300 bg-red-50 text-red-900 animate-pulse'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              secondsLeft < 120 ? 'bg-red-500/20 text-red-700' : 'bg-amber-500/20 text-amber-700'
            }`}>
              <Lock className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-black ${secondsLeft < 120 ? 'text-red-950' : 'text-amber-900'}`}>
                {t.checkout.slotLockedTitle}
              </div>
              <div className={`text-xs leading-relaxed ${secondsLeft < 120 ? 'text-red-800' : 'text-amber-700'}`}>
                {t.checkout.slotLockedNoticePrefix}{' '}
                <span className={`font-mono font-black px-1.5 py-0.5 rounded ${
                  secondsLeft < 120 ? 'bg-red-200 text-red-900' : 'bg-amber-200/60 text-amber-950'
                }`}>
                  {timerString}
                </span>{' '}
                {t.checkout.slotLockedNoticeSuffix}
              </div>
            </div>
          </div>
        )}

        {/* SUCCESS VIEW */}
        {completedBooking && (
          <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 text-center space-y-6">
            {completedBooking.status === 'PAID_SUCCESS' ? (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-500/10">
                <CheckCircle2 className="h-10 w-10" />
              </div>
            ) : (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-500/10">
                <Clock className="h-10 w-10 animate-pulse" />
              </div>
            )}
            <div>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${
                completedBooking.status === 'PAID_SUCCESS'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {completedBooking.status === 'PAID_SUCCESS' ? t.checkout.paidAndTicketIssued : t.checkout.waitingAdminValidation}
              </span>
              <h2 className="mt-4 text-2xl font-black text-slate-900">
                {completedBooking.status === 'PAID_SUCCESS'
                  ? t.checkout.paymentAutoValidated
                  : t.checkout.paymentProofSubmitted}
              </h2>
              <p className="mt-2 text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                {completedBooking.status === 'PAID_SUCCESS'
                  ? t.checkout.paymentSuccessDetail
                  : t.checkout.paymentWaitDetail}
              </p>
            </div>

            {/* OCR Validation Detail for MENUNGGU_VALIDASI */}
            {completedBooking.status === 'MENUNGGU_VALIDASI' && completedBooking.ocrValidationResult && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left space-y-3 text-sm">
                <div className="font-bold text-blue-800 flex items-center gap-1.5">
                  <AlertCircle className="h-5 w-5" />
                  {t.checkout.ocrValidationTitle}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`rounded-xl p-3 text-xs font-bold ${completedBooking.ocrValidationResult.amountMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    <div>{completedBooking.ocrValidationResult.amountMatch ? '✅' : '❌'}</div>
                    <div>{t.checkout.ocrAmount}</div>
                  </div>
                  <div className={`rounded-xl p-3 text-xs font-bold ${completedBooking.ocrValidationResult.dateMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    <div>{completedBooking.ocrValidationResult.dateMatch ? '✅' : '❌'}</div>
                    <div>{t.checkout.ocrDate}</div>
                  </div>
                  <div className={`rounded-xl p-3 text-xs font-bold ${completedBooking.ocrValidationResult.keywordMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    <div>{completedBooking.ocrValidationResult.keywordMatch ? '✅' : '❌'}</div>
                    <div>{t.checkout.ocrKeyword}</div>
                  </div>
                </div>
                <div className="text-xs text-blue-700">
                  {t.checkout.ocrAdminNote}
                </div>
              </div>
            )}

            {/* Booking Summary Box */}
            <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-3">
                <span className="text-slate-500 font-medium">{t.checkout.bookingNumber}</span>
                <span className="font-mono font-black text-slate-900">{completedBooking.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t.checkout.venue}</span>
                <span className="font-bold text-slate-800">{completedBooking.venueName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t.checkout.rentalSchedule}</span>
                <span className="font-bold text-slate-800">
                  {completedBooking.items[0]?.date} • {completedBooking.items.map(i => i.timeStart).join(', ')} WIB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t.checkout.totalAmount}</span>
                <span className="font-black text-emerald-700">{formatRupiah(completedBooking.grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveBookingDraft(null);
                setActiveView('USER_DASHBOARD');
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 shadow-md shadow-slate-900/20"
            >
              {t.checkout.checkBookingStatus}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 1: VALIDASI ITEM */}
        {!completedBooking && step === 1 && (
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-slate-200">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-slate-900">{t.checkout.checkYourOrder}</h2>
                <p className="text-sm text-slate-500 mt-1">{t.checkout.checkOrderDesc}</p>
              </div>

              {/* Items List */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 sm:p-6 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{venue?.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <p className="text-sm text-slate-500">{activeBookingDraft?.sportCategory ? ((t.categories as any)[activeBookingDraft.sportCategory] || activeBookingDraft.sportCategory.replace('_', ' ')) : ''}</p>
                      {activeBookingDraft?.userCategoryLabel && (
                        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          {activeBookingDraft.userCategoryLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{t.checkout.subtotal}</p>
                    <p className="font-black text-slate-900 text-lg">{formatRupiah(subtotal)}</p>
                  </div>
                </div>
                
                {/* Item Details */}
                <div className="bg-slate-50 p-4 sm:p-6 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-bold text-slate-700">
                        {activeBookingDraft?.items[0]?.date} • {activeBookingDraft?.items.map(i => i.timeStart).join(', ')} WIB
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-slate-900">{formatRupiah(subtotal)}</span>
                      <button 
                        onClick={handleRemoveItem}
                        className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.checkout.delete}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION BUTTON */}
            <button
              onClick={() => {
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full rounded-xl bg-[#ff5722] py-4 text-sm font-black text-white shadow-lg shadow-[#ff5722]/30 transition hover:bg-[#e64a19] uppercase tracking-wider"
            >
              {t.checkout.proceedToPayment}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelConfirmModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50/50 transition"
            >
              <XCircle className="h-4 w-4" />
              {t.checkout.cancelBooking}
            </button>
          </div>
        )}

        {/* STEP 2: DATA & PEMBAYARAN */}
        {!completedBooking && step === 2 && (
          <form onSubmit={handleSubmitProof} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              
              {/* LEFT COL: CUSTOMER DETAIL */}
              <div className="lg:col-span-6 space-y-6">
                <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    {t.checkout.customerDetail}
                  </h3>
                  
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">{t.checkout.customerName}</label>
                        <input
                          type="text"
                          value={activeUser?.name || ''}
                          readOnly
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">{t.checkout.customerPhone}</label>
                        <div className="flex">
                          <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 font-medium">
                            🇮🇩 +62
                          </span>
                          <input
                            type="text"
                            value={activeUser?.phone || '000000000'}
                            readOnly
                            className="w-full rounded-r-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">{t.checkout.email}</label>
                      <input
                        type="email"
                        value={activeUser?.email || ''}
                        readOnly
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">{t.checkout.notes}</label>
                      <textarea
                        value={customerNote}
                        onChange={(e) => setCustomerNote(e.target.value)}
                        placeholder={t.checkout.notesPlaceholder}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] outline-none transition"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* DOKUMEN VALIDASI ADMIN */}
                <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                    {t.checkout.validationDocs}
                  </h3>
                  <p className="text-xs text-slate-500 mb-6">{t.checkout.validationDocsDesc}</p>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700 flex justify-between items-center">
                        <span>
                          {isEducationOrStudent
                            ? (t.checkout.identityOrNikLabel || 'Nomor Identitas (NIK / NISN / NIM / NPSN)')
                            : t.checkout.nikLabel}{' '}
                          <span className="text-red-500">*</span>
                        </span>
                        {isEducationOrStudent ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            NISN / NIM / NPSN / NIK
                          </span>
                        ) : (
                          <span className="text-[10px] font-normal text-slate-400">16 digit</span>
                        )}
                      </label>
                      <input
                        type="text"
                        required
                        value={nik}
                        onChange={(e) => {
                          const val = isEducationOrStudent
                            ? e.target.value.replace(/[^a-zA-Z0-9-]/g, '')
                            : e.target.value.replace(/\D/g, '');
                          setNik(val);
                        }}
                        placeholder={
                          isEducationOrStudent
                            ? (t.checkout.identityOrNikPlaceholder || 'Masukkan NISN, NIM, NPSN, atau NIK')
                            : t.checkout.nikPlaceholder
                        }
                        maxLength={isEducationOrStudent ? 20 : 16}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] outline-none transition"
                      />
                      {isEducationOrStudent && (
                        <p className="mt-1.5 text-[11px] text-emerald-700 font-medium flex items-start gap-1.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                          <span className="shrink-0">💡</span>
                          <span>{t.checkout.identityOrNikHelper || 'Siswa dapat mengisi NISN (10 digit), Mahasiswa mengisi NIM/NPM, Perwakilan Sekolah mengisi NPSN (8 digit), atau NIK.'}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700 flex justify-between">
                        <span>{t.checkout.npwpLabel}</span>
                        <span className="text-slate-400 font-normal">{t.checkout.optional}</span>
                      </label>
                      <input
                        type="text"
                        value={npwp}
                        onChange={(e) => setNpwp(e.target.value)}
                        placeholder={t.checkout.optional}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] outline-none transition"
                      />
                    </div>
                    
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700 flex justify-between">
                        <span>{t.checkout.senderNameLabel} <span className="text-red-500">*</span></span>
                      </label>
                      <input
                        type="text"
                        required
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder={t.checkout.senderNamePlaceholder}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] outline-none transition"
                      />
                    </div>
                    
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700 flex justify-between">
                        <span>{t.checkout.senderPhoneLabel} <span className="text-red-500">*</span></span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder={t.checkout.senderPhonePlaceholder}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] outline-none transition"
                        maxLength={13}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COL: PAYMENT & SUMMARY */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* PEMBAYARAN */}
                <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-black text-slate-900">
                      {t.checkout.choosePaymentType}
                    </h3>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      QRIS Auto-Detect
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-6">{t.checkout.securePaymentNote}</p>

                  <div className="rounded-3xl border border-slate-200 overflow-hidden shadow-sm bg-white">
                    {/* Header Tab QRIS */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-3.5 text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm text-emerald-400 border border-white/10 shrink-0">
                          <QrCode className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="font-bold text-sm tracking-wide">QRIS / Transfer Bank</span>
                          <p className="text-[10px] text-slate-400">Verifikasi instan rekening resmi</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Resmi Aktif</span>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-slate-50/60 flex flex-col items-center">
                      <div className="mb-4 text-center">
                        <div className="text-sm font-black text-slate-900">{qrisLabel}</div>
                        <div className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">{paymentNotesTxt}</div>
                      </div>

                      {/* Frame Barcode QRIS */}
                      <div className="relative group p-4 bg-white rounded-3xl border border-slate-200 shadow-md shadow-slate-100 flex flex-col items-center">
                        <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-inner">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrisUrl}
                            alt="QRIS DISBUDPORA"
                            className="h-48 w-48 sm:h-56 sm:w-56 object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        </div>

                        {/* Supported Apps Badges */}
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-bold text-slate-600">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">BCA</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Mandiri</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">BRI</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">BNI</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">BJB</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">GoPay</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">OVO</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">DANA</span>
                        </div>
                      </div>

                      {/* Download QRIS Button */}
                      <div className="mt-4 mb-6 w-full max-w-xs flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDownloadQRIS}
                          disabled={isDownloadingQris}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-800 hover:text-emerald-700 px-4 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Download className={`h-4 w-4 text-emerald-600 ${isDownloadingQris ? 'animate-bounce' : ''}`} />
                          {isDownloadingQris ? t.checkout.downloading : t.checkout.downloadBarcode}
                        </button>
                        <p className="text-[11px] text-slate-500 text-center">
                          {t.checkout.saveBarcodeTip}
                        </p>
                      </div>

                      {/* SEPARATOR UPLOAD */}
                      <div className="w-full border-t border-slate-200 pt-6">
                        <div className="flex items-center justify-between mb-3.5">
                          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-white text-[11px] font-black">✓</span>
                            <span>{t.checkout.uploadProofHeading}</span>
                          </h4>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Wajib Dilampirkan
                          </span>
                        </div>

                        {/* Amount Confirmation Checkbox - REQUIRED before upload */}
                        <div className={`rounded-2xl border transition-all ${
                          isAmountConfirmed
                            ? 'border-emerald-300 bg-emerald-50/60 shadow-sm'
                            : 'border-amber-300 bg-amber-50/80'
                        } p-3.5 mb-4`}>
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isAmountConfirmed}
                              onChange={(e) => setIsAmountConfirmed(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                              required
                            />
                            <div className="text-xs text-slate-700 leading-relaxed">
                              <span className="font-semibold text-slate-900">
                                {t.checkout.amountConfirmCheckbox}{' '}
                                <strong className="text-emerald-700 font-black text-sm bg-emerald-100/70 px-1.5 py-0.5 rounded">
                                  {formatRupiah(grandTotal)}
                                </strong>
                              </span>
                              <p className="text-[11px] text-amber-900 font-medium mt-1">
                                ⚠️ {t.checkout.amountConfirmWarning}
                              </p>
                            </div>
                          </label>
                        </div>

                        {/* Hidden File Input */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          disabled={!isAmountConfirmed}
                          className="hidden"
                          accept="image/png, image/jpeg, image/webp"
                        />

                        {/* Upload Preview / Dropzone */}
                        {paymentProofFile ? (
                          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-3.5 shadow-sm transition-all">
                            <div className="flex items-center gap-3">
                              {/* Real Thumbnail */}
                              <div
                                onClick={() => setShowProofModal(true)}
                                className="relative group/thumb h-16 w-16 rounded-xl overflow-hidden border border-emerald-200 shadow-sm shrink-0 bg-white cursor-pointer"
                                title="Klik untuk memperbesar struk"
                              >
                                {previewUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={previewUrl}
                                    alt="Bukti Transfer"
                                    className="h-full w-full object-cover group-hover/thumb:scale-110 transition duration-200"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center bg-emerald-100 text-emerald-700">
                                    <FileText className="h-6 w-6" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-white">
                                  <Eye className="h-4 w-4" />
                                </div>
                              </div>

                              {/* File Details */}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-black text-slate-900" title={proofFileName}>
                                  {proofFileName}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {paymentProofFile ? `${(paymentProofFile.size / 1024).toFixed(0)} KB` : ''} •{' '}
                                  <span className="text-emerald-700 font-bold">✓ Foto siap diverifikasi</span>
                                </p>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowProofModal(true)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-md shadow-xs hover:bg-emerald-50 transition"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span>Lihat Struk</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-xs hover:bg-slate-50 transition"
                                  >
                                    <UploadCloud className="h-3 w-3" />
                                    <span>Ganti</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleRemoveProof}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-white border border-red-200 px-2 py-0.5 rounded-md shadow-xs hover:bg-red-50 transition ml-auto"
                                    title="Hapus foto ini"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => isAmountConfirmed && fileInputRef.current?.click()}
                            className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 px-6 py-7 transition-all ${
                              isAmountConfirmed
                                ? 'border-dashed border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/20 shadow-xs'
                                : 'border-dashed border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                              isAmountConfirmed
                                ? 'bg-emerald-50 text-emerald-600 group-hover:scale-110 shadow-xs'
                                : 'bg-slate-100 text-slate-300'
                            }`}>
                              <UploadCloud className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-bold text-slate-800">
                                {isAmountConfirmed ? t.checkout.clickToUpload : t.checkout.checkConfirmFirst}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-400">JPG, PNG, atau WEBP (Maksimal 5 MB)</p>
                            </div>
                          </div>
                        )}

                        {/* OCR Validation Status Indicators */}
                        {ocrStatus !== 'idle' && (
                          <div className={`mt-3 rounded-xl p-3 text-xs font-medium border ${
                            ocrStatus === 'processing'
                              ? 'border-blue-200 bg-blue-50 text-blue-800'
                              : ocrStatus === 'passed'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : ocrStatus === 'manual_review'
                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                  : 'border-red-200 bg-red-50 text-red-800'
                          }`}>
                            {ocrStatus === 'processing' && (
                              <div className="flex items-center gap-2 justify-center">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                                <span>Sedang memverifikasi bukti transfer via Vision OCR...</span>
                              </div>
                            )}
                            {ocrStatus === 'passed' && (
                              <div className="flex items-center gap-2 justify-center font-bold">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>✅ Validasi otomatis berhasil! Pesanan langsung berstatus Lunas.</span>
                              </div>
                            )}
                            {ocrStatus === 'manual_review' && (
                              <div className="flex items-center gap-2 justify-center">
                                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                                <span>⏳ Bukti bayar terlampir. Menunggu verifikasi tim kasir Disbudpora.</span>
                              </div>
                            )}
                            {ocrStatus === 'failed' && (
                              <div className="flex items-center gap-2 justify-center">
                                <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                                <span>Gagal memvalidasi struk. Silakan unggah struk foto yang lebih jelas.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SUMMARY & CONFIRM */}
                <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-slate-200">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">{venue?.name}</h4>
                      {activeBookingDraft?.userCategoryLabel && (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 mb-1">
                          {activeBookingDraft.userCategoryLabel}
                        </span>
                      )}
                      <p className="text-xs text-slate-500">
                        {activeBookingDraft?.items[0]?.date} • {activeBookingDraft?.items.map(i => i.timeStart).join(', ')}
                      </p>
                    </div>
                    
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t.checkout.rentalPrice}</span>
                        <span className="font-bold text-slate-900">{formatRupiah(subtotal)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between border-t border-slate-200 pt-4">
                      <div>
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.checkout.totalPayment}</span>
                        <span className="text-[10px] text-red-500 font-semibold">{t.checkout.payFull}</span>
                      </div>
                      <span className="text-2xl font-black text-[#ff5722]">
                        {formatRupiah(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* IMPORTANT INFO */}
                <div className="rounded-3xl bg-slate-50 p-6 sm:p-8 border border-slate-200 space-y-4 text-xs text-slate-600 leading-relaxed">
                  <h4 className="font-bold text-slate-800 text-sm">{t.checkout.importantVenueInfo}</h4>
                  <ul className="list-disc pl-4 space-y-2 text-slate-500">
                    <li>{t.checkout.importantInfo1}</li>
                    <li>{t.checkout.importantInfo2}</li>
                    <li>{t.checkout.importantInfo3}</li>
                  </ul>
                  
                  <div className="mt-6 pt-4 border-t border-slate-200 flex gap-3 items-start">
                    <input
                      type="checkbox"
                      id="tnc"
                      checked={isTnCAccepted}
                      onChange={(e) => setIsTnCAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#ff5722] focus:ring-[#ff5722]"
                    />
                    <label htmlFor="tnc" className="text-slate-500">
                      {t.checkout.tncReadAgreement} <a href="#" className="text-[#ff5722] font-semibold hover:underline">{t.checkout.tncTerms}</a> {activeLang === 'US' ? 'and' : 'dan'} <a href="#" className="text-[#ff5722] font-semibold hover:underline">{t.checkout.tncPrivacy}</a> {t.checkout.tncRules}
                    </label>
                  </div>
                </div>

                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex gap-2 items-start">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirmModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white py-4 text-sm font-bold text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50/50 transition text-center"
                  >
                    <XCircle className="h-4 w-4" />
                    {t.checkout.cancelBooking}
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-[#ff5722] py-4 text-sm font-black text-white shadow-lg shadow-[#ff5722]/30 transition hover:bg-[#e64a19] uppercase tracking-wider disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? t.checkout.submitting : t.checkout.confirmPayment}
                  </button>
                </div>

              </div>
            </div>
          </form>
        )}

        {/* LIGHTBOX MODAL FOR PAYMENT PROOF */}
        {showProofModal && previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                <div className="font-bold text-sm text-slate-800 flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{proofFileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProofModal(false)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition shrink-0 ml-2"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Pratinjau Bukti Bayar"
                  className="max-h-[65vh] w-auto object-contain rounded-lg shadow-md"
                />
              </div>
              <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  {paymentProofFile ? `${(paymentProofFile.size / 1024).toFixed(0)} KB` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setShowProofModal(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POP-UP KONFIRMASI PEMBATALAN PESANAN */}
        {showCancelConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div
              className="relative max-w-md w-full rounded-3xl bg-white shadow-2xl p-6 sm:p-7 text-center ring-1 ring-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-8 ring-red-500/10">
                <AlertCircle className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-black text-slate-900">
                {t.checkout.cancelConfirmTitle}
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                {t.checkout.cancelConfirmDesc}
              </p>

              {activeBookingDraft && (
                <div className="my-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs text-left space-y-1">
                  <div className="font-extrabold text-slate-900">{venue?.name}</div>
                  <div className="text-slate-600 font-medium text-[11px]">
                    {activeBookingDraft.items[0]?.date} • {activeBookingDraft.items.map((i) => i.timeStart).join(', ')} WIB
                  </div>
                  <div className="font-black text-emerald-700 text-sm pt-0.5">
                    {formatRupiah(subtotal)}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="w-full rounded-xl bg-slate-900 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 transition shadow-sm"
                >
                  {t.checkout.continueBooking}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="w-full rounded-xl border-2 border-red-200 py-3 text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                >
                  {t.checkout.confirmCancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POP-UP WAKTU PEMESANAN HABIS (TIMEOUT 10 MENIT) */}
        {showTimeoutModal && !completedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div
              className="relative max-w-md w-full rounded-3xl bg-white shadow-2xl p-6 sm:p-7 text-center ring-1 ring-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-500/10">
                <Clock className="h-7 w-7 animate-pulse" />
              </div>

              <h3 className="text-lg font-black text-slate-900">
                {t.checkout.timeoutTitle}
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                {t.checkout.timeoutDesc}
              </p>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleTimeoutAcknowledge}
                  className="w-full rounded-xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 transition shadow-md shadow-emerald-600/20"
                >
                  {t.checkout.selectAnotherSchedule}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
