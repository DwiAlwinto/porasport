"use client";

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  ImagePlus,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  LayoutTemplate,
} from 'lucide-react';
import {
  uploadPromoBannerAction,
  getPromoBanners,
  deletePromoBannerAction,
  togglePromoBannerStatusAction
} from '../../../../actions/bannerActions';
import Image from 'next/image';

export default function AdminPromoBannersPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBanners();
  }, []);

  async function loadBanners() {
    setLoading(true);
    const data = await getPromoBanners(false);
    setBanners(data);
    setLoading(false);
  }

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
    formData.append('banner_file', selectedFile);
    if (title) formData.append('title', title);

    startTransition(async () => {
      const res = await uploadPromoBannerAction(formData);
      if (res.success) {
        setUploadResult({ success: true, message: `Banner berhasil diunggah!` });
        setSelectedFile(null);
        setPreviewUrl(null);
        setTitle('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadBanners(); // Reload
      } else {
        setUploadResult({ success: false, message: res.error || 'Upload gagal.' });
      }
    });
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm('Hapus banner ini secara permanen?')) return;
    startTransition(async () => {
      const res = await deletePromoBannerAction(id, imageUrl);
      if (res.success) {
        loadBanners();
      } else {
        alert(res.error || 'Gagal menghapus banner');
      }
    });
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await togglePromoBannerStatusAction(id, currentStatus);
      if (res.success) {
        loadBanners();
      } else {
        alert(res.error || 'Gagal mengubah status');
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <LayoutTemplate className="w-8 h-8 text-emerald-600" />
            Promo Banners
          </h1>
          <p className="text-sm text-fg-faint mt-1">
            Kelola banner promo yang tampil di Halaman Utama (Homepage)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Kolom Kiri: Form Upload Baru */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-emerald-600" />
              Upload Banner Baru
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Judul (Opsional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Misal: Promo Akhir Tahun"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  File Gambar
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="w-full text-sm text-fg-faint file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
                <p className="text-[11px] text-fg-muted mt-2">
                  Format: PNG, JPG, WebP. Maks 5MB. Rasio disarankan 16:9 atau lebar minimal 1200px.
                </p>
              </div>

              {previewUrl && (
                <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden bg-subtle">
                  <div className="aspect-[21/9] relative">
                    <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                  </div>
                </div>
              )}

              {uploadResult && (
                <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                  uploadResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                }`}>
                  {uploadResult.success ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  )}
                  <p>{uploadResult.message}</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!selectedFile || isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload & Simpan
              </button>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Daftar Banner */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Daftar Banner Promo</h2>
            </div>
            
            <div className="p-0">
              {loading ? (
                <div className="p-10 flex justify-center">
                  <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                </div>
              ) : banners.length === 0 ? (
                <div className="p-10 text-center text-fg-faint">
                  <LayoutTemplate className="w-12 h-12 text-fg mx-auto mb-3" />
                  <p>Belum ada banner promo yang diunggah.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {banners.map((banner) => (
                    <div key={banner.id} className="p-6 flex flex-col sm:flex-row gap-6 hover:bg-slate-50 transition-colors">
                      {/* Image Preview */}
                      <div className="w-full sm:w-48 aspect-[21/9] rounded-xl overflow-hidden bg-subtle relative shrink-0">
                        <Image 
                          src={banner.imageUrl} 
                          alt={banner.title || 'Banner'} 
                          fill 
                          className={`object-cover ${!banner.isActive && 'opacity-50 grayscale'}`} 
                        />
                      </div>
                      
                      {/* Info & Actions */}
                      <div className="flex-1 flex flex-col justify-center">
                        <h3 className="font-bold text-slate-900 text-lg mb-1">
                          {banner.title || 'Tanpa Judul'}
                        </h3>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            banner.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-fg-muted'
                          }`}>
                            {banner.isActive ? 'Aktif (Tampil)' : 'Nonaktif (Disembunyikan)'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-auto">
                          <button
                            onClick={() => handleToggleStatus(banner.id, banner.isActive)}
                            disabled={isPending}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              banner.isActive 
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {banner.isActive ? (
                              <><EyeOff className="w-3.5 h-3.5" /> Sembunyikan</>
                            ) : (
                              <><Eye className="w-3.5 h-3.5" /> Tampilkan</>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleDelete(banner.id, banner.imageUrl)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
