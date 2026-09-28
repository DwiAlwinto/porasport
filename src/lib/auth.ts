import crypto from 'crypto';

/**
 * Kunci penandatangan cookie sesi admin.
 *
 * WAJIB ada di environment. Dulu ada nilai cadangan yang tertulis di source,
 * sehingga siapa pun yang membaca repository bisa menalsukan cookie
 * `admin_session` dengan role SUPERADMIN. Sekarang aplikasi berhentiTOTAL
 * kalau kuncinya kosong — lebih baik gagal start daripada diam-dim dibuka.
 */
function requireSecret(name: 'SESSION_SECRET'): string {
  const value = process.env[name];
  if (!value || value.trim().length < 32) {
    throw new Error(
      `[auth] ${name} wajib diisi dengan nilai acak minimal 32 karakter. ` +
        `Generate dengan: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }
  return value;
}

// Diambil saat modul dimuat, jadi aplikasi gagal start bila env belum siap.
const SECRET_KEY = requireSecret('SESSION_SECRET');

/**
 * Hash password menggunakan crypto scrypt bawaan Node.js
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifikasi password dengan salt yang tersimpan
 */
export function verifyPassword(password: string, storedHash: string): boolean {
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

export interface AdminSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  exp: number; // unix timestamp in ms
  /**
   * Pengenal sesi unik. Dipakai untuk mencabut sesi saat logout — token
   * stateless tidak bisa dihapus dari browser, jadi `sid`-nya yang dicatat
   * di tabel `revoked_sessions`.
   */
  sid?: string;
}

/**
 * Buat signed session token (HMAC-SHA256)
 */
export function signSessionToken(data: { userId: string; email: string; name: string; role: string }): string {
  const payload: AdminSessionPayload = {
    ...data,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 hari
    sid: crypto.randomUUID(),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verifikasi signed session token
 */
export function verifySessionToken(token: string): AdminSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadStr, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(payloadStr)
      .digest();

    // Bandingkan sebagai buffer panjang tetap. crypto.timingSafeEqual melempar
    // error kalau panjangnya beda, yang membuat perbandingan gagal diam-diam.
    const provided = Buffer.from(signature, 'base64url');
    if (provided.length !== expectedSignature.length) return null;
    if (!crypto.timingSafeEqual(provided, expectedSignature)) {
      return null;
    }

    const payload: AdminSessionPayload = JSON.parse(
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
