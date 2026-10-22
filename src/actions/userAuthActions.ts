"use server";

import { prisma } from '../lib/prisma';
import {
  hashUserPassword,
  verifyUserPassword,
  setUserSessionCookie,
  clearUserSessionCookie,
  getCurrentUserSession,
} from '../lib/userAuth';
import { revalidatePath } from 'next/cache';
import { rateLimit, progressiveLock, failureCount, resetRateLimit } from '../lib/rateLimit';

export interface RegisterUserData {
  name: string;
  email: string;
  phone?: string;
  password?: string;
}

/**
 * Server Action: Registrasi User Baru (Penyewa Lapangan)
 */
export async function registerUserAction(data: RegisterUserData) {
  try {
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const phone = data.phone ? data.phone.trim().replace(/\D/g, '') : null;
    const password = data.password;

    if (!name || !email) {
      return { success: false, error: 'Nama dan email wajib diisi.' };
    }

    if (name.length > 120) {
      return { success: false, error: 'Nama terlalu panjang (maksimal 120 karakter).' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return { success: false, error: 'Format email tidak valid.' };
    }
    if (phone && phone.length > 20) {
      return { success: false, error: 'Nomor telepon terlalu panjang.' };
    }

    // Pembatas laju: menahan spam pendaftaran massal.
    const registerKey = `register:${email}`;
    const limit = rateLimit(registerKey, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      return {
        success: false,
        error: `Terlalu banyak percobaan pendaftaran. Coba lagi dalam ${Math.ceil(limit.retryAfterSeconds / 60)} menit.`,
      };
    }

    if (!password || password.length < 8) {
      return { success: false, error: 'Kata sandi minimal 8 karakter.' };
    }
    if (password.length > 200) {
      return { success: false, error: 'Kata sandi terlalu panjang.' };
    }

    // Cek apakah email sudah terdaftar
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return {
        success: false,
        error: 'Email ini sudah terdaftar. Silakan masuk menggunakan akun Anda.',
        isExistingEmail: true,
        existingEmail: email,
      };
    }

    // Cek nomor telepon jika diisi
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone },
      });
      if (existingPhone) {
        return {
          success: false,
          error: 'Nomor WhatsApp / HP ini sudah digunakan akun lain. Silakan gunakan nomor lain atau masuk ke akun Anda.',
          isExistingPhone: true,
        };
      }
    }

    // Enkripsi kata sandi
    const passwordHash = hashUserPassword(password);

    // Buat akun user penyewa baru di database
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: 'USER', // Otomatis berstatus Penyewa / Pengguna Publik
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      },
    });

    // Buat HTTP-only session cookie
    await setUserSessionCookie({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      avatarUrl: newUser.avatarUrl,
      role: newUser.role,
    });

    // Revalidate halaman Data User Penyewa di CMS admin agar langsung muncul
    revalidatePath('/admin/users/customers');
    revalidatePath('/');

    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role,
      },
    };
  } catch (err: any) {
    console.error('Error registerUserAction:', err);
    return {
      success: false,
      error: 'Terjadi kendala saat mendaftarkan akun. Coba lagi beberapa saat.',
    };
  }
}

/**
 * Server Action: Login User Penyewa (Email & Password)
 */
