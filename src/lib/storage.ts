import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[Storage] NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi. ' +
      'Jangan jatuh ke anon key — upload akan gagal diam-diam.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

/** Ekstensi yang boleh disimpan di bucket bukti pembayaran. */
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'] as const
/** Batas ukuran bukti bayar: 5 MB. */
export const MAX_PROOF_BYTES = 5 * 1024 * 1024

/**
 * Periksa magic bytes gambar.
 *
 * `mimeType` dan nama berkas berasal dari client dan bisa dipalsukan. Tanpa
 * pemeriksaan isi file, HTML atau SVG berisi skrip bisa tersimpan di bucket
 * dan dijalankan pada origin aplikasi (stored XSS).
 */
function looksLikeImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return true
  return false
}

/** Content-Type ditentukan dari isi file, bukan dari klaim client. */
function detectImageType(buffer: Buffer): string | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png'
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp'
  return null
}

export const PROOF_BUCKET = 'booking-files'

/** Masa berlaku URL bertanda tangan (detik). */
const SIGNED_URL_TTL_SECONDS = 600

export interface UploadResult {
  /**
   * Path di dalam bucket, contoh:
   * `payment-proofs/GLR-1234/1727000000000-bukti.jpg`
   *
   * Yang disimpan ke database adalah `path`, BUKAN URL publik. Bucket
   * `booking-files` bisa dibuat privat, dan aksesnya hanya lewat signed URL
   * berumur pendek yang dibuatkan server saat dibutuhkan.
   */
  path: string
  fileName: string
  fileSize: number
  mimeType: string
}

/**
 * Ubah nilai `paymentProofUrl` yang tersimpan menjadi path bucket.
 *
 * Menangani tiga bentuk:
 *  - path baru:            `payment-proofs/GLR-1/123.jpg`
 *  - URL publik lama:      `https://proj.supabase.co/storage/v1/object/public/booking-files/payment-proofs/...`
 *  - URL bertanda tangan:  `https://proj.supabase.co/storage/v1/object/sign/booking-files/...`
 *
 * Nilai yang tidak dikenali (termasuk string sentinella seperti
 * 'uploaded' dari versi lama) menghasilkan `null`, bukan exception.
 */
export function toStoragePath(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('payment-proofs/')) return value

  // Signed URL punya query string `?token=...` yang harus dibuang, dan pola
  // regex di bawah sudah tidak memuat karakter `?`.
  const match = value.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/?#]+\/(.+)$/)
  if (!match) return null

  const path = match[1].split(/[?#]/)[0]
  return path || null
}

export async function uploadPaymentProof(
  file: Buffer,
  fileName: string,
  bookingId: string
): Promise<UploadResult> {
  if (!file || file.length === 0) {
    throw new Error('Berkas bukti pembayaran kosong.')
  }
  if (file.length > MAX_PROOF_BYTES) {
    throw new Error('Ukuran berkas maksimal 5 MB.')
  }

  const detected = detectImageType(file)
  if (!detected) {
    throw new Error('Isi berkas bukan gambar JPG, PNG, atau WEBP yang valid.')
  }

  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) {
    throw new Error('Format berkas tidak didukung. Gunakan JPG, PNG, atau WEBP.')
  }

  const timestamp = Date.now()
  const safeBase = (fileName.split('.')[0] || 'proof').replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 40)
  const sanitizedName = `${safeBase}.${ext}`
  const safeBookingId = String(bookingId).replace(/[^a-zA-Z0-9-]/g, '')
  const path = `payment-proofs/${safeBookingId}/${timestamp}-${sanitizedName}`

  // Content-Type memakai hasil deteksi, bukan nilai kiriman client.
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, file, {
      contentType: detected,
      upsert: false,
    })

  if (error) {
    console.error('[Storage] Upload failed:', error)
    throw new Error('Gagal mengunggah bukti pembayaran.')
  }

  return {
    path: data.path,
    fileName: sanitizedName,
    fileSize: file.length,
    mimeType: detected,
  }
}

/**
 * Buat URL bertanda tangan berumur pendek untuk satu bukti pembayaran.
 *
 * Dipanggil server-side saja. Signed URL inilah yang membuat bucket bisa
 * privat: browser tidak pernah menerima URL permanen yang bisa dibagikan.
 */
export async function getSignedProofUrl(
  value: string | null | undefined
): Promise<string | null> {
  const path = toStoragePath(value)
  if (!path) return null

  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error) {
    console.error('[Storage] Gagal membuat signed URL:', error)
    return null
  }
  return data?.signedUrl ?? null
}

/** Unduh isi berkas lewat service role. Dipakai OCR. */
export async function downloadProof(value: string | null | undefined): Promise<Buffer | null> {
  const path = toStoragePath(value)
  if (!path) return null

  const { data, error } = await supabase.storage.from(PROOF_BUCKET).download(path)
  if (error) {
    console.error('[Storage] Gagal mengunduh bukti pembayaran:', error)
    return null
  }
  if (!data) return null

  return Buffer.from(await data.arrayBuffer())
}

export async function deletePaymentProof(value: string | null | undefined): Promise<boolean> {
  const path = toStoragePath(value)
  if (!path) return false

  const { error } = await supabase.storage.from(PROOF_BUCKET).remove([path])

  if (error) {
    console.error('[Storage] Delete failed:', error)
    return false
  }
  return true
}