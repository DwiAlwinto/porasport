"use server";

import { prisma } from '../lib/prisma';
import { getAdminSession } from './authActions';
import { verifyAdminOrSuperAdmin } from './adminActions';
import { toPublicMessage } from '../lib/userFacingError';
import { revalidatePath } from 'next/cache';
import { SETTING_KEYS } from '../lib/settingsConstants';

// Default values jika belum ada di database
const SETTING_DEFAULTS: Record<string, string> = {
  qris_image_url: '/images/qris-disbudpora.png',
  payment_notes: 'Rekening Resmi Dinas Kebudayaan, Pemuda dan Olahraga Kabupaten Bekasi.',
  qris_label: 'DISBUDPORA KAB. BEKASI',
  bank_name: 'DISBUDPORA',
};

/**
 * Ambil semua system settings (untuk display di checkout & admin)
 */
export async function getSystemSettings(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.systemSetting.findMany();
    const result: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  } catch {
    return { ...SETTING_DEFAULTS };
  }
}

/**
 * Ambil satu setting by key
 */
export async function getSettingValue(key: string): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return row?.value ?? SETTING_DEFAULTS[key] ?? '';
  } catch {
    return SETTING_DEFAULTS[key] ?? '';
  }
}

/**
 * Update text-based setting (payment_notes, qris_label, dll)
 */
export async function updateTextSetting(key: string, value: string) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedBy: session.name },
      create: { key, value, label: key, updatedBy: session.name },
    });
    revalidatePath('/admin/settings/qris');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: toPublicMessage(err, 'Gagal menyimpan pengaturan.') };
  }
}

/**
 * Upload gambar QRIS ke Supabase Storage (bucket: qris-images)
 * dan simpan public URL-nya ke system_settings di database.
 */
export async function uploadQrisImageAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized. Silakan login ulang.' };

  const file = formData.get('qris_file') as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: 'File gambar QRIS tidak ditemukan.' };
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
      error: 'SUPABASE_SERVICE_ROLE_KEY belum diset. Upload QRIS tidak bisa dilakukan.',
    };
  }
  const authKey = serviceRoleKey;
  const bucketName = 'qris-images';

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `qris-disbudpora-${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    // Upload ke Supabase Storage
    let uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authKey}`,
          'Content-Type': file.type,
          'x-upsert': 'true',
        },
        body: bytes,
      }
    );

    // Jika bucket belum ada, buat dulu lalu retry
    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      const isBucketMissing =
        uploadRes.status === 404 || errBody.includes('Bucket not found') || errBody.includes('bucket');

      if (isBucketMissing) {
        // Auto-create bucket public
        await fetch(`${supabaseUrl}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: bucketName,
            name: bucketName,
            public: true,
            file_size_limit: 10485760,
            allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'],
          }),
        });

        // Retry upload
        uploadRes = await fetch(
          `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authKey}`,
              'Content-Type': file.type,
              'x-upsert': 'true',
            },
            body: bytes,
          }
        );

        if (!uploadRes.ok) {
          // Body respons Supabase bisa memuat endpoint internal dan project ref.
          // Dicatat utuh di log server, tapi tidak pernah dikirim ke browser.
          const retryErr = await uploadRes.text();
          console.error('[QRIS] Upload gagal setelah bucket dibuat:', retryErr);
          return {
            success: false,
            error: 'Upload gambar QRIS gagal. Silakan hubungi admin sistem.',
          };
        }
      } else {
        // Bucket ada tapi upload gagal karena alasan lain
        console.error('[QRIS] Upload ke Supabase Storage gagal:', uploadRes.status, errBody);
        return {
          success: false,
          error: 'Upload gambar QRIS gagal. Silakan hubungi admin sistem.',
        };
      }
    }

    // Public URL dari Supabase Storage
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;

    // Simpan URL ke database
    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEYS.QRIS_IMAGE_URL },
      update: { value: publicUrl, updatedBy: session.name },
      create: {
        key: SETTING_KEYS.QRIS_IMAGE_URL,
        value: publicUrl,
        label: 'URL Gambar QRIS DISBUDPORA',
        updatedBy: session.name,
      },
    });

    revalidatePath('/admin/settings/qris');
    revalidatePath('/');

    return { success: true, url: publicUrl };
  } catch (err: unknown) {
    console.error('Upload QRIS error:', err);
    return {
      success: false,
      error: toPublicMessage(err, 'Terjadi kesalahan saat mengunggah gambar QRIS.'),
    };
  }
}

/**
 * Ambil semua settings (untuk riwayat admin)
 */
export async function getQrisHistory() {
  // Riwayat pengaturan hanya untuk staf. Tanpa cek ini, siapa pun bisa
  // membaca catatan pengaturan beserta nama admin yang mengubahnya.
  try {
    await verifyAdminOrSuperAdmin();
    const all = await prisma.systemSetting.findMany({ orderBy: { updatedAt: 'desc' } });
    return { success: true, settings: all };
  } catch {
    return { success: false, settings: [], error: 'Akses ditolak.' };
  }
}