export async function loginUserAction(data: { email: string; password?: string }) {
  try {
    const email = data.email.trim().toLowerCase();
    const password = data.password;

    if (!email || !password) {
      return { success: false, error: 'Email dan kata sandi wajib diisi.' };
    }

    // Pembatas laju untuk menahan brute force akun penyewa.
    const emailKey = `user-login:${email}`;
    const limit = rateLimit(emailKey, 8, 15 * 60 * 1000);
    if (!limit.ok) {
      return {
        success: false,
        error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(limit.retryAfterSeconds / 60)} menit.`,
      };
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        success: false,
        error: 'Akun dengan email ini belum terdaftar. Silakan registrasi terlebih dahulu.',
      };
    }

    if (!user.passwordHash) {
      return {
        success: false,
        error: 'Akun ini terdaftar melalui Google. Silakan masuk menggunakan Google.',
      };
    }

    const isValid = verifyUserPassword(password, user.passwordHash);
    if (!isValid) {
      const lock = progressiveLock(emailKey, failureCount(emailKey) + 1);
      return {
        success: false,
        error: lock.locked
          ? `Terlalu banyak percobaan. Coba lagi dalam ${lock.retryAfterSeconds} detik.`
          : 'Kata sandi salah. Silakan periksa kembali.',
      };
    }

    resetRateLimit(emailKey);

    // Set session cookie
    await setUserSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    });

    revalidatePath('/');

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    };
  } catch (err: any) {
    console.error('Error loginUserAction:', err);
    return {
      success: false,
      error: 'Gagal melakukan login. Silakan coba kembali.',
    };
  }
}

/**
/**
 * Server Action: Google OAuth Khusus LOGIN (hanya boleh masuk jika sudah terdaftar)
 */
export async function googleAuthLoginUser(profile: {
  googleId?: string;
  email: string;
  name: string;
  avatarUrl?: string;
}) {
  try {
    const email = profile.email.trim().toLowerCase();
    const name = profile.name.trim();

    let user = await prisma.user.findUnique({
      where: { email },
    });

    // Jika user belum ada di database, tolak login dan minta register dahulu
    if (!user) {
      return {
        success: false,
        notRegistered: true,
        error: 'Akun Google ini belum terdaftar. Silakan lakukan registrasi terlebih dahulu.',
        email,
        name,
      };
    }

    // Perbarui foto avatar jika ada perubahan atau belum ada
    if (profile.avatarUrl && (!user.avatarUrl || user.avatarUrl.includes('dicebear'))) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: profile.avatarUrl,
        },
      });
    }

    // Buat HTTP-only session cookie & tandai has_registered
    await setUserSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    });

    revalidatePath('/admin/users/customers');
    revalidatePath('/');

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    };
  } catch (err: any) {
    console.error('Error googleAuthLoginUser:', err);
    return {
      success: false,
      error: 'Gagal memproses autentikasi Google.',
    };
  }
}

/**
 * Server Action: Google OAuth Khusus REGISTER (mendaftarkan akun baru ke database)
 */
export async function googleAuthRegisterUser(profile: {
  googleId?: string;
  email: string;
  name: string;
  avatarUrl?: string;
}) {
  try {
    const email = profile.email.trim().toLowerCase();
    const name = profile.name.trim();

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Akun sudah ada, perbarui avatar jika ada
      if (profile.avatarUrl && (!user.avatarUrl || user.avatarUrl.includes('dicebear'))) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            avatarUrl: profile.avatarUrl,
          },
        });
      }
    } else {
      // Buat user penyewa baru di database
      user = await prisma.user.create({
        data: {
          name,
          email,
          avatarUrl: profile.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
          role: 'USER',
        },
      });
    }

    // Buat HTTP-only session cookie & tandai has_registered
    await setUserSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    });

    revalidatePath('/admin/users/customers');
    revalidatePath('/');

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    };
  } catch (err: any) {
    console.error('Error googleAuthRegisterUser:', err);
    return {
      success: false,
      error: 'Gagal memproses registrasi Google.',
    };
  }
}

/**
 * Kompatibilitas mundur: panggil googleAuthRegisterUser atau googleAuthLoginUser sesuai mode
 */
export async function googleAuthUpsertUser(
  profile: {
    googleId?: string;
    email: string;
    name: string;
    avatarUrl?: string;
  },
  mode: 'login' | 'register' = 'register'
) {
  if (mode === 'login') {
    return googleAuthLoginUser(profile);
  }
  return googleAuthRegisterUser(profile);
}

/**
 * Server Action: Dapatkan User yang Sedang Login
 */
export async function getCurrentUserAction() {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: true, user: null };

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
      },
    });

    return { success: true, user };
  } catch (err) {
    return { success: false, user: null };
  }
}

/**
 * Server Action: Logout User Penyewa
 */
export async function logoutUserAction() {
  await clearUserSessionCookie();
  revalidatePath('/');
  return { success: true };
}
