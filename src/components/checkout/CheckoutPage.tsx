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
  Download
} from 'lucide-react';
import { Booking } from '../../types';

export const CheckoutPage: React.FC = () => {
  const {
    activeBookingDraft,
    activeUser,
    completePayment,
    setActiveView,
    venues,
    t,
    activeLang,
  } = useApp();

  const [step, setStep] = useState<1 | 2>(1);

  // 60 Minutes countdown timer in seconds (60 * 60 = 3600)
  const [secondsLeft, setSecondsLeft] = useState<number>(3600);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

  // Form input verification states
  const [nik, setNik] = useState<string>('');
  const [npwp, setNpwp] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [customerNote, setCustomerNote] = useState<string>('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState<string>('');
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

  useEffect(() => {
    // Load QRIS settings
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
  }, []);

  // Auto-fill sender phone from user profile
  useEffect(() => {
    if (activeUser?.phone && !senderPhone) {
      setSenderPhone(activeUser.phone);
    }
  }, [activeUser, senderPhone]);

  if (!activeBookingDraft) {
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

  const venue = venues.find((v) => v.id === activeBookingDraft.venueId);
  const subtotal = activeBookingDraft.items.reduce((sum, item) => sum + item.price, 0);
  const serviceFee = 5000;
  const grandTotal = subtotal + serviceFee;

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

    if (!isTnCAccepted) {
      setFormError('Mohon setujui Syarat & Ketentuan terlebih dahulu.');
      return;
    }

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
      // Tampilkan teks generik agar detail internal tidak masuk ke DOM publik.
      setFormError('Terjadi kendala saat memproses pembayaran. Silakan coba lagi.');
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
          <div className="mb-6 mx-auto max-w-2xl flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <Lock className="h-5 w-5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-amber-900">{t.checkout.slotLockedTitle}</div>
              <div className="text-xs text-amber-700 leading-relaxed">
                {t.checkout.slotLockedNoticePrefix} <span className="font-black text-amber-900 bg-amber-200/50 px-1 rounded">{timerString}</span> {t.checkout.slotLockedNoticeSuffix}
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
              onClick={() => setActiveView('USER_DASHBOARD')}
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
                    <p className="text-sm text-slate-500 mt-0.5">{(t.categories as any)[activeBookingDraft.sportCategory] || activeBookingDraft.sportCategory.replace('_', ' ')}</p>
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
                        {activeBookingDraft.items[0]?.date} • {activeBookingDraft.items.map(i => i.timeStart).join(', ')} WIB
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
              onClick={() => setActiveView('VENUE_DETAIL')}
              className="w-full text-center text-sm font-bold text-slate-500 hover:text-slate-800"
            >
              {t.common.back}
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
                      <label className="mb-1.5 block text-xs font-bold text-slate-700 flex justify-between">
                        <span>{t.checkout.nikLabel} <span className="text-red-500">*</span></span>
                      </label>
                      <input
                        type="text"
                        required
                        value={nik}
                        onChange={(e) => setNik(e.target.value)}
                        placeholder={t.checkout.nikPlaceholder}
                        maxLength={16}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] outline-none transition"
                      />
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
                  <h3 className="text-xl font-black text-slate-800 mb-1">
                    {t.checkout.choosePaymentType}
                  </h3>
                  <p className="text-xs text-slate-500 mb-6">{t.checkout.securePaymentNote}</p>

                  <div className="rounded-2xl border-2 border-[#ff5722] overflow-hidden">
                    <div className="bg-[#ff5722] px-4 py-3 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        <span className="font-bold text-sm">QRIS / Transfer Bank</span>
                      </div>
                      <div className="h-4 w-4 rounded-full border-4 border-white"></div>
                    </div>
                    
                    <div className="p-6 bg-slate-50 flex flex-col items-center">
                      <div className="mb-4 text-center">
                        <div className="text-sm font-bold text-slate-800">{qrisLabel}</div>
                        <div className="text-xs text-slate-500 mt-1">{paymentNotesTxt}</div>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 inline-block mb-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrisUrl}
                          alt="QRIS DISBUDPORA"
                          className="h-48 w-48 sm:h-56 sm:w-56 object-contain"
                        />
                      </div>

                      {/* Download QRIS Button */}
                      <div className="mb-6 w-full max-w-xs flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDownloadQRIS}
                          disabled={isDownloadingQris}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-orange-200 hover:border-[#ff5722] hover:bg-orange-50 text-slate-800 hover:text-[#ff5722] px-4 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Download className={`h-4 w-4 text-[#ff5722] ${isDownloadingQris ? 'animate-bounce' : ''}`} />
                          {isDownloadingQris ? t.checkout.downloading : t.checkout.downloadBarcode}
                        </button>
                        <p className="text-[11px] text-slate-500 text-center">
                          {t.checkout.saveBarcodeTip}
                        </p>
                      </div>

                      <div className="w-full border-t border-slate-200 pt-6">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-center gap-2">
                          <UploadCloud className="h-4 w-4 text-[#ff5722]" />
                          {t.checkout.uploadProofHeading}
                        </h4>

                        {/* Amount Confirmation Checkbox - REQUIRED before upload */}
                        <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 cursor-pointer transition hover:bg-amber-100">
                          <input
                            type="checkbox"
                            checked={isAmountConfirmed}
                            onChange={(e) => setIsAmountConfirmed(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#ff5722] focus:ring-[#ff5722]"
                            required
                          />
                          <span className="text-sm text-slate-700 leading-relaxed">
                            {t.checkout.amountConfirmCheckbox} <strong className="text-[#ff5722]">{formatRupiah(grandTotal)}</strong>
                            <br />
                            <span className="text-red-600 font-semibold">{t.checkout.amountConfirmWarning}</span>
                          </span>
                        </label>

                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          disabled={!isAmountConfirmed}
                          className="hidden"
                          accept="image/png, image/jpeg"
                        />

                        {paymentProofFile ? (
                          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-800">
                                  {proofFileName}
                                </p>
                                <p className="text-xs text-emerald-600 font-medium">{t.checkout.uploadSuccess}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveProof}
                              className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-red-500 shadow-sm transition"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => isAmountConfirmed && fileInputRef.current?.click()}
                            className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 px-6 py-8 transition ${
                              isAmountConfirmed
                                ? 'border-dashed border-slate-300 bg-white hover:border-[#ff5722] hover:bg-[#ff5722]/5'
                                : 'border-dashed border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                              isAmountConfirmed
                                ? 'bg-slate-100 text-slate-400 group-hover:bg-[#ff5722]/10 group-hover:text-[#ff5722]'
                                : 'bg-slate-100 text-slate-300'
                            }`}>
                              <UploadCloud className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-slate-700">
                                {isAmountConfirmed ? t.checkout.clickToUpload : t.checkout.checkConfirmFirst}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">{t.checkout.maxFileSize}</p>
                            </div>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              disabled={!isAmountConfirmed}
                              className="hidden"
                              accept="image/png, image/jpeg"
                            />
                          </div>
                        )}

                        {/* OCR Validation Status */}
                        {ocrStatus !== 'idle' && (
                          <div className={`mt-4 rounded-xl p-3 text-xs font-medium border ${
                            ocrStatus === 'processing'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : ocrStatus === 'passed'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : ocrStatus === 'manual_review'
                                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                                  : 'border-red-200 bg-red-50 text-red-800'
                          }`}>
                            {ocrStatus === 'processing' && (
                              <div className="flex items-center gap-2 justify-center">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                                <span>Memvalidasi bukti transfer dengan OCR...</span>
                              </div>
                            )}
                            {ocrStatus === 'passed' && (
                              <div className="flex items-center gap-2 justify-center">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>✅ Validasi otomatis BERHASIL! Pesanan langsung LUNAS.</span>
                              </div>
                            )}
                            {ocrStatus === 'manual_review' && (
                              <div className="flex items-start gap-2 justify-center">
                                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-center">
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
                              <div className="flex items-center gap-2 justify-center">
                                <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                                <span>❌ Validasi gagal. Silakan coba unggah ulang dengan struk yang jelas.</span>
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
                      <p className="text-xs text-slate-500">
                        {activeBookingDraft.items[0]?.date} • {activeBookingDraft.items.map(i => i.timeStart).join(', ')}
                      </p>
                    </div>
                    
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t.checkout.rentalPrice}</span>
                        <span className="font-bold text-slate-900">{formatRupiah(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t.checkout.platformFee}</span>
                        <span className="font-bold text-slate-900">{formatRupiah(serviceFee)}</span>
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
                    onClick={() => {
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 rounded-xl border-2 border-slate-200 bg-white py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition text-center"
                  >
                    {t.common.back}
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
      </div>
    </div>
  );
};
