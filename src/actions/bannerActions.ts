"use server";

import { prisma } from '../lib/prisma';
import { getAdminSession } from './authActions';
import { toPublicMessage } from '../lib/userFacingError';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'promo-banners';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Upload banner promo ke Supabase Storage dan simpan ke database
 */
export async function uploadPromoBannerAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized. Silakan login ulang.' };

  const file = formData.get('banner_file') as File | null;
  const title = (formData.get('title') as string || '').trim();
  const linkUrl = (formData.get('linkUrl') as string || '').trim();
  const orderRaw = formData.get('orderIndex');

  if (!file || file.size === 0) {
    return { success: false, error: 'File gambar banner tidak ditemukan.' };
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: 'Format file harus PNG, JPG, atau WebP.' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Ukuran file maksimal 5 MB.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return { success: false, error: 'Konfigurasi Supabase URL tidak ditemukan.' };
  }

  if (!serviceRoleKey) {
    return {
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY belum diset. Upload banner tidak bisa dilakukan.',
    };
  }

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `banner-${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: uploadError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .upload(fileName, bytes, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Gagal upload gambar: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    // Hitung orderIndex otomatis jika tidak diisi atau 0
    let orderIndex = orderRaw ? parseInt(orderRaw as string, 10) : 0;
    if (isNaN(orderIndex) || orderIndex <= 0) {
      const highest = await prisma.promoBanner.findFirst({
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true }
      });
      orderIndex = (highest?.orderIndex ?? 0) + 1;
    }

    // Simpan ke database
    await prisma.promoBanner.create({
      data: {
        title,
        linkUrl: linkUrl || null,
        imageUrl,
        isActive: true,
        orderIndex,
      },
    });

    revalidatePath('/admin/settings/banners');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: toPublicMessage(err, 'Gagal mengunggah banner.') };
  }
}

/**
 * Get all banners
 */
export async function getPromoBanners(activeOnly = false) {
  try {
    const banners = await prisma.promoBanner.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    return banners;
  } catch (error) {
    console.error("Error fetching banners:", error);
    return [];
  }
}

/**
 * Update existing banner (Edit judul, linkUrl, urutan, status, dan opsi ganti gambar)
 */
export async function updatePromoBannerAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'ID Banner tidak valid.' };

  const title = (formData.get('title') as string || '').trim();
  const linkUrl = (formData.get('linkUrl') as string || '').trim();
  const orderRaw = formData.get('orderIndex') as string;
  const isActiveRaw = formData.get('isActive');
  const file = formData.get('banner_file') as File | null;

  const orderIndex = orderRaw ? parseInt(orderRaw, 10) : 1;
  const isActive = isActiveRaw === 'true' || isActiveRaw === 'on';

  try {
    const existing = await prisma.promoBanner.findUnique({
      where: { id }
    });

    if (!existing) {
      return { success: false, error: 'Banner tidak ditemukan.' };
    }

    let newImageUrl = existing.imageUrl;

    // Jika user mengunggah gambar pengganti baru
    if (file && file.size > 0) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return { success: false, error: 'Format file harus PNG, JPG, atau WebP.' };
      }
      if (file.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Ukuran file gambar baru maksimal 5 MB.' };
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        return { success: false, error: 'Konfigurasi storage Supabase tidak tersedia.' };
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `banner-${Date.now()}.${ext}`;
      const bytes = await file.arrayBuffer();

      const { error: uploadError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, bytes, {
          contentType: file.type,
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Gagal upload gambar baru: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      newImageUrl = publicUrlData.publicUrl;

      // Hapus gambar lama jika ada di Supabase
      if (existing.imageUrl && existing.imageUrl.includes(supabaseUrl)) {
        const parts = existing.imageUrl.split('/');
        const oldFileName = parts[parts.length - 1];
        await supabase.storage.from(BUCKET_NAME).remove([oldFileName]).catch(() => {});
      }
    }

    await prisma.promoBanner.update({
      where: { id },
      data: {
        title,
        linkUrl: linkUrl || null,
        imageUrl: newImageUrl,
        orderIndex: isNaN(orderIndex) ? 1 : orderIndex,
        isActive,
      }
    });

    revalidatePath('/admin/settings/banners');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: toPublicMessage(error, 'Gagal memperbarui banner.') };
  }
}

/**
 * Delete a banner
 */
export async function deletePromoBannerAction(id: string, imageUrl: string) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    // 1. Delete from Supabase Storage
    const supabase = getSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (supabase && supabaseUrl && imageUrl.includes(supabaseUrl)) {
      const parts = imageUrl.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from(BUCKET_NAME).remove([fileName]).catch(() => {});
    }

    // 2. Delete from Database
    await prisma.promoBanner.delete({
      where: { id }
    });

    revalidatePath('/admin/settings/banners');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: toPublicMessage(error, 'Gagal memproses banner.') };
  }
}

/**
 * Toggle banner active status
 */
export async function togglePromoBannerStatusAction(id: string, currentStatus: boolean) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.promoBanner.update({
      where: { id },
      data: { isActive: !currentStatus }
    });

    revalidatePath('/admin/settings/banners');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: toPublicMessage(error, 'Gagal memproses banner.') };
  }
}

/**
 * Update banner order directly (Set urutan penomoran tampil)
 */
export async function updatePromoBannerOrderAction(id: string, newOrder: number) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsedOrder = parseInt(String(newOrder), 10);
  if (isNaN(parsedOrder)) {
    return { success: false, error: 'Nomor urutan harus berupa angka valid.' };
  }

  try {
    await prisma.promoBanner.update({
      where: { id },
      data: { orderIndex: parsedOrder }
    });

    revalidatePath('/admin/settings/banners');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: toPublicMessage(error, 'Gagal memproses urutan banner.') };
  }
}

/**
 * Move banner order Up or Down by swapping with adjacent banner
 */
export async function movePromoBannerOrderAction(id: string, direction: 'up' | 'down') {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    const banners = await prisma.promoBanner.findMany({
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const index = banners.findIndex((b) => b.id === id);
    if (index === -1) return { success: false, error: 'Banner tidak ditemukan.' };

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) {
      return { success: true }; // Sudut batas, tidak perlu swap
    }

    const currentBanner = banners[index];
    const targetBanner = banners[targetIndex];

    // Jika orderIndex bernilai sama, berikan indeks sequential dulu
    let currentNewOrder = targetBanner.orderIndex;
    let targetNewOrder = currentBanner.orderIndex;

    if (currentNewOrder === targetNewOrder) {
      currentNewOrder = direction === 'up' ? targetBanner.orderIndex - 1 : targetBanner.orderIndex + 1;
    }

    await prisma.$transaction([
      prisma.promoBanner.update({
        where: { id: currentBanner.id },
        data: { orderIndex: currentNewOrder }
      }),
      prisma.promoBanner.update({
        where: { id: targetBanner.id },
        data: { orderIndex: targetNewOrder }
      })
    ]);

    revalidatePath('/admin/settings/banners');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: toPublicMessage(error, 'Gagal menukar urutan banner.') };
  }
}
