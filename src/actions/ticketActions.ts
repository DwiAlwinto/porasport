"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentAdminAction } from './authActions';
import { toPublicMessage } from '../lib/userFacingError';

export interface TicketVerificationResult {
  success: boolean;
  error?: string;
  ticket?: {
    id: string;
    qrCodeToken: string;
    status: string;
    isValid: boolean;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    nik?: string;
    venueName: string;
    venueAddress: string;
    fieldName: string;
    sportCategory: string;
    date: string;
    timeSlots: string;
    quantity: number;
    totalAmount: number;
    paymentMethod: string;
    paidAt?: string;
    checkedInAt?: string;
    adminNotes?: string;
  };
}

/**
 * 1. Verifikasi Keaslian Tiket (Online Scan)
 * Dapat diakses publik saat kamera HP petugas/pengunjung scan QR Code tiket.
 */
export async function verifyTicketAction(tokenOrId: string): Promise<TicketVerificationResult> {
  try {
    if (!tokenOrId || typeof tokenOrId !== 'string') {
      return { success: false, error: 'Token atau ID Tiket tidak valid.' };
    }

    const clean = tokenOrId.trim();

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { qrCodeToken: clean },
          { id: clean },
          { id: clean.toUpperCase() },
          { qrCodeToken: `QR-${clean}` },
        ],
      },
      include: {
        venue: {
          select: {
            name: true,
            address: true,
            city: true,
          },
        },
        items: {
          include: {
            field: {
              select: {
                name: true,
                sportType: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        payment: true,
      },
    });

    if (!booking) {
      return { success: false, error: 'Tiket tidak ditemukan dalam sistem resmi DISBUDPORA.' };
    }

    const isValid = booking.status === 'PAID_SUCCESS';
    const firstItem = booking.items[0];
    const timeSlots = booking.items.map((i) => `${i.timeStart} - ${i.timeEnd}`).join(', ');

    let checkedInAt: string | undefined = undefined;
    if (booking.adminNotes && booking.adminNotes.includes('CHECKED_IN:')) {
      const match = booking.adminNotes.match(/CHECKED_IN:\s*([^;]+)/);
      if (match) checkedInAt = match[1].trim();
    }

    return {
      success: true,
      ticket: {
        id: booking.id,
        qrCodeToken: booking.qrCodeToken,
        status: booking.status,
        isValid,
        customerName: booking.senderName || booking.user?.name || 'Warga Pengunjung',
        customerEmail: booking.user?.email || undefined,
        customerPhone: booking.senderPhone || booking.user?.phone || undefined,
        nik: booking.nik || undefined,
        venueName: booking.venue?.name || 'Fasilitas Olahraga DISBUDPORA',
        venueAddress: booking.venue?.address || booking.venue?.city || 'Kabupaten Bekasi',
        fieldName: firstItem?.field?.name || 'Lapangan',
        sportCategory: booking.sportCategory,
        date: firstItem?.date ? firstItem.date.toISOString().split('T')[0] : booking.createdAt.toISOString().split('T')[0],
        timeSlots: timeSlots || 'Sesuai Jadwal',
        quantity: firstItem?.quantity || 1,
        totalAmount: booking.grandTotal,
        paymentMethod: booking.paymentMethod,
        paidAt: booking.payment?.paidAt?.toISOString() || booking.updatedAt.toISOString(),
        checkedInAt,
        adminNotes: booking.adminNotes || undefined,
      },
    };
  } catch (error: any) {
    console.error('[verifyTicketAction] Error:', error);
    return {
      success: false,
      error: toPublicMessage(error, 'Terjadi kendala saat memvalidasi tiket.'),
    };
  }
}

/**
 * 2. Check-in Kehadiran Pengunjung di Lokasi Venue oleh Petugas / Admin
 */
export async function checkInTicketAction(bookingId: string) {
  try {
    const adminSession = await getCurrentAdminAction();
    if (!adminSession.admin) {
      return {
        success: false,
        error: 'Akses ditolak: Hanya petugas / admin DISBUDPORA yang dapat melakukan check-in pengunjung.',
      };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: 'Pesanan tiket tidak ditemukan.' };
    }

    if (booking.status !== 'PAID_SUCCESS') {
      return {
        success: false,
        error: `Tiket tidak dapat di-check-in karena berstatus ${booking.status}. Tiket harus LUNAS.`,
      };
    }

    const now = new Date();
    const stamp = `CHECKED_IN: Oleh ${adminSession.admin.name} pada ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID')} WIB`;
    const newNotes = booking.adminNotes ? `${booking.adminNotes}; ${stamp}` : stamp;

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        adminNotes: newNotes,
      },
    });

    revalidatePath('/ticket/verify');
    revalidatePath('/admin/bookings');
    return {
      success: true,
      message: 'Check-in berhasil! Pengunjung telah diverifikasi masuk lapangan.',
      checkedInAt: stamp,
    };
  } catch (error: any) {
    console.error('[checkInTicketAction] Error:', error);
    return {
      success: false,
      error: toPublicMessage(error, 'Gagal melakukan check-in tiket.'),
    };
  }
}
