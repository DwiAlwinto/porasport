"use client";

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  QrCode,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ImagePlus,
  Save,
  ShieldCheck,
  Clock,
  Eye,
  Info,
  FileImage,
} from 'lucide-react';
import {
  getSystemSettings,
  updateTextSetting,
  uploadQrisImageAction,
} from '../../../../actions/settingsActions';
import { SETTING_KEYS } from '../../../../lib/settingsConstants';

export default function AdminQrisSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text settings state
  const [paymentNotes, setPaymentNotes] = useState('');
  const [qrisLabel, setQrisLabel] = useState('');
  const [textSaveResult, setTextSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const data = await getSystemSettings();
      setSettings(data);
      setPaymentNotes(data.payment_notes || '');
      setQrisLabel(data.qris_label || '');
      setLoading(false);
    }
    loadSettings();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadResult(null);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploadResult(null);
    const formData = new FormData();
    formData.append('qris_file', selectedFile);
    startTransition(async () => {
      const res = await uploadQrisImageAction(formData);
      if (res.success && res.url) {
        setSettings((prev) => ({ ...prev, qris_image_url: res.url! }));
        setUploadResult({ success: true, message: `QRIS berhasil diperbarui! URL: ${res.url}` });
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setUploadResult({ success: false, message: res.error || 'Upload gagal.' });
      }
    });
  };

  const handleSaveTextSettings = async () => {
    setTextSaveResult(null);
    startTransition(async () => {
      const r1 = await updateTextSetting(SETTING_KEYS.PAYMENT_NOTES, paymentNotes);
      const r2 = await updateTextSetting(SETTING_KEYS.QRIS_LABEL, qrisLabel);
      if (r1.success && r2.success) {
        setSettings((prev) => ({ ...prev, payment_notes: paymentNotes, qris_label: qrisLabel }));
        setTextSaveResult({ success: true, message: 'Keterangan berhasil disimpan.' });
      } else {
        setTextSaveResult({ success: false, message: r1.error || r2.error || 'Gagal menyimpan.' });
      }
    });
  };

  const currentQrisUrl = settings.qris_image_url || '/images/qris-disbudpora.png';

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-fg tracking-tight flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200">
              <QrCode className="h-5 w-5 text-emerald-700" />
            </div>
            Pengaturan QRIS & Pembayaran
          </h1>
          <p className="text-xs text-fg-muted mt-1.5 max-w-xl">
            Upload gambar QRIS terbaru DISBUDPORA Kab. Bekasi dan atur keterangan pembayaran yang ditampilkan kepada penyewa saat checkout.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 shrink-0">
          <ShieldCheck className="h-3.5 w-3.5" />
          Hanya Admin
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-fg-faint text-xs font-bold">
          Memuat pengaturan...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT: Upload QRIS Image */}
          <div className="lg:col-span-7 space-y-6">

            {/* Current QRIS Preview */}
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <Eye className="h-4 w-4 text-fg-muted" />
                  <h2 className="text-sm font-black text-fg">QRIS Aktif Saat Ini</h2>
                </div>
                <span className="text-[10px] font-bold text-fg-muted font-mono truncate max-w-[220px]">
                  {currentQrisUrl}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                <div className="relative shrink-0">
                  <div className="rounded-2xl border-2 border-emerald-200 bg-white p-2 shadow-md shadow-emerald-500/10">
                    <img
                      src={currentQrisUrl}
                      alt="QRIS DISBUDPORA aktif"
                      className="h-52 w-auto rounded-xl object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/images/qris-disbudpora.png';
                      }}
                    />
                  </div>
                  <div className="mt-2 text-center text-[10px] font-bold text-fg-muted uppercase tracking-wide">
                    {settings.qris_label || 'DISBUDPORA KAB. BEKASI'}
                  </div>
                  <div className="absolute -top-2 -right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-white shadow-md">
                    AKTIF
                  </div>
                </div>

                <div className="flex-1 space-y-3 text-xs text-fg-muted">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-2.5">
                      <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-blue-700 mb-1">Cara Kerja Pembaruan QRIS</p>
                        <ul className="space-y-1 text-[11px] leading-relaxed text-blue-800">
                          <li>• Upload gambar QRIS baru dari komputer Anda</li>
                          <li>• Gambar tersimpan aman di server DISBUDPORA</li>
                          <li>• Semua penyewa langsung melihat QRIS terbaru</li>
                          <li>• Format: PNG, JPG, WebP — Maks. 5 MB</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Pastikan gambar QRIS yang diupload sudah difoto dengan jelas dan QR code dapat terbaca oleh aplikasi e-wallet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload New QRIS */}
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5 border-b border-line pb-4 mb-5">
                <Upload className="h-4 w-4 text-emerald-700" />
                <h2 className="text-sm font-black text-fg">Upload QRIS Terbaru</h2>
              </div>

              {/* Click Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                  selectedFile
                    ? 'border-emerald-500/50 bg-emerald-50'
                    : 'border-line-strong hover:border-emerald-500/50 hover:bg-emerald-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-2xl border border-emerald-200 bg-white p-2 shadow-md">
                      <img src={previewUrl} alt="Preview QRIS baru" className="h-48 w-auto rounded-xl object-contain" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-emerald-700">{selectedFile?.name}</p>
                      <p className="text-[11px] text-fg-faint">
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                    <p className="text-[11px] text-fg-muted">Klik untuk ganti file lain</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-subtle border border-line-strong">
                      <ImagePlus className="h-7 w-7 text-fg-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-fg">Klik untuk pilih gambar QRIS</p>
                      <p className="text-xs text-fg-faint mt-1">Format PNG, JPG, WebP • Maksimal 5 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Result Alert */}
              {uploadResult && (
                <div className={`mt-4 flex items-start gap-2.5 rounded-xl p-3.5 text-xs font-semibold ${
                  uploadResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {uploadResult.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-700" />
                  )}
                  <span>{uploadResult.message}</span>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!selectedFile || isPending}
                className="mt-5 w-full flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed py-3.5 text-xs font-black text-white uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-[0.99]"
              >
                {isPending ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /><span>Mengunggah & Memperbarui QRIS...</span></>
                ) : (
                  <><Upload className="h-4 w-4" /><span>Upload & Aktifkan QRIS Baru</span></>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: Text Settings & Preview */}
          <div className="lg:col-span-5 space-y-6">

            {/* Keterangan Teks */}
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5 border-b border-line pb-4 mb-5">
                <FileImage className="h-4 w-4 text-purple-700" />
                <h2 className="text-sm font-black text-fg">Keterangan Tampilan</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-2">
                    Label Bawah Gambar QRIS
                  </label>
                  <input
                    type="text"
                    value={qrisLabel}
                    onChange={(e) => setQrisLabel(e.target.value)}
                    placeholder="DISBUDPORA KAB. BEKASI"
                    className="w-full rounded-xl border border-line-strong bg-field px-4 py-2.5 text-xs text-fg placeholder-slate-400 outline-none focus:border-emerald-500 transition"
                  />
                  <p className="mt-1 text-[10px] text-fg-muted">Teks di bawah gambar QRIS saat checkout.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-2">
                    Keterangan Rekening Resmi
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Rekening Resmi Dinas Kebudayaan, Pemuda dan Olahraga Kabupaten Bekasi."
                    rows={3}
                    className="w-full rounded-xl border border-line-strong bg-field px-4 py-2.5 text-xs text-fg placeholder-slate-400 outline-none focus:border-emerald-500 transition resize-none"
                  />
                  <p className="mt-1 text-[10px] text-fg-muted">Verifikasi resmi di bawah petunjuk pembayaran.</p>
                </div>

                {textSaveResult && (
                  <div className={`flex items-start gap-2 rounded-xl p-3 text-[11px] font-semibold ${
                    textSaveResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {textSaveResult.success
                      ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      : <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                    {textSaveResult.message}
                  </div>
                )}

                <button
                  onClick={handleSaveTextSettings}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-line-strong hover:border-emerald-300 bg-subtle hover:bg-subtle-strong disabled:opacity-40 py-3 text-xs font-black text-fg uppercase tracking-wider transition-all"
                >
                  <Save className="h-4 w-4" />
                  Simpan Keterangan
                </button>
              </div>
            </div>

            {/* Mini Preview Checkout */}
            <div className="rounded-3xl border border-line bg-surface p-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-4 w-4 text-fg-muted" />
                <h3 className="text-xs font-black text-fg uppercase tracking-wider">Pratinjau di Checkout</h3>
              </div>
              <div className="rounded-2xl border border-line-strong bg-field p-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-fg-subtle">Scan QRIS Resmi DISBUDPORA</span>
                  <span className="text-[10px] font-bold text-emerald-700 cursor-pointer">↓ Unduh QRIS</span>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="rounded-xl border border-line-strong bg-white p-1.5 shrink-0">
                    <img
                      src={previewUrl || currentQrisUrl}
                      className="h-24 w-auto object-contain rounded-lg"
                      alt="Preview"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/qris-disbudpora.png'; }}
                    />
                    <div className="mt-1 text-center text-[8px] font-bold text-fg-muted">
                      {qrisLabel || settings.qris_label || 'DISBUDPORA KAB. BEKASI'}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="text-[10px] text-fg-subtle font-bold">Cara Pembayaran:</div>
                    <ul className="text-[9px] text-fg-muted space-y-0.5 list-decimal list-inside leading-relaxed">
                      <li>Buka M-Banking / E-Wallet</li>
                      <li>Pilih Scan / Bayar QRIS</li>
                      <li>Arahkan ke QR DISBUDPORA</li>
                      <li>Masukkan nominal & bayar</li>
                    </ul>
                    <div className="text-[9px] text-fg-faint pt-1 border-t border-line leading-relaxed">
                      ✓ {paymentNotes || settings.payment_notes || 'Rekening Resmi DISBUDPORA Kab. Bekasi'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamp info */}
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-[11px] text-fg-faint">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Setiap perubahan QRIS aktif secara instan untuk semua pengguna yang melakukan checkout.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
