import crypto from 'crypto';
import { cookies } from 'next/headers';
import { isSessionRevoked, revokeSession } from './revocation';
import { prisma } from './prisma';

export const USER_COOKIE_NAME = 'user_session';

/**
 * Kunci penandatangan cookie sesi pengguna (penyewa).
 *
 * Sama seperti kunci admin: tidak ada nilai cadangan. Kalau `USER_SESSION_SECRET`
 * tidak diisi, `SESSION_SECRET` dipakai. Jika keduanya kosong, aplikasi berhenti
 * start — bukan diam-dim memakai kunci yang tertulis di source.
 */
const USER_SESSION_SECRET = (() => {
  const value = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!value || value.trim().length < 32) {
    throw new Error(
      '[auth] USER_SESSION_SECRET wajib diisi (minimal 32 karakter). ' +
        'Generate dengan: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
  }
  return value;
})();

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  exp: number; // timestamp in ms
  /**
   * Pengenal sesi unik, dipakai untuk mencabut sesi saat logout.
   * Opsional supaya token lama yang sudah terbit tetap bisa diverifikasi.
   */
  sid?: string;
}

/**
 * Hash password menggunakan crypto scrypt bawaan Node.js
 */
export function hashUserPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifikasi password dengan salt yang tersimpan
 */
export function verifyUserPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    return false;
  }
}

/**
 * Buat signed session token untuk user penyewa (HMAC-SHA256)
 */
export function signUserSessionToken(data: {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
}): string {
  const payload: UserSessionPayload = {
    ...data,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 hari aktif
    sid: crypto.randomUUID(),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', USER_SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verifikasi signed session token user
 */
export function verifyUserSessionToken(token: string): UserSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadStr, signature] = parts;

    // Bandingkan byte digest yang sudah didekode, bukan string base64-nya.
    // Versi lama membandingkan `Buffer.from(signature)` — itu membandingkan
    // karakter ASCII, bukan byte HMAC yang sesungguhnya.
    const expectedSignature = crypto
      .createHmac('sha256', USER_SESSION_SECRET)
      .update(payloadStr)
      .digest();

    const provided = Buffer.from(signature, 'base64url');
    if (provided.length !== expectedSignature.length) return null;
    if (!crypto.timingSafeEqual(provided, expectedSignature)) {
      return null;
    }

    const payload: UserSessionPayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf-8')
    );

    if (Date.now() > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Dapatkan session user saat ini dari Next.js Server Components / Actions
 */
export async function getCurrentUserSession(): Promise<UserSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyUserSessionToken(token);
  if (!payload) return null;

  // Sesi yang sudah dicabut saat logout harus ditolak.
  if (await isSessionRevoked(payload.sid)) return null;

  return payload;
}

/**
 * Set HTTP-only Cookie untuk sesi user
 */
export async function setUserSessionCookie(payload: {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
}) {
  const token = signUserSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 hari dalam detik
  });

  // Tandai bahwa browser/perangkat ini sudah terdaftar / pernah login
  cookieStore.set('has_registered', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 tahun
  });
}

/**
 * Hapus sesi user
 *
 * Cookie dihapus DAN `sid` dicatat sebagai dicabut, supaya token yang sudah
 * disalin tidak tetap sah selama 30 hari.
 */
export async function clearUserSessionCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;

  if (token) {
    const payload = verifyUserSessionToken(token);
    if (payload?.sid) {
      await revokeSession({
        sid: payload.sid,
        userId: payload.userId,
        scope: 'USER',
        reason: 'logout',
        expiresAt: new Date(payload.exp),
      });
    }
  }

  cookieStore.delete(USER_COOKIE_NAME);
}
