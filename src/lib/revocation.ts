import { prisma } from './prisma';

/**
 * Pencabutan sesi.
 *
 * Token sesi berupa HMAC stateless, jadi token yang sudah dikirim ke browser
 * tidak bisa ditarik kembali. Yang bisa dilakukan adalah mencatat `sid`-nya
 * sebagai dicabut, lalu menolak setiap verifikasi yang sid-nya ada di daftar.
 *
 * CATATAN PENTING tentang `src/proxy.ts`:
 * proxy hanya melakukan pemeriksaan tanda tangan HMAC murni dan TIDAK bisa
 * melakukan query database. Jadi cookie yang sudah dicabut masih bisa
 * "melewati" proxy dan sampai ke halaman /admin. Penegakan sebenarnya terjadi
 * di `getAdminSession()`, yang dipanggil layout dan setiap server action.
 * Ini pemeriksaan berlapis, bukan celah otorisasi.
 */

export type SessionScope = 'ADMIN' | 'USER';

/** Cache per-process supaya satu request tidak query berulang kali. */
const cache = new Map<string, { revoked: boolean; at: number }>();
const CACHE_TTL_MS = 15_000;
let lastSweep = Date.now();

function sweepCache(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, value] of cache) {
    if (value.at + CACHE_TTL_MS <= now) cache.delete(key);
  }
}

/**
 * Apakah `sid` sudah dicabut?
 *
 * Token lama yang tidak punya `sid` dianggap tidak bisa dicabut dan tetap
 * diterima, agar sesi yang sudah berlaku tidak ikut terputus setelah deploy.
 */
export async function isSessionRevoked(sid: string | undefined | null): Promise<boolean> {
  if (!sid) return false;

  const now = Date.now();
  sweepCache(now);

  const cached = cache.get(sid);
  if (cached && cached.at + CACHE_TTL_MS > now) {
    return cached.revoked;
  }

  const found = await prisma.revokedSession.findUnique({
    where: { sid },
    select: { id: true },
  });

  const revoked = found !== null;
  cache.set(sid, { revoked, at: now });
  return revoked;
}

/** Catat `sid` sebagai dicabut. Aman dipanggil berulang. */
export async function revokeSession(params: {
  sid: string;
  userId: string;
  scope: SessionScope;
  reason?: string;
  expiresAt: Date;
}): Promise<void> {
  cache.delete(params.sid);
  try {
    await prisma.revokedSession.upsert({
      where: { sid: params.sid },
      update: {},
      create: {
        sid: params.sid,
        userId: params.userId,
        scope: params.scope,
        reason: params.reason ?? null,
        expiresAt: params.expiresAt,
      },
    });
  } catch (error) {
    // Kegagalan mencatat tidak boleh membuat logout gagal.
    console.error('[auth] Gagal mencatat pencabutan sesi:', error);
  }
}

/**
 * Hapus catatan pencabutan yang sudah tidak berguna.
 *
 * Baris yang `expiresAt`-nya sudah lewat tidak pernah ditanyakan lagi, jadi
 * aman dihapus. Dipanggil dari cron expire-bookings.
 */
export async function purgeExpiredRevocations(): Promise<number> {
  try {
    const result = await prisma.revokedSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    cache.clear();
    return result.count;
  } catch (error) {
    console.error('[auth] Gagal membersihkan catatan sesi:', error);
    return 0;
  }
}

/*
 * BATASAN YANG DISENGAJA:
 *
 * Dengan token stateless, seluruh sesi seorang pengguna TIDAK bisa dicabut
 * sekaligus, karena token yang sudah terbit tidak tercatat di server. Kita
 * hanya mengetahui `sid` ketika pengguna logout.
 *
 * Untuk "logout dari semua perangkat" atau "reset kata sandi membatalkan semua
 * sesi", diperlukan kolom versi sesi (mis. `sessionVersion` di tabel users
 * yang ikut ditanam ke payload token, lalu dinaikkan setiap kali kata sandi
 * berubah). Fitur itu belum ada di sini, dan sengaja TIDAK disamarkan dengan
 * fungsi bernama `revokeAllUserSessions` yang tidak benar-benar mencabut
 * apa pun. Yang tersedia sekarang: pencabutan per sesi saat logout.
 */
