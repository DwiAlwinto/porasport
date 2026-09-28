import 'server-only';

/**
 * Pembatas laju sederhana berbasis memori.
 *
 * Tujuannya menahan penyalahgunaan yang paling jelas: brute force password
 * admin, spam pendaftaran, dan pembuangan token ke Google Vision API.
 *
 * CATATAN PENTING: penyimpanan ini di memori proses, jadi hilang setiap
 * server restart dan TIDAK dibagikan antar instance. Untuk deployment
 * multi-instance, ganti dengan Redis/Upstash. Antarmuka fungsi di bawah
 * sengaja dibuat sempit supaya penggantiannya mudah.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Pembersih berkala supaya Map tidak tumbuh tanpa batas. */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Catat satu percobaan dan kembalikan apakah masih di bawah batas.
 *
 * @param key     pengenal unik, misalnya `admin-login:admin@sportbekasi.id`
 * @param limit   jumlah percobaan yang diizinkan dalam satu jendela waktu
 * @param windowMs panjang jendela dalam milidetik
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);

  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds };
}

/** Apakah kunci ini sedang diblokir? */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (bucket.resetAt <= Date.now()) return false;
  return bucket.count > limit;
}

/** Hapus pencatat untuk sebuah kunci — dipanggil setelah berhasil masuk. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Kunci progresif berdasarkan jumlah kegagalan.
 *
 * Durasi waited meningkat secara eksponensial, jadi penyerang yang terus
 * mencoba akan melambat terus, bukan sekadar menunggu jendela tetap habis.
 */
export function progressiveLock(
  key: string,
  attempts: number,
  baseMs = 15_000,
  maxMs = 15 * 60_000
): { locked: boolean; retryAfterSeconds: number } {
  const duration = Math.min(baseMs * Math.pow(2, Math.max(0, attempts - 1)), maxMs);
  buckets.set(key, { count: attempts, resetAt: Date.now() + duration });
  const retryAfterSeconds = Math.ceil(duration / 1000);
  return { locked: retryAfterSeconds > 1, retryAfterSeconds };
}

/** Jumlah kegagalan yang tercatat untuk sebuah kunci. */
export function failureCount(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return 0;
  return bucket.count;
}
