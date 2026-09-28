"use server";

import { prisma } from '../lib/prisma';
import { getAdminSession } from './authActions';
import { toPublicMessage } from '../lib/userFacingError';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'promo-banners';

/**
 * Upload banner promo ke Supabase Storage dan simpan ke database
 */
export async function uploadPromoBannerAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized. Silakan login ulang.' };

  const file = formData.get('banner_file') as File | null;
  const title = formData.get('title') as string || '';

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

  // Jangan jatuh ke anon key diam-diam. Anon key tidak punya izin tulis,
  // sehingga upload akan gagal dengan pesan yang membingungkan.
  if (!serviceRoleKey) {
    return {
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY belum diset. Upload banner tidak bisa dilakukan.',
    };
  }
  const authKey = serviceRoleKey;

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `banner-${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const supabase = createClient(supabaseUrl, authKey);

    // Pastikan bucket ada (opsional, karena normalnya kita asumsikan sudah ada, 
    // namun kita bisa coba getBucket atau biarkan supabase JS handle errornya).
    // Kita langsung coba upload saja.
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .upload(fileName, bytes, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Gagal upload gambar: ${uploadError.message}`);
    }

    // Dapatkan public URL
    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    // Simpan ke database
    await prisma.promoBanner.create({
      data: {
        title,
        imageUrl,
        isActive: true,
        orderIndex: 0, // Admin can change this later
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
 * Delete a banner
 */
export async function deletePromoBannerAction(id: string, imageUrl: string) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    // 1. Delete from Supabase Storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const authKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && authKey && imageUrl.includes(supabaseUrl)) {
      // Extract filename from URL
      const parts = imageUrl.split('/');
      const fileName = parts[parts.length - 1];
      
      const supabase = createClient(supabaseUrl, authKey);
      await supabase.storage.from(BUCKET_NAME).remove([fileName]);
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
 * Update banner order
 */
export async function updatePromoBannerOrderAction(id: string, newOrder: number) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.promoBanner.update({
      where: { id },
      data: { orderIndex: newOrder }
    });

    revalidatePath('/admin/settings/banners');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: toPublicMessage(error, 'Gagal memproses banner.') };
  }
}
