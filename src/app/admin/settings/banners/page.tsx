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
  Pencil,
  ArrowUp,
  ArrowDown,
  Link2,
  ExternalLink,
  X,
  Layers,
  Save
} from 'lucide-react';
import {
  uploadPromoBannerAction,
  getPromoBanners,
  updatePromoBannerAction,
  deletePromoBannerAction,
  togglePromoBannerStatusAction,
  updatePromoBannerOrderAction,
  movePromoBannerOrderAction
} from '../../../../actions/bannerActions';
import Image from 'next/image';

interface PromoBannerItem {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  orderIndex: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export default function AdminPromoBannersPage() {
  const [banners, setBanners] = useState<PromoBannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileFormat, setSelectedFileFormat] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [orderIndex, setOrderIndex] = useState<number>(1);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Modal State
  const [editingBanner, setEditingBanner] = useState<PromoBannerItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editOrderIndex, setEditOrderIndex] = useState<number>(1);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editFileFormat, setEditFileFormat] = useState<string | null>(null);
  const [isEditDragging, setIsEditDragging] = useState(false);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Direct Inline Order Edit State
  const [editingOrderMap, setEditingOrderMap] = useState<{ [id: string]: number }>({});

  useEffect(() => {
    loadBanners();
  }, []);

  async function loadBanners() {
    setLoading(true);
    const data = await getPromoBanners(false);
    setBanners(data as PromoBannerItem[]);
    
    // Inisialisasi next order index untuk form upload baru
    const maxOrder = data.length > 0 ? Math.max(...data.map((b: any) => b.orderIndex || 0)) : 0;
    setOrderIndex(maxOrder + 1);

    // Inisialisasi inline map order
    const orderMap: { [id: string]: number } = {};
    data.forEach((b: any) => {
      orderMap[b.id] = b.orderIndex ?? 1;
    });
    setEditingOrderMap(orderMap);

    setLoading(false);
  }

  // Helper validasi file gambar di sisi client
  const validateClientFile = (file: File): { valid: boolean; error?: string; format?: string } => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const validExts = ['png', 'jpg', 'jpeg', 'webp'];
    const validMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    const hasValidExt = validExts.includes(ext);
    const hasValidMime = !file.type || validMimes.includes(file.type.toLowerCase());

    if (!hasValidExt && !hasValidMime) {
      return {
        valid: false,
        error: 'Format file tidak didukung. Harap pilih berkas gambar berformat PNG, JPG, JPEG, atau WebP.',
      };
    }

    if (file.size > 5 * 1024 * 1024) {
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `Ukuran file terlalu besar (${sizeInMb} MB). Maksimal yang diperbolehkan adalah 5 MB.`,
      };
    }

    const format = ext === 'jpeg' ? 'JPG' : ext.toUpperCase();
    return { valid: true, format };
  };

  // Process file upload baru
  const processSelectedFile = (file: File) => {
    const check = validateClientFile(file);
    if (!check.valid) {
      setUploadResult({ success: false, message: check.error || 'File tidak valid.' });
      setSelectedFile(null);
      setSelectedFileFormat(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setSelectedFileFormat(check.format || 'GAMBAR');
    setUploadResult(null);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Handle upload file select via input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  // Handle submit upload baru
  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploadResult(null);

    const formData = new FormData();
    formData.append('banner_file', selectedFile);
    if (title) formData.append('title', title);
    if (linkUrl) formData.append('linkUrl', linkUrl);
    formData.append('orderIndex', String(orderIndex));

    startTransition(async () => {
      const res = await uploadPromoBannerAction(formData);
      if (res.success) {
        setUploadResult({ success: true, message: 'Banner berhasil diunggah dan disimpan!' });
        setSelectedFile(null);
        setSelectedFileFormat(null);
        setPreviewUrl(null);
        setTitle('');
        setLinkUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadBanners();
      } else {
        setUploadResult({ success: false, message: res.error || 'Upload gagal.' });
      }
    });
  };

  // Open Edit Modal
  const openEditModal = (banner: PromoBannerItem) => {
    setEditingBanner(banner);
    setEditTitle(banner.title || '');
    setEditLinkUrl(banner.linkUrl || '');
    setEditOrderIndex(banner.orderIndex ?? 1);
    setEditIsActive(banner.isActive);
    setEditFile(null);
    setEditFileFormat(null);
    setEditPreviewUrl(banner.imageUrl);
    setEditError(null);
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditingBanner(null);
    setEditFile(null);
    setEditFileFormat(null);
    setEditPreviewUrl(null);
    setEditError(null);
  };

  // Process file edit
  const processEditFile = (file: File) => {
    const check = validateClientFile(file);
    if (!check.valid) {
      setEditError(check.error || 'File tidak valid.');
      setEditFile(null);
      setEditFileFormat(null);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      return;
    }

    setEditFile(file);
    setEditFileFormat(check.format || 'GAMBAR');
    setEditError(null);
    const reader = new FileReader();
    reader.onload = () => setEditPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Handle Edit file change
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processEditFile(file);
  };

  // Save Edit Banner
  const handleSaveEdit = async () => {
    if (!editingBanner) return;
    setEditError(null);

    const formData = new FormData();
    formData.append('id', editingBanner.id);
    formData.append('title', editTitle);
    formData.append('linkUrl', editLinkUrl);
    formData.append('orderIndex', String(editOrderIndex));
    formData.append('isActive', editIsActive ? 'true' : 'false');
    if (editFile) {
      formData.append('banner_file', editFile);
    }

    startTransition(async () => {
      const res = await updatePromoBannerAction(formData);
      if (res.success) {
        closeEditModal();
        await loadBanners();
      } else {
        setEditError(res.error || 'Gagal menyimpan perubahan.');
      }
    });
  };

  // Delete Banner
  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm('Hapus banner ini secara permanen dari database dan penyimpanan?')) return;
    startTransition(async () => {
      const res = await deletePromoBannerAction(id, imageUrl);
      if (res.success) {
        await loadBanners();
      } else {
        alert(res.error || 'Gagal menghapus banner');
      }
    });
  };

  // Toggle Aktif/Sembunyikan
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await togglePromoBannerStatusAction(id, currentStatus);
      if (res.success) {
        await loadBanners();
      } else {
        alert(res.error || 'Gagal mengubah status');
      }
    });
  };

  // Quick Move Up / Down
  const handleMoveOrder = async (id: string, direction: 'up' | 'down') => {
    startTransition(async () => {
      const res = await movePromoBannerOrderAction(id, direction);
      if (res.success) {
        await loadBanners();
      } else {
        alert(res.error || 'Gagal mengubah urutan');
      }
    });
  };

  // Save inline order direct input
  const handleSaveInlineOrder = async (id: string) => {
    const val = editingOrderMap[id];
    if (val === undefined || isNaN(val)) return;
    startTransition(async () => {
      const res = await updatePromoBannerOrderAction(id, val);
      if (res.success) {
        await loadBanners();
      } else {
        alert(res.error || 'Gagal mengupdate nomor urut');
      }
    });
  };

  const activeCount = banners.filter((b) => b.isActive).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <LayoutTemplate className="w-8 h-8 text-emerald-600" />
            Promo Banners Homepage
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola banner promo yang tampil pada carousel halaman utama dengan sistem urutan dan tautan tujuan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {activeCount} Banner Aktif di Homepage
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Kolom Kiri: Form Upload Baru (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm sticky top-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-emerald-600" />
              Upload Banner Baru
            </h2>
            
            <div className="space-y-4">
              {/* Judul */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Judul Banner (Opsional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Misal: Promo Akhir Tahun / Diskon Pelajar"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Link Tujuan (URL) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-500" />
                  Link URL Tujuan (Opsional)
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Contoh: /fasilitas atau https://..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Jika diisi, banner pada carousel akan bisa diklik oleh pengunjung.
                </p>
              </div>

              {/* Nomor Urutan Tampil */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Nomor Urut Tampil
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={orderIndex}
                    onChange={(e) => setOrderIndex(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center"
                  />
                  <span className="text-xs text-slate-500">
                    Urutan ke-<strong>{orderIndex}</strong> (Nomor lebih kecil tampil lebih awal)
                  </span>
                </div>
              </div>

              {/* File Upload Dropzone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    File Gambar Banner <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Maks. 5 MB</span>
                </div>

                {/* Format Badges */}
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    PNG
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200">
                    JPG / JPEG
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                    WebP
                  </span>
                </div>

                {/* Dropzone Container */}
                {!previewUrl ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processSelectedFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-200 ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]'
                        : 'border-slate-300 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/30'
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Klik untuk memilih berkas
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          atau seret dan lepas gambar PNG, JPG, atau WebP ke sini
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Preview Card saat file terpilih */
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 relative group shadow-sm">
                    <div className="aspect-[21/9] relative">
                      <Image src={previewUrl} alt="Preview Banner" fill className="object-cover" />
                    </div>

                    {/* Metadata Overlay Bar */}
                    <div className="flex items-center justify-between bg-slate-900/90 text-white px-3 py-2 text-[11px]">
                      <div className="flex items-center gap-2 truncate">
                        {selectedFileFormat && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white font-black text-[9px]">
                            {selectedFileFormat}
                          </span>
                        )}
                        <span className="truncate max-w-[170px] font-medium" title={selectedFile?.name}>
                          {selectedFile?.name}
                        </span>
                        {selectedFile && (
                          <span className="text-slate-400 text-[10px]">
                            ({(selectedFile.size / 1024).toFixed(0)} KB)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setSelectedFileFormat(null);
                          setPreviewUrl(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/20 transition-colors shrink-0"
                        title="Hapus berkas"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 mt-2">
                  Format gambar: <strong>PNG, JPG, WebP</strong>. Rasio ideal: <strong>16:9</strong> atau <strong>21:9</strong>.
                </p>
              </div>

              {uploadResult && (
                <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                  uploadResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {uploadResult.success ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                  )}
                  <p className="text-xs">{uploadResult.message}</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!selectedFile || isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload & Simpan Banner
              </button>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Daftar Banner Promo (8 Cols) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Daftar Banner Promo
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {banners.length} Total
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gunakan tombol panah atau edit nomor untuk mengatur urutan penayangan carousel.
                </p>
              </div>
            </div>
            
            <div>
              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-400">Memuat data banner...</p>
                </div>
              ) : banners.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <LayoutTemplate className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-600">Belum ada banner promo yang diunggah.</p>
                  <p className="text-xs text-slate-400 mt-1">Gunakan formulir di sebelah kiri untuk menambahkan banner pertama Anda.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {banners.map((banner, index) => {
                    const inlineOrder = editingOrderMap[banner.id] ?? banner.orderIndex ?? (index + 1);
                    const isOrderDirty = inlineOrder !== banner.orderIndex;

                    return (
                      <div
                        key={banner.id}
                        className={`p-5 flex flex-col md:flex-row items-start md:items-center gap-5 transition-colors ${
                          !banner.isActive ? 'bg-slate-50/60 opacity-80' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* 1. Urutan Badge & Stepper Buttons */}
                        <div className="flex md:flex-col items-center justify-center gap-1 shrink-0 bg-slate-100/80 p-2 rounded-2xl border border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleMoveOrder(banner.id, 'up')}
                            disabled={index === 0 || isPending}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-colors"
                            title="Naikkan urutan (Tampil lebih awal)"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>

                          <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">No.</span>
                            <span className="text-base font-black text-emerald-700">
                              {banner.orderIndex ?? index + 1}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleMoveOrder(banner.id, 'down')}
                            disabled={index === banners.length - 1 || isPending}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-colors"
                            title="Turunkan urutan (Tampil lebih akhir)"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 2. Image Preview Thumbnail */}
                        <div className="w-full sm:w-44 aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden bg-slate-100 relative shrink-0 border border-slate-200 shadow-sm">
                          <Image 
                            src={banner.imageUrl} 
                            alt={banner.title || 'Banner'} 
                            fill 
                            className={`object-cover ${!banner.isActive ? 'grayscale' : ''}`} 
                          />
                          {!banner.isActive && (
                            <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                              <span className="px-2 py-1 rounded bg-black/70 text-white text-[10px] font-bold tracking-wider uppercase">
                                Nonaktif
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* 3. Detail Info Banner */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-base truncate">
                              {banner.title || <span className="italic text-slate-400">Tanpa Judul</span>}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              banner.isActive 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {banner.isActive ? 'Aktif (Tampil)' : 'Nonaktif (Disembunyikan)'}
                            </span>
                          </div>

                          {/* Link URL preview */}
                          {banner.linkUrl ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                              <Link2 className="w-3.5 h-3.5 shrink-0" />
                              <a 
                                href={banner.linkUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="truncate underline hover:text-emerald-800 max-w-xs flex items-center gap-1"
                                title={banner.linkUrl}
                              >
                                {banner.linkUrl}
                                <ExternalLink className="w-3 h-3 inline shrink-0" />
                              </a>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">
                              Tidak ada tautan (Hanya gambar statis)
                            </div>
                          )}

                          {/* Inline Order Editor */}
                          <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
                            <span className="font-semibold text-slate-600">Urutan Tampil:</span>
                            <input
                              type="number"
                              min="1"
                              value={inlineOrder}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setEditingOrderMap((prev) => ({ ...prev, [banner.id]: val }));
                              }}
                              className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 text-center focus:border-emerald-500 focus:outline-none"
                            />
                            {isOrderDirty && (
                              <button
                                type="button"
                                onClick={() => handleSaveInlineOrder(banner.id)}
                                disabled={isPending}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors"
                              >
                                <Save className="w-3 h-3" />
                                Simpan No
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4. Action Buttons (CRUD) */}
                        <div className="flex flex-wrap md:flex-col items-end gap-2 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(banner)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                            title="Edit banner ini"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-600" />
                            Edit
                          </button>

                          {/* Toggle Status Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(banner.id, banner.isActive)}
                            disabled={isPending}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
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
                          
                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(banner.id, banner.imageUrl)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* EDIT MODAL DIALOG (CRUD UPDATE) */}
      {/* ========================================================================= */}
      {editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Edit Banner Promo</h3>
                  <p className="text-xs text-slate-500">Ubah judul, urutan penomoran, tautan, atau ganti gambar banner</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {editError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{editError}</p>
                </div>
              )}

              {/* Preview Gambar Saat Ini / Gambar Baru */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Tampilan Gambar Banner
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">PNG, JPG, WebP (Maks. 5 MB)</span>
                </div>

                {editPreviewUrl && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 aspect-[21/9] relative mb-3 shadow-inner">
                    <Image src={editPreviewUrl} alt="Preview" fill className="object-cover" />
                    {editFile && editFileFormat && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold shadow-md">
                        Gambar Baru ({editFileFormat})
                      </span>
                    )}
                  </div>
                )}

                {/* Dropzone / File input for edit modal */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsEditDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsEditDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsEditDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processEditFile(file);
                  }}
                  onClick={() => editFileInputRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed p-3.5 text-center cursor-pointer transition-all duration-200 ${
                    isEditDragging
                      ? 'border-emerald-500 bg-emerald-50/70'
                      : 'border-slate-300 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/30'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    onChange={handleEditFileChange}
                    ref={editFileInputRef}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
                    <Upload className="h-4 w-4 text-emerald-600" />
                    <span>
                      {editFile ? `Ganti berkas: ${editFile.name}` : 'Klik / Tarik gambar baru ke sini untuk mengganti'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Biarkan kosong jika tidak ingin mengganti file gambar yang sudah ada.
                </p>
              </div>

              {/* Judul */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Judul Banner
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Misal: Promo Akhir Tahun"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-500" />
                  Link URL Tujuan
                </label>
                <input
                  type="text"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  placeholder="Contoh: /fasilitas atau https://..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Pengunjung akan diarahkan ke URL ini saat mengklik banner.
                </p>
              </div>

              {/* Urutan Tampil */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Nomor Urutan Tampil
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={editOrderIndex}
                    onChange={(e) => setEditOrderIndex(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 text-center focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">
                    Nomor lebih kecil tampil lebih awal (1, 2, 3...)
                  </span>
                </div>
              </div>

              {/* Status Aktif */}
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">Tampilkan Banner di Homepage</span>
                    <span className="text-xs text-slate-500 block">Jika tidak dicentang, banner akan disembunyikan sementara.</span>
                  </div>
                </label>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Simpan Perubahan
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
