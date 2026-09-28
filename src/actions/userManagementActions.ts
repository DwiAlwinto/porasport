"use server";

import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth';
import { getAdminSession } from './authActions';
import { toPublicMessage } from '../lib/userFacingError';
import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';

/**
 * 1. Ambil Daftar Khusus Petugas Administrator
 */
export async function getAdminUsersList(search?: string) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, admins: [], error: 'Akses ditolak: Hanya Superadmin yang diizinkan.' };
    }

    const where: any = { role: { in: ['ADMIN', 'SUPERADMIN'] } };
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const admins = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        avatarUrl: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, admins };
  } catch (error: any) {
    console.error("Failed to get admin users list:", error);
    return { success: false, admins: [], error: toPublicMessage(error, 'Gagal memuat daftar admin.') };
  }
}

/**
 * 2. Ambil Daftar Khusus User Penyewa (Customer / Masyarakat) Beserta Ringkasan Booking
 */
export async function getCustomerUsersList(search?: string) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, customers: [], error: 'Akses ditolak: Hanya Superadmin yang diizinkan.' };
    }

    const where: any = { role: 'USER' };
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rawCustomers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        avatarUrl: true,
        bookings: {
          select: {
            id: true,
            grandTotal: true,
            status: true,
            createdAt: true,
            nik: true,
            venue: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Hitung statistik belanja & pesanan per customer
    const customers = rawCustomers.map((c) => {
      const totalBookings = c.bookings.length;
      const paidBookings = c.bookings.filter((b) => b.status === 'PAID_SUCCESS');
      const totalSpent = paidBookings.reduce((acc, curr) => acc + curr.grandTotal, 0);
      const lastBooking = c.bookings[0] || null;
      const latestNik = c.bookings.find((b) => b.nik)?.nik || null;

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        nik: latestNik,
        createdAt: c.createdAt,
        totalBookings,
        paidBookingsCount: paidBookings.length,
        totalSpent,
        lastBookingVenue: lastBooking?.venue?.name || '-',
        lastBookingDate: lastBooking?.createdAt || null,
        lastBookingStatus: lastBooking?.status || null,
      };
    });

    return { success: true, customers };
  } catch (error: any) {
    console.error("Failed to get customer users list:", error);
    return { success: false, customers: [], error: toPublicMessage(error, 'Gagal memuat daftar pengguna.') };
  }
}

/**
 * 3. Ambil Riwayat Seluruh Booking Milik Satu User Penyewa Tertentu
 */
export async function getCustomerBookingHistory(userId: string) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, bookings: [], error: 'Akses ditolak.' };
    }

    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: {
        venue: {
          select: { name: true, city: true },
        },
        items: {
          include: {
            field: {
              select: { name: true, sportType: true },
            },
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, bookings };
  } catch (error: any) {
    console.error("Failed to get customer booking history:", error);
    return { success: false, bookings: [], error: toPublicMessage(error, 'Gagal memuat riwayat booking.') };
  }
}

/**
 * 4. Tambah Petugas Admin Baru oleh Superadmin
 */
export async function createAdminUserAction(data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: Role;
  unitNotes?: string;
}) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya Superadmin yang diizinkan menambahkan admin.' };
    }

    const email = data.email.trim().toLowerCase();
    if (!email || !data.name.trim() || !data.password) {
      return { success: false, error: 'Nama lengkap, email, dan kata sandi wajib diisi.' };
    }

    if (data.password.length < 6) {
      return { success: false, error: 'Kata sandi minimal 6 karakter.' };
    }

    // Cek duplikasi email
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return { success: false, error: `Email ${email} sudah terdaftar di sistem.` };
    }

    const newUser = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        phone: data.phone?.trim() || null,
        passwordHash: hashPassword(data.password),
        role: data.role || 'ADMIN',
      },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/users/admins');
    return { success: true, user: newUser };
  } catch (error: any) {
    console.error("Failed to create admin user:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal menambahkan admin baru.') };
  }
}

/**
 * 5. Hapus Pengguna / Admin
 */
export async function deleteUserAction(userId: string) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya Superadmin yang diizinkan.' };
    }

    if (userId === session.userId) {
      return { success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' };
    }

    if (userId === 'admin-1') {
      return { success: false, error: 'Akun Super Admin Utama (admin-1) tidak dapat dihapus.' };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/users/admins');
    revalidatePath('/admin/users/customers');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete user:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal menghapus pengguna.') };
  }
}

/**
 * 6. Reset Kata Sandi Petugas Admin oleh Superadmin
 */
export async function resetUserPasswordAction(userId: string, newPassword: string) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya Superadmin yang diizinkan.' };
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'Kata sandi baru minimal 6 karakter.' };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(newPassword),
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to reset password:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal mereset kata sandi.') };
  }
}

/**
 * 7. Ubah Role Pengguna
 */
export async function updateUserRoleAction(userId: string, newRole: Role) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya Superadmin yang diizinkan.' };
    }

    if (userId === session.userId) {
      return { success: false, error: 'Anda tidak dapat mengubah role akun Anda sendiri.' };
    }

    if (newRole === 'SUPERADMIN') {
      return { success: false, error: 'Role SUPERADMIN hanya dapat diberikan lewat prosedur resmi, tidak bisa di randomly kan dari daftar ini.' };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/users/admins');
    revalidatePath('/admin/users/customers');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update user role:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal mengubah role pengguna.') };
  }
}
