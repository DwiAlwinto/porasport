"use client";

import React, { useState, useEffect, useTransition } from 'react';
import {
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Info,
  Globe,
  Share2,
  FileText,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import {
  getSystemSettings,
  updateMultipleSettings,
  formatWhatsAppUrl,
} from '../../../../actions/settingsActions';
import { SETTING_KEYS } from '../../../../lib/settingsConstants';

export default function AdminFooterSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [footerTagline, setFooterTagline] = useState('');
  const [footerCopyright, setFooterCopyright] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [playstoreUrl, setPlaystoreUrl] = useState('');
  const [appstoreUrl, setAppstoreUrl] = useState('');

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const data = await getSystemSettings();
        setWhatsappNumber(data[SETTING_KEYS.WHATSAPP_NUMBER] || '6281234567890');
        setWhatsappMessage(
          data[SETTING_KEYS.WHATSAPP_MESSAGE] ||
            'Halo Admin DISBUDPORA, saya ingin konfirmasi pemesanan venue / koordinasi sewa event & pertandingan.'
        );
        setContactEmail(data[SETTING_KEYS.CONTACT_EMAIL] || 'disbudporasport@bekasikab.go.id');
        setOfficeAddress(
          data[SETTING_KEYS.OFFICE_ADDRESS] ||
            'Stadion Wibawa Mukti, Sertajaya, Kec. Cikarang Timur, Kabupaten Bekasi, Jawa Barat 17530'
        );
        setFooterTagline(
          data[SETTING_KEYS.FOOTER_TAGLINE] ||
            'Platform resmi pemesanan gelanggang olahraga dan fasilitas olahraga di bawah naungan Dinas Kebudayaan, Pemuda dan Olahraga Kabupaten Bekasi.'
        );
        setFooterCopyright(
          data[SETTING_KEYS.FOOTER_COPYRIGHT] ||
            '© 2026 Dinas Kebudayaan, Pemuda dan Olahraga (DISBUDPORA) Kabupaten Bekasi.'
        );
        setSocialInstagram(
          data[SETTING_KEYS.SOCIAL_INSTAGRAM] || 'https://instagram.com/disbudporakabbekasi'
        );
        setSocialYoutube(
          data[SETTING_KEYS.SOCIAL_YOUTUBE] || 'https://youtube.com/@disbudporakabbekasi'
        );
        setPlaystoreUrl(data[SETTING_KEYS.PLAYSTORE_URL] || '#');
        setAppstoreUrl(data[SETTING_KEYS.APPSTORE_URL] || '#');
      } catch (err) {
        console.error('Error loading footer settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const payload: Record<string, string> = {
        [SETTING_KEYS.WHATSAPP_NUMBER]: whatsappNumber.trim(),
        [SETTING_KEYS.WHATSAPP_MESSAGE]: whatsappMessage.trim(),
        [SETTING_KEYS.CONTACT_EMAIL]: contactEmail.trim(),
        [SETTING_KEYS.OFFICE_ADDRESS]: officeAddress.trim(),
        [SETTING_KEYS.FOOTER_TAGLINE]: footerTagline.trim(),
        [SETTING_KEYS.FOOTER_COPYRIGHT]: footerCopyright.trim(),
        [SETTING_KEYS.SOCIAL_INSTAGRAM]: socialInstagram.trim(),
        [SETTING_KEYS.SOCIAL_YOUTUBE]: socialYoutube.trim(),
        [SETTING_KEYS.PLAYSTORE_URL]: playstoreUrl.trim(),
        [SETTING_KEYS.APPSTORE_URL]: appstoreUrl.trim(),
      };

      const res = await updateMultipleSettings(payload);
      if (res.success) {
        showToast('success', 'Pengaturan WhatsApp dan Footer berhasil disimpan!');
      } else {
        showToast('error', res.error || 'Gagal menyimpan pengaturan.');
      }
    });
  };

  // Live preview test WhatsApp link
  const cleanNumber = whatsappNumber.replace(/\D/g, '');
  const previewWaUrl = `https://wa.me/${
    cleanNumber.startsWith('0') ? '62' + cleanNumber.slice(1) : cleanNumber.startsWith('62') ? cleanNumber : '62' + cleanNumber
  }?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-xs font-bold shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-white via-surface to-emerald-50/40 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 mb-2">
              <Globe className="h-3.5 w-3.5" />
              <span>Manajemen Konten &amp; Kontak DISBUDPORA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-fg tracking-tight">
              Pengaturan WhatsApp &amp; Footer
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-fg-muted max-w-2xl">
              Atur nomor WhatsApp admin resmi (untuk pengajuan event / pertandingan), alamat dinas, email kontak, serta tautan media sosial FIND US (Instagram &amp; YouTube).
            </p>
          </div>

          <button
            onClick={handleSaveAll}
            disabled={loading || isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{isPending ? 'Menyimpan...' : 'Simpan Semua Perubahan'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-xs font-bold text-fg-muted">Memuat data pengaturan...</span>
        </div>
      ) : (
        <form onSubmit={handleSaveAll} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* KARTU 1: Pengaturan WhatsApp Admin */}
            <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-fg">Nomor WhatsApp Admin</h2>
                    <p className="text-xs text-fg-muted">
                      Dipakai di tombol &quot;Hubungi WhatsApp Admin DISBUDPORA&quot;
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-fg mb-1">
                    Nomor WhatsApp (Aktif)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 h-4 w-4 text-fg-faint" />
                    <input
                      type="text"
                      required
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="Contoh: 081234567890 atau 6281234567890"
                      className="w-full rounded-xl border border-line bg-canvas pl-10 pr-4 py-2.5 text-xs text-fg placeholder:text-fg-faint focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-fg-muted">
                    Bisa diawali 0 atau 62. Sistem akan otomatis menormalkannya ke link <code>wa.me</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-fg mb-1">
                    Template Pesan Awal WhatsApp
                  </label>
                  <textarea
                    rows={4}
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    placeholder="Tulis pesan pembuka default..."
                    className="w-full rounded-xl border border-line bg-canvas p-3 text-xs text-fg placeholder:text-fg-faint focus:border-emerald-500 focus:outline-none leading-relaxed"
                  />
                  <p className="mt-1 text-[11px] text-fg-muted">
                    Pesan yang otomatis terisi di chat WhatsApp saat pengguna mengklik tombol hubungi admin.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-center justify-between gap-3">
                  <div className="text-xs text-emerald-900">
                    <span className="font-bold">Uji Coba Tautan WhatsApp:</span>
                    <div className="text-[11px] text-emerald-700 truncate max-w-xs sm:max-w-sm">
                      {previewWaUrl}
                    </div>
                  </div>
                  <a
                    href={previewWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition shrink-0"
                  >
                    <span>Coba Klik</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* KARTU 2: Media Sosial FIND US (Instagram & YouTube) */}
            <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-fg">Media Sosial (FIND US)</h2>
                    <p className="text-xs text-fg-muted">
                      Hanya menampilkan ikon Instagram &amp; YouTube di footer
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-fg mb-1">
                    Tautan Akun Instagram
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                    </span>
                    <input
                      type="url"
                      value={socialInstagram}
                      onChange={(e) => setSocialInstagram(e.target.value)}
                      placeholder="https://instagram.com/disbudporakabbekasi"
                      className="w-full rounded-xl border border-line bg-canvas pl-10 pr-4 py-2.5 text-xs text-fg placeholder:text-fg-faint focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-fg mb-1">
                    Tautan Kanal YouTube
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                    </span>
                    <input
                      type="url"
                      value={socialYoutube}
                      onChange={(e) => setSocialYoutube(e.target.value)}
                      placeholder="https://youtube.com/@disbudporakabbekasi"
                      className="w-full rounded-xl border border-line bg-canvas pl-10 pr-4 py-2.5 text-xs text-fg placeholder:text-fg-faint focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-line">
                  <div className="flex items-center gap-2 text-xs font-bold text-fg-muted mb-2">
                    <Smartphone className="h-4 w-4 text-emerald-600" />
                    <span>Tautan Download Aplikasi (Opsional)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-fg-muted mb-1">
                        Google Play Store
                      </label>
                      <input
                        type="text"
                        value={playstoreUrl}
                        onChange={(e) => setPlaystoreUrl(e.target.value)}
                        placeholder="https://play.google.com/store/apps/..."
                        className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-fg focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-fg-muted mb-1">
                        Apple App Store
                      </label>
                      <input
                        type="text"
                        value={appstoreUrl}
                        onChange={(e) => setAppstoreUrl(e.target.value)}
                        placeholder="https://apps.apple.com/app/..."
                        className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-fg focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* KARTU 3: Kontak Resmi & Alamat Kantor */}
            <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-5 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-fg">Kontak Resmi &amp; Alamat Stadion</h2>
                    <p className="text-xs text-fg-muted">
                      Ditampilkan pada bagian bawah (footer) dan detail instansi
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-fg mb-1">
                    Email Kontak Resmi Dinas
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-fg-faint" />
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="disbudporasport@bekasikab.go.id"
                      className="w-full rounded-xl border border-line bg-canvas pl-10 pr-4 py-2.5 text-xs text-fg placeholder:text-fg-faint focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-fg mb-1">
                    Teks Hak Cipta (Copyright)
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-3 h-4 w-4 text-fg-faint" />
                    <input
                      type="text"
                      value={footerCopyright}
                      onChange={(e) => setFooterCopyright(e.target.value)}
                      placeholder="© 2026 DISBUDPORA Kab. Bekasi"
                      className="w-full rounded-xl border border-line bg-canvas pl-10 pr-4 py-2.5 text-xs text-fg placeholder:text-fg-faint focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-fg mb-1">
                    Alamat Lengkap Kantor / Stadion
                  </label>
                  <textarea
                    rows={2}
                    value={officeAddress}
                    onChange={(e) => setOfficeAddress(e.target.value)}
                    placeholder="Stadion Wibawa Mukti, Sertajaya, Kec. Cikarang Timur..."
                    className="w-full rounded-xl border border-line bg-canvas p-3 text-xs text-fg focus:border-emerald-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-fg mb-1">
                    Tagline / Deskripsi Singkat Footer (Di Bawah Logo)
                  </label>
                  <textarea
                    rows={2}
                    value={footerTagline}
                    onChange={(e) => setFooterTagline(e.target.value)}
                    placeholder="Platform resmi pemesanan gelanggang olahraga..."
                    className="w-full rounded-xl border border-line bg-canvas p-3 text-xs text-fg focus:border-emerald-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* KARTU 4: Live Preview Real-time Footer */}
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <Sparkles className="h-4 w-4" />
              <span>Pratinjau Footer Real-time (Sesuai yang Diketik):</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <img src="/images/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
                  <span className="text-lg font-black tracking-tight text-[#213555]">
                    disbudpora sport
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-md">
                  {footerTagline || 'Tagline deskripsi lembaga...'}
                </p>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 pt-2">
                <div className="text-center sm:text-left">
                  <div className="font-bold text-slate-900 mb-0.5">DISBUDPORA SPORT</div>
                  <div className="text-[11px] max-w-md">
                    {officeAddress || 'Alamat kantor...'}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-600">
                  <span className="font-semibold text-emerald-700">{contactEmail || 'email@bekasikab.go.id'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-900">
                    FIND US
                  </span>
                  <a
                    href={socialInstagram || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-emerald-600"
                    title="Instagram"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  </a>
                  <a
                    href={socialYoutube || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-emerald-600"
                    title="YouTube"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Save Action Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-3.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{isPending ? 'Menyimpan Pengaturan...' : 'Simpan Semua Pengaturan'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
