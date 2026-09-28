"use server";

import { cookies } from 'next/headers';
import { prisma } from '../lib/prisma';
import { verifyPassword, signSessionToken, verifySessionToken, AdminSessionPayload } from '../lib/auth';
import { rateLimit, progressiveLock, failureCount, resetRateLimit } from '../lib/rateLimit';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { toPublicMessage } from '../lib/userFacingError';
import { isSessionRevoked, revokeSession } from '../lib/revocation';

const COOKIE_NAME = 'admin_session';

/** Batas percobaan login admin per email, per jendela 15 menit. */
const ADMIN_LOGIN_LIMIT = 5;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return h.get('x-real-ip') || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Server Action: Login Petugas & Superadmin
 */
export async function adminLoginAction(data: { email: string; password: string }) {
  try {
    const email = data.email.trim().toLowerCase();
    const password = data.password;

    if (!email || !password) {
      return { success: false, error: 'Email dan kata sandi wajib diisi.' };
    }

    // Pembatas laju: menahan brute force kata sandi admin.
    const ip = await getClientIp();
    const ipLimit = rateLimit(`admin-login-ip:${ip}`, 20, ADMIN_LOGIN_WINDOW_MS);
    if (!ipLimit.ok) {
      return {
        success: false,
        error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(ipLimit.retryAfterSeconds / 60)} menit.`,
      };
    }

    const emailKey = `admin-login-email:${email}`;
    const emailLimit = rateLimit(emailKey, ADMIN_LOGIN_LIMIT, ADMIN_LOGIN_WINDOW_MS);
    if (!emailLimit.ok) {
      return {
        success: false,
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(emailLimit.retryAfterSeconds / 60)} menit.`,
      };
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Pesan disamakan dengan "kata sandi salah" supaya penyerang tidak bisa
      // menebak email admin mana yang terdaftar (user enumeration).
      return { success: false, error: 'Email atau kata sandi salah.' };
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses ditolak: Akun Anda bukan berstatus Administrator DISBUDPORA.',
      };
    }

    // Akun tanpa passwordHash TIDAK bisa login dengan password default.
    // Jalur ini dulu menerima password yang tertulis di source, sehingga siapa
    // pun bisa masuk ke akun admin yang hash-nya kosong.
    if (!user.passwordHash) {
      return {
        success: false,
        error: 'Akun ini belum memiliki kata sandi. Hubungi Superadmin untuk reset.',
      };
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      // Kunci progresif: setiap kegagalan memperpanjang jeda, sehingga
      // penyerang yang terus mencoba melambat terus.
      const attempts = failureCount(emailKey) + 1;
      const lock = progressiveLock(emailKey, attempts);
      return {
        success: false,
        error: lock.locked
          ? `Terlalu banyak percobaan. Coba lagi dalam ${lock.retryAfterSeconds} detik.`
          : 'Email atau kata sandi salah.',
      };
    }

    // Berhasil: bersihkan pencatat kegagalan.
    resetRateLimit(emailKey);
    resetRateLimit(`admin-login-ip:${ip}`);

    // Buat session token
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Simpan ke HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error: any) {
    console.error("Admin login error:", error);
    return { success: false, error: toPublicMessage(error, 'Terjadi kesalahan sistem saat proses login.') };
  }
}

/**
 * Server Action: Logout Petugas
 *
 * Cookie dihapus DAN `sid` dicatat di tabel `revoked_sessions`, supaya token
 * yang sudah disalin tidak tetap sah selama 7 hari.
 */
export async function adminLogoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const payload = verifySessionToken(token);
    if (payload?.sid) {
      await revokeSession({
        sid: payload.sid,
        userId: payload.userId,
        scope: 'ADMIN',
        reason: 'logout',
        expiresAt: new Date(payload.exp),
      });
    }
  }

  cookieStore.delete(COOKIE_NAME);
  return { success: true };
}

/**
 * Server Action: Dapatkan Admin yang Sedang Login (dari admin session cookie)
 */
export async function getCurrentAdminAction() {
  try {
    const session = await getAdminSession();
    if (!session) return { success: true, admin: null };

    const admin = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return { success: true, admin };
  } catch (err) {
    return { success: false, admin: null };
  }
}

/**
 * Server Action / Helper: Cek Sesi Admin Saat Ini
 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifySessionToken(token);
    if (!payload) return null;

    // Sesi yang sudah dicabut saat logout harus ditolak, meski tokennya
    // secara tanda tangan masih valid.
    if (await isSessionRevoked(payload.sid)) return null;

    return payload;
  } catch {
    // Next.js melempar sinyal "Dynamic server usage" saat route accessing
    // cookies() dirender secara statis. Itu aliran kontrol normal, bukan error,
    // jadi sengaja tidak dilog agar tidak membanjiri output build.
    return null;
  }
}
