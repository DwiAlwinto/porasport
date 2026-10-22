"use server";

import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth';
import { getAdminSession } from './authActions';
import { toPublicMessage } from '../lib/userFacingError';
import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { deleteBookingProofFiles } from '../lib/storage';

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
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return { success: false, customers: [], error: 'Akses ditolak: Hanya petugas Admin dan Superadmin yang diizinkan.' };
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
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
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

/**
 * 8. Tambah User Penyewa (Customer) Baru oleh Superadmin
 */
export async function createCustomerUserAction(data: {
  name: string;
  email: string;
  phone?: string;
  password?: string;
}) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya Superadmin yang berwenang menambah user penyewa.' };
    }

    const name = data.name?.trim();
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim() || null;
    const password = data.password?.trim() || 'disbudpora123';

    if (!name || !email) {
      return { success: false, error: 'Nama lengkap dan email wajib diisi.' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Format email tidak valid.' };
    }

    if (password.length < 8) {
      return { success: false, error: 'Kata sandi minimal 8 karakter.' };
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return { success: false, error: `Email ${email} sudah terdaftar di sistem.` };
    }

    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone },
      });
      if (existingPhone) {
        return { success: false, error: `Nomor WhatsApp/telepon ${phone} sudah digunakan akun lain.` };
      }
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: hashPassword(password),
        role: 'USER',
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      },
    });

    revalidatePath('/admin/users/customers');
    return { success: true, customer: newUser };
  } catch (error: any) {
    console.error("Failed to create customer user:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal menambahkan user penyewa baru.') };
  }
}

/**
 * 9. Perbarui Profil & Sandi User Penyewa oleh Superadmin
 */
export async function updateCustomerUserAction(data: {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  newPassword?: string;
}) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya Superadmin yang berwenang mengubah data user penyewa.' };
    }

    const { userId } = data;
    const name = data.name?.trim();
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim() || null;
    const newPassword = data.newPassword?.trim();

    if (!userId || !name || !email) {
      return { success: false, error: 'ID user, nama, dan email wajib diisi.' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Format email tidak valid.' };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return { success: false, error: 'User penyewa tidak ditemukan.' };
    }

    if (targetUser.role !== 'USER') {
      return { success: false, error: 'Aksi ini hanya untuk mengelola data user penyewa (Role USER).' };
    }

    if (email !== targetUser.email) {
      const emailConflict = await prisma.user.findUnique({
        where: { email },
      });
      if (emailConflict) {
        return { success: false, error: `Email ${email} sudah digunakan akun lain.` };
      }
    }

    if (phone && phone !== targetUser.phone) {
      const phoneConflict = await prisma.user.findFirst({
        where: { phone, id: { not: userId } },
      });
      if (phoneConflict) {
        return { success: false, error: `Nomor telepon ${phone} sudah digunakan akun lain.` };
      }
    }

    const updateData: any = {
      name,
      email,
      phone,
    };

    if (newPassword) {
      if (newPassword.length < 8) {
        return { success: false, error: 'Kata sandi baru minimal 8 karakter.' };
      }
      updateData.passwordHash = hashPassword(newPassword);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    revalidatePath('/admin/users/customers');
    return { success: true, customer: updated };
  } catch (error: any) {
    console.error("Failed to update customer user:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal memperbarui data user penyewa.') };
  }
}

/**
 * 10. Hapus User Penyewa Permanen beserta Pembersihan Berkas Storage Supabase
 */
export async function deleteCustomerUserAction(userId: string) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya Superadmin yang diizinkan menghapus data penyewa.' };
    }

    if (userId === session.userId) {
      return { success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri.' };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        bookings: {
          include: {
            items: true,
            paymentProof: true,
          },
        },
      },
    });

    if (!targetUser) {
      return { success: false, error: 'User penyewa tidak ditemukan.' };
    }

    if (targetUser.role !== 'USER') {
      return { success: false, error: 'Hanya akun penyewa (role USER) yang dapat dihapus dari fitur ini.' };
    }

    // 1. Kumpulkan daftar booking dan berkas bukti pembayaran untuk dibersihkan dari Storage
    const proofCleanups: { bookingId: string; paths: (string | null | undefined)[] }[] = [];
    for (const b of targetUser.bookings) {
      proofCleanups.push({
        bookingId: b.id,
        paths: [b.paymentProofUrl, b.paymentProof?.fileUrl],
      });
    }

    // 2. Transaksi penghapusan atomik pada database
    await prisma.$transaction(async (tx) => {
      for (const b of targetUser.bookings) {
        // Lepas kuota pada slot yang terhubung
        for (const item of b.items) {
          const slot = await tx.fieldSlot.findFirst({
            where: {
              fieldId: item.fieldId,
              date: item.date,
              timeStart: item.timeStart,
            },
          });

          if (slot) {
            const qty = item.quantity || 1;
            const newBooked = Math.max(0, slot.bookedCapacity - qty);
            const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (newBooked >= slot.maxCapacity ? 'BOOKED' : 'AVAILABLE');
            await tx.fieldSlot.update({
              where: { id: slot.id },
              data: {
                bookedCapacity: newBooked,
                status: newStatus,
                bookingId: newBooked === 0 ? null : slot.bookingId,
                bookedByUserId: newBooked === 0 ? null : slot.bookedByUserId,
              },
            });
          }
        }

        // Hapus data PaymentProof, Payment, BookingItem, dan Booking
        await tx.paymentProof.deleteMany({ where: { bookingId: b.id } });
        await tx.payment.deleteMany({ where: { bookingId: b.id } });
        await tx.bookingItem.deleteMany({ where: { bookingId: b.id } });
        await tx.booking.delete({ where: { id: b.id } });
      }

      // Hapus user secara permanen (otomatis cascade ke Review dan RevokedSession)
      await tx.user.delete({
        where: { id: userId },
      });
    }, { maxWait: 15000, timeout: 30000 });

    // 3. Bersihkan seluruh file fisik bukti pembayaran di Supabase Storage & local disk
    let totalStorageFilesDeleted = 0;
    for (const item of proofCleanups) {
      try {
        const cleanupRes = await deleteBookingProofFiles(item.bookingId, item.paths);
        totalStorageFilesDeleted += cleanupRes.deletedCount;
      } catch (cleanErr: any) {
        console.warn(`[Storage Cleanup Warning] Kendala saat membersihkan bukti sewa ${item.bookingId}:`, cleanErr?.message);
      }
    }

    console.log(`[Customer Deletion] User ${userId} (${targetUser.email}) berhasil dihapus permanen. Total ${totalStorageFilesDeleted} berkas bukti storage dibersihkan.`);

    revalidatePath('/admin/users/customers');
    revalidatePath('/admin/bookings');
    revalidatePath('/admin');
    return {
      success: true,
      message: `Akun penyewa ${targetUser.name} beserta ${targetUser.bookings.length} riwayat pesanan dan seluruh berkas bukti pembayaran di storage berhasil dibersihkan permanen.`,
    };
  } catch (error: any) {
    console.error("Failed to delete customer user:", error);
    return { success: false, error: toPublicMessage(error, 'Gagal menghapus akun penyewa.') };
  }
}

