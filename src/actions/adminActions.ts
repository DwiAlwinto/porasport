"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { BookingStatus, SportCategory, UserCategory } from '@prisma/client';
import { resolveFieldPrice } from '../lib/pricing';
import { todayKey, dateFromKey } from '../lib/dateKeys';
import { toPublicMessage, UserFacingError } from '../lib/userFacingError';
import { getSignedProofUrl, deleteBookingProofFiles } from '../lib/storage';
import { getCurrentAdminAction } from './authActions';
import crypto from 'crypto';

export async function verifyAdminOrSuperAdmin() {
  const result = await getCurrentAdminAction();
  const admin = result.admin;
  if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPERADMIN')) {
    throw new Error('Unauthorized: ADMIN or SUPERADMIN access required');
  }
  return admin;
}

export async function verifySuperAdmin() {
  const result = await getCurrentAdminAction();
  const admin = result.admin;
  if (!admin || admin.role !== 'SUPERADMIN') {
    throw new Error('Unauthorized: SUPERADMIN access required');
  }
  return admin;
}

export interface AdminStats {
  totalRevenue: number;
  totalBookings: number;
  paidBookingsCount: number;
  pendingCount: number;
  pendingAmount: number;
  expiredOrCancelledCount: number;
  todayRevenue: number;
  todayBookingsCount: number;
  methodsBreakdown: { method: string; count: number; total: number }[];
}

/**
 * 1. Ambil Statistik Finansial & Pembayaran untuk Admin
 */
export async function getAdminPaymentStats(): Promise<AdminStats> {
  await verifyAdminOrSuperAdmin();
  try {
    const allBookings = await prisma.booking.findMany({
      include: {
        payment: true,
      },
    });

  const today = dateFromKey(todayKey());


    let totalRevenue = 0;
    let paidBookingsCount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let expiredOrCancelledCount = 0;
    let todayRevenue = 0;
    let todayBookingsCount = 0;

    const methodMap = new Map<string, { count: number; total: number }>();

    for (const b of allBookings) {
      const isPaid = b.status === 'PAID_SUCCESS' || b.status === 'COMPLETED';
      const isPending = b.status === 'PENDING_PAYMENT' || b.status === 'MENUNGGU_VALIDASI';
      const isClosed = b.status === 'CANCELLED';
      const isToday = new Date(b.createdAt) >= today;

      if (isPaid) {
        totalRevenue += b.grandTotal;
        paidBookingsCount++;
        if (isToday) {
          todayRevenue += b.grandTotal;
        }
      }

      if (isPending) {
        pendingCount++;
        pendingAmount += b.grandTotal;
      }

      if (isClosed) {
        expiredOrCancelledCount++;
      }

      if (isToday) {
        todayBookingsCount++;
      }

      // Method breakdown
      const method = b.paymentMethod || 'OTHER';
      const curr = methodMap.get(method) || { count: 0, total: 0 };
      curr.count += 1;
      if (isPaid) curr.total += b.grandTotal;
      methodMap.set(method, curr);
    }

    const methodsBreakdown = Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
    }));

    return {
      totalRevenue,
      totalBookings: allBookings.length,
      paidBookingsCount,
      pendingCount,
      pendingAmount,
      expiredOrCancelledCount,
      todayRevenue,
      todayBookingsCount,
      methodsBreakdown,
    };
  } catch (error) {
    console.error("Failed to calculate admin stats:", error);
    return {
      totalRevenue: 0,
      totalBookings: 0,
      paidBookingsCount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      expiredOrCancelledCount: 0,
      todayRevenue: 0,
      todayBookingsCount: 0,
      methodsBreakdown: [],
    };
  }
}

/**
 * 2. Ambil Daftar Seluruh Transaksi & Pembayaran dengan Filter
 */
export async function getAdminBookings(filters?: {
  status?: string;
  search?: string;
  paymentMethod?: string;
}) {
  await verifyAdminOrSuperAdmin();
  try {
    const whereClause: any = {};

    if (filters?.status && filters.status !== 'ALL') {
      if (filters.status === 'PENDING_OR_VALIDATION') {
        whereClause.status = { in: ['PENDING_PAYMENT', 'MENUNGGU_VALIDASI'] };
      } else {
        whereClause.status = filters.status as BookingStatus;
      }
    }

    if (filters?.paymentMethod && filters.paymentMethod !== 'ALL') {
      whereClause.paymentMethod = filters.paymentMethod;
    }

    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.trim();
      whereClause.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { senderName: { contains: q, mode: 'insensitive' } },
        { nik: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { phone: { contains: q, mode: 'insensitive' } } },
        { venue: { name: { contains: q, mode: 'insensitive' } } },
        { qrCodeToken: { contains: q, mode: 'insensitive' } },
      ];
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            images: true,
          },
        },
        items: {
          include: {
            field: {
              select: {
                id: true,
                name: true,
                sportType: true,
                type: true,
              },
            },
          },
        },
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Ganti `paymentProofUrl` yang berupa path menjadi signed URL berumur
    // pendek. Ini satu-satunya tempat yang melihat bukti bayar, dan hanya
    // untuk staf yang sudah lolos `verifyAdminOrSuperAdmin` di atas.
    const withSignedProofs = await Promise.all(
      bookings.map(async (b) => {
        if (!b.paymentProofUrl) return b;
        const signed = await getSignedProofUrl(b.paymentProofUrl);
        return { ...b, paymentProofUrl: signed };
      })
    );

    return withSignedProofs;
  } catch (error) {
    console.error("Failed to fetch admin bookings:", error);
    return [];
  }
}

/**
 * 3. Verifikasi Pembayaran Manual oleh Admin (Bypass / Bukti Transfer)
 * ADMIN & SUPERADMIN bisa approve
 */
export async function manualVerifyPayment(bookingId: string, adminNotes?: string) {
  await verifyAdminOrSuperAdmin();
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ambil booking
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { items: true },
      });

      if (!booking) {
        throw new UserFacingError("Booking tidak ditemukan.");
      }

      // 2. Update status Booking
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'PAID_SUCCESS',
        },
      });

      // 3. Upsert record Payment
      const ref = adminNotes ? `MANUAL-${adminNotes}` : `MANUAL-ADMIN-${Date.now()}`;
      await tx.payment.upsert({
        where: { bookingId: booking.id },
        update: {
          status: 'PAID',
          paidAt: new Date(),
          paymentGatewayRef: ref,
        },
        create: {
          bookingId: booking.id,
          amount: booking.grandTotal,
          paymentMethod: booking.paymentMethod,
          status: 'PAID',
          paidAt: new Date(),
          paymentGatewayRef: ref,
        },
      });

      // 4. Perbarui status FieldSlot sesuai kapasitas riil (urutan deterministik anti-deadlock)
      const slotsToUpdate: any[] = [];
      for (const item of booking.items) {
        const slot = await tx.fieldSlot.findFirst({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
        });
        if (slot) slotsToUpdate.push(slot);
      }

      slotsToUpdate.sort((a, b) => a.id.localeCompare(b.id));

      for (const slot of slotsToUpdate) {
        const isFull = slot.bookedCapacity >= slot.maxCapacity;
        const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (isFull ? 'BOOKED' : 'AVAILABLE');
        await tx.fieldSlot.update({
          where: { id: slot.id },
          data: {
            status: newStatus,
            bookingId: slot.bookingId ? slot.bookingId : booking.id,
            bookedByUserId: slot.bookedByUserId ? slot.bookedByUserId : booking.userId,
          },
        });
      }

      return updatedBooking;
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    return { success: true, booking: result };
  } catch (error: any) {
    console.error("Failed to manually verify payment:", error);
    return { success: false, error: toPublicMessage(error, "Gagal verifikasi pembayaran.") };
  }
}

/**
 * 4. Batalkan Booking / Kadaluwarsa (Bebaskan Slot Lapangan)
 */
export async function cancelOrExpireBookingAction(
  bookingId: string,
  newStatus: 'CANCELLED' | 'EXPIRED',
  reason?: string
) {
  await verifySuperAdmin();
  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { items: true },
      });

      if (!booking) {
        throw new UserFacingError("Booking tidak ditemukan.");
      }

      // Update Booking (Status di enum Prisma adalah CANCELLED)
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      // Update Payment jika ada
      await tx.payment.updateMany({
        where: { bookingId },
        data: {
          status: newStatus,
          paymentGatewayRef: reason ? `REASON: ${reason}` : undefined,
        },
      });

      // Bebaskan Slot Lapangan secara proporsional sesuai kapasitas yang dibatalkan (urutan deterministik anti-deadlock)
      const slotsToRelease: { slot: any; item: any }[] = [];
      for (const item of booking.items) {
        const slot = await tx.fieldSlot.findFirst({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
        });
        if (slot) {
          slotsToRelease.push({ slot, item });
        }
      }

      slotsToRelease.sort((a, b) => a.slot.id.localeCompare(b.slot.id));

      for (const { slot, item } of slotsToRelease) {
        const qty = item.quantity || 1;
        const newBooked = Math.max(0, slot.bookedCapacity - qty);
        const isFull = newBooked >= slot.maxCapacity;
        const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (isFull ? 'BOOKED' : 'AVAILABLE');
        await tx.fieldSlot.update({
          where: { id: slot.id },
          data: {
            bookedCapacity: newBooked,
            status: newStatus,
            bookingId: newBooked === 0 ? null : (slot.bookingId === booking.id ? null : slot.bookingId),
            bookedByUserId: newBooked === 0 ? null : (slot.bookedByUserId === booking.userId ? null : slot.bookedByUserId),
          },
        });
      }
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to cancel booking:", error);
    return { success: false, error: toPublicMessage(error, "Gagal membatalkan booking.") };
  }
}

/**
 * 4.1 Tolak Pembayaran Manual dengan Alasan Penolakan
 * ADMIN & SUPERADMIN bisa reject
 */
export async function rejectPaymentWithReasonAction(bookingId: string, reason: string) {
  await verifyAdminOrSuperAdmin();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { items: true },
      });
      if (!booking) throw new UserFacingError("Booking tidak ditemukan.");

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          adminNotes: reason,
        },
      });

      await tx.payment.updateMany({
        where: { bookingId },
        data: {
          status: 'CANCELLED',
          paymentGatewayRef: `REJECTED: ${reason}`,
        },
      });

      // Lepaskan slot lapangan secara proporsional sesuai kapasitas yang ditolak (urutan deterministik anti-deadlock)
      const slotsToRelease: { slot: any; item: any }[] = [];
      for (const item of booking.items) {
        const slot = await tx.fieldSlot.findFirst({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
        });
        if (slot) {
          slotsToRelease.push({ slot, item });
        }
      }

      slotsToRelease.sort((a, b) => a.slot.id.localeCompare(b.slot.id));

      for (const { slot, item } of slotsToRelease) {
        const qty = item.quantity || 1;
        const newBooked = Math.max(0, slot.bookedCapacity - qty);
        const isFull = newBooked >= slot.maxCapacity;
        const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (isFull ? 'BOOKED' : 'AVAILABLE');
        await tx.fieldSlot.update({
          where: { id: slot.id },
          data: {
            bookedCapacity: newBooked,
            status: newStatus,
            bookingId: newBooked === 0 ? null : (slot.bookingId === booking.id ? null : slot.bookingId),
            bookedByUserId: newBooked === 0 ? null : (slot.bookedByUserId === booking.userId ? null : slot.bookedByUserId),
          },
        });
      }
      return updated;
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    return { success: true, booking: result };
  } catch (error: any) {
    console.error("Failed to reject payment:", error);
    return { success: false, error: toPublicMessage(error, "Gagal menolak pembayaran.") };
  }
}

/**
 * 5. Simulasi Webhook Masuk (Memanggil internal logika webhook secara langsung)
 */
export async function simulateWebhookTrigger(
  orderId: string,
  gatewayStatus: 'settlement' | 'expire' | 'cancel'
) {
  await verifySuperAdmin();
  try {
    if (gatewayStatus === 'settlement') {
      return await manualVerifyPayment(orderId, 'SIMULATED-GATEWAY-WEBHOOK-SETTLEMENT');
    } else if (gatewayStatus === 'expire') {
      return await cancelOrExpireBookingAction(orderId, 'EXPIRED', 'Simulated gateway expired');
    } else {
      return await cancelOrExpireBookingAction(orderId, 'CANCELLED', 'Simulated gateway cancelled');
    }
  } catch (error: any) {
    return { success: false, error: toPublicMessage(error, "Gagal memproses permintaan.") };
  }
}

/**
 * 6. Ambil Semua Venue & Lapangan untuk Selector Jadwal Admin
 */
export async function getAdminVenuesWithFields() {
  await verifySuperAdmin();
  try {
    const venues = await prisma.venue.findMany({
      include: {
        fields: {
          include: {
            rates: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
    return venues;
  } catch (error) {
    console.error("Failed to fetch venues for admin schedule:", error);
    return [];
  }
}

/**
 * 7. Ambil Seluruh Slot Jam pada Tanggal & Lapangan Tertentu
 */
export async function getFieldSlotsForDate(fieldId: string, dateStr: string) {
  await verifySuperAdmin();
  try {
    const targetDate = dateFromKey(dateStr);

    // 1. Bersihkan booking PENDING_PAYMENT yang sudah kedaluwarsa (> 10 menit)
    const expiredPending = await prisma.booking.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        expiresAt: { lt: new Date() },
        items: {
          some: {
            fieldId,
            date: targetDate,
          },
        },
      },
      select: { id: true },
    });

    for (const exp of expiredPending) {
      await cancelOrExpireBookingAction(
        exp.id,
        'EXPIRED',
        'Auto-expired: Waktu hold 10 menit habis saat memuat jadwal kasir'
      );
    }

    let slots = await prisma.fieldSlot.findMany({
      where: {
        fieldId,
        date: targetDate,
        hour: { gte: 8, lt: 21 },
      },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            paymentMethod: true,
            nik: true,
            senderName: true,
            adminNotes: true,
            expiresAt: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
        bookingItems: {
          include: {
            booking: {
              select: {
                id: true,
                status: true,
                paymentMethod: true,
                nik: true,
                senderName: true,
                adminNotes: true,
                grandTotal: true,
                createdAt: true,
                expiresAt: true,
                user: {
                  select: {
                    name: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        hour: 'asc',
      },
    });

    // Jika slot untuk tanggal tersebut belum digenerate di DB, buat otomatis 08:00 - 21:00
    if (slots.length === 0) {
      const field = await prisma.venueField.findUnique({
        where: { id: fieldId },
        include: { rates: true },
      });
      if (field) {
        const defaultCap = field.maxCapacity || (field.sportType === 'RENANG' ? 30 : 1);
        const slotsToCreate = [];
        for (let hour = 8; hour < 21; hour++) {
          const isPeak = hour >= 16;
          const { price } = resolveFieldPrice({
            rates: field.rates,
            priceNonPeak: field.priceNonPeak,
            pricePeak: field.pricePeak,
            hour,
            isPeak,
          });
          slotsToCreate.push({
            id: `${field.id}-${dateStr}-${hour}`,
            fieldId: field.id,
            date: targetDate,
            timeStart: `${hour.toString().padStart(2, '0')}:00`,
            timeEnd: `${(hour + 1).toString().padStart(2, '0')}:00`,
            hour: hour,
            price,
            isPeakHour: isPeak,
            maxCapacity: defaultCap,
            bookedCapacity: 0,
            status: 'AVAILABLE' as const,
          });
        }
        await prisma.fieldSlot.createMany({
          data: slotsToCreate,
          skipDuplicates: true,
        });

        slots = await prisma.fieldSlot.findMany({
          where: { fieldId, date: targetDate, hour: { gte: 8, lt: 21 } },
          include: {
            booking: true,
            bookingItems: {
              include: { booking: { include: { user: true } } },
            },
          },
          orderBy: { hour: 'asc' },
        }) as any;
      }
    }

    return (slots as any[]).filter((s) => s.hour >= 8 && s.hour < 21);
  } catch (error) {
    console.error("Failed to fetch slots for date:", error);
    return [];
  }
}

/**
 * 8. Blokir Jadwal Slot (Maintenance / Acara Pemda / Perawatan Lapangan)
 */
export async function blockSlotAction(data: {
  fieldId: string;
  dateStr: string;
  hour: number;
  reason?: string;
}) {
  await verifySuperAdmin();
  try {
    const targetDate = dateFromKey(data.dateStr);

    const slotId = `${data.fieldId}-${data.dateStr}-${data.hour}`;

    const field = await prisma.venueField.findUnique({
      where: { id: data.fieldId },
      include: { rates: true },
    });
    const isPeak = data.hour >= 16;
    const blockedPrice = field
      ? resolveFieldPrice({
          rates: field.rates,
          priceNonPeak: field.priceNonPeak,
          pricePeak: field.pricePeak,
          hour: data.hour,
          isPeak,
        }).price
      : 0;

    const defaultCap = field?.maxCapacity || (field?.sportType === 'RENANG' ? 30 : 1);

    const slot = await prisma.fieldSlot.upsert({
      where: {
        fieldId_date_hour: {
          fieldId: data.fieldId,
          date: targetDate,
          hour: data.hour,
        },
      },
      update: {
        status: 'MAINTENANCE',
        bookedByUserId: `BLOCKED: ${data.reason || 'Maintenance / Acara Dinas'}`,
      },
      create: {
        id: slotId,
        fieldId: data.fieldId,
        date: targetDate,
        hour: data.hour,
        timeStart: `${data.hour.toString().padStart(2, '0')}:00`,
        timeEnd: `${(data.hour + 1).toString().padStart(2, '0')}:00`,
        price: blockedPrice,
        isPeakHour: isPeak,
        maxCapacity: defaultCap,
        bookedCapacity: 0,
        status: 'MAINTENANCE',
        bookedByUserId: `BLOCKED: ${data.reason || 'Maintenance / Acara Dinas'}`,
      },
    });

    revalidatePath('/');
    return { success: true, slot };
  } catch (error: any) {
    console.error("Failed to block slot:", error);
    return { success: false, error: toPublicMessage(error, "Gagal memblokir jadwal slot.") };
  }
}

/**
 * 9. Booking Langsung / On The Spot (Kasir Walk-in) oleh Admin
 */
export async function directWalkInBookingAction(data: {
  fieldId: string;
  venueId: string;
  dateStr: string;
  hour: number;
  customerName: string;
  customerPhone?: string;
  nik?: string;
  paymentMethod: string;
  price?: number;
  swimmerCount?: number;
  userCategory?: UserCategory | null;
  notes?: string;
}) {
  await verifySuperAdmin();
  try {
    const targetDate = dateFromKey(data.dateStr);

    const field = await prisma.venueField.findUnique({
      where: { id: data.fieldId },
      include: { venue: true, rates: true },
    });

    if (!field) throw new UserFacingError("Lapangan tidak ditemukan.");

    const resolved = resolveFieldPrice({
      rates: field.rates,
      priceNonPeak: field.priceNonPeak,
      pricePeak: field.pricePeak,
      category: data.userCategory,
      hour: data.hour,
    });

    const isPool = field.sportType === 'RENANG';
    const quantity = isPool ? Math.max(1, data.swimmerCount || 1) : 1;

    // Hitung total harga: jika admin isi manual price > 0, gunakan itu, jika tidak gunakan tarif x quantity
    const pricePerUnit = resolved.price;
    const finalPrice = data.price && data.price > 0 
      ? data.price 
      : isPool && data.userCategory !== 'PERTANDINGAN'
      ? pricePerUnit * quantity
      : pricePerUnit;

    const bookingId = `WALKIN-${Date.now()}`;
    const timeStart = `${data.hour.toString().padStart(2, '0')}:00`;
    const timeEnd = `${(data.hour + 1).toString().padStart(2, '0')}:00`;
    const slotId = `${field.id}-${data.dateStr}-${data.hour}`;

    // Jalankan dalam transaksi aman anti overbooking
    const result = await prisma.$transaction(async (tx) => {
      // 1. Dapatkan atau buat dummy user pemesan walk-in jika belum ada user ID
      let user = await tx.user.findFirst({ where: { email: 'walkin@sportbekasi.id' } });
      if (!user) {
        user = await tx.user.create({
          data: {
            id: 'walkin-guest',
            name: 'Tamu Booking Langsung (Walk-in)',
            email: 'walkin@sportbekasi.id',
            phone: '0800000000',
            role: 'USER',
          },
        });
      }

      // 2. Cek baris slot terkini di database
      let slot = await tx.fieldSlot.findUnique({
        where: {
          fieldId_date_hour: {
            fieldId: data.fieldId,
            date: targetDate,
            hour: data.hour,
          },
        },
        include: {
          booking: {
            select: {
              id: true,
              status: true,
              expiresAt: true,
              senderName: true,
              userId: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      });

      const maxCap = slot?.maxCapacity || field.maxCapacity || (isPool ? 30 : 1);

      if (slot && slot.status === 'MAINTENANCE') {
        throw new UserFacingError(`Slot jam ${timeStart} sedang diblokir/maintenance.`);
      }

      // 3. Cek Penguncian Online (Pre-Hold QRIS 10 Menit)
      const now = new Date();
      const pendingItems = await tx.bookingItem.findMany({
        where: {
          fieldId: data.fieldId,
          date: targetDate,
          timeStart,
          booking: {
            status: 'PENDING_PAYMENT',
          },
        },
        include: {
          booking: {
            select: {
              id: true,
              status: true,
              expiresAt: true,
              senderName: true,
              userId: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      });

      if (
        slot?.booking &&
        slot.booking.status === 'PENDING_PAYMENT' &&
        !pendingItems.some((pi) => pi.booking.id === slot?.booking?.id)
      ) {
        pendingItems.push({
          id: 'slot-booking-ref',
          bookingId: slot.booking.id,
          fieldId: data.fieldId,
          slotId: slot.id,
          quantity: slot.bookedCapacity || 1,
          date: targetDate,
          timeStart,
          timeEnd,
          price: slot.price,
          isPeakHour: slot.isPeakHour,
          createdAt: new Date(),
          booking: slot.booking,
        } as any);
      }

      // Bersihkan booking pending yang sudah kedaluwarsa (> 10 menit)
      let currentBooked = slot?.bookedCapacity || 0;
      const activePendingItems = [];

      for (const item of pendingItems) {
        if (item.booking.expiresAt <= now) {
          await tx.booking.update({
            where: { id: item.booking.id },
            data: {
              status: 'CANCELLED',
              adminNotes: 'Kedaluwarsa otomatis (10 Menit) - Slot dibebaskan saat transaksi kasir offline walk-in.',
            },
          });
          if (slot) {
            const deductQty = item.quantity || 1;
            currentBooked = Math.max(0, currentBooked - deductQty);
            const isStillFull = currentBooked >= maxCap;
            await tx.fieldSlot.update({
              where: { id: slot.id },
              data: {
                bookedCapacity: currentBooked,
                status: isStillFull ? 'BOOKED' : 'AVAILABLE',
                bookingId: currentBooked === 0 ? null : (slot.bookingId === item.booking.id ? null : slot.bookingId),
                bookedByUserId: currentBooked === 0 ? null : (slot.bookedByUserId === item.booking.userId ? null : slot.bookedByUserId),
              },
            });
          }
        } else {
          activePendingItems.push(item);
        }
      }

      // Tolak transaksi jika ada warga online yang sedang memindai QRIS (< 10 menit)
      if (!isPool) {
        if (activePendingItems.length > 0) {
          const hold = activePendingItems[0];
          const remainingMs = Math.max(0, hold.booking.expiresAt.getTime() - Date.now());
          const remainingSec = Math.ceil(remainingMs / 1000);
          const remainingMin = Math.ceil(remainingSec / 60);
          const timeStr = remainingSec < 60 ? `${remainingSec} detik` : `${remainingMin} menit`;
          const holderName = hold.booking.senderName || hold.booking.user?.name || 'Warga';
          throw new UserFacingError(
            `Slot jam ${timeStart} sedang di-lock oleh pemesan online (${holderName}) yang sedang memindai QRIS (sisa waktu tunggu: ${timeStr}). Transaksi kasir walk-in ditolak untuk mencegah bentrok jadwal di lapangan.`
          );
        }

        if (currentBooked >= maxCap) {
          throw new UserFacingError(`Slot jam ${timeStart} sudah dipesan dan lunas oleh penyewa lain.`);
        }
      } else {
        const newBooked = currentBooked + quantity;
        if (newBooked > maxCap) {
          const sisa = Math.max(0, maxCap - currentBooked);
          if (activePendingItems.length > 0) {
            const onlinePendingQty = activePendingItems.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
            const latestExpiry = Math.max(...activePendingItems.map((p) => p.booking.expiresAt.getTime()));
            const remainingMs = Math.max(0, latestExpiry - Date.now());
            const remainingSec = Math.ceil(remainingMs / 1000);
            const remainingMin = Math.ceil(remainingSec / 60);
            const timeStr = remainingSec < 60 ? `${remainingSec} detik` : `${remainingMin} menit`;
            throw new UserFacingError(
              `Slot jam ${timeStart} hanya tersisa ${sisa} kuota orang (sebanyak ${onlinePendingQty} kuota sedang di-lock online oleh warga selama ${timeStr} ke depan). Anda meminta ${quantity} orang.`
            );
          } else {
            throw new UserFacingError(
              `Slot jam ${timeStart} hanya tersisa ${sisa} kuota orang (sudah lunas terisi). Anda meminta ${quantity} orang.`
            );
          }
        }
      }

      // 4. Pastikan baris slot ada di database jika belum digenerate sebelumnya
      const finalSlotId = slot ? slot.id : slotId;
      if (!slot) {
        try {
          await tx.fieldSlot.create({
            data: {
              id: slotId,
              fieldId: field.id,
              date: targetDate,
              hour: data.hour,
              timeStart,
              timeEnd,
              price: finalPrice,
              isPeakHour: data.hour >= 16,
              maxCapacity: maxCap,
              bookedCapacity: 0,
              status: 'AVAILABLE',
            },
          });
        } catch (createErr: any) {
          if (createErr?.code !== 'P2002') {
            throw createErr;
          }
        }
      }

      // 5. Buat Booking Lunas Langsung (Walk-in)
      const newBooking = await tx.booking.create({
        data: {
          id: bookingId,
          userId: user.id,
          venueId: data.venueId,
          sportCategory: field.sportType,
          status: 'PAID_SUCCESS',
          paymentMethod: data.paymentMethod || 'TUNAI_CASH',
          totalPrice: finalPrice,
          serviceFee: 0,
          grandTotal: finalPrice,
          qrCodeToken: `QR-${bookingId}`,
          expiresAt: new Date(Date.now() + 24 * 3600000),
          nik: data.nik || null,
          senderName: data.customerName,
          adminNotes: `WALK-IN: ${data.customerName} (${data.customerPhone || '-'}) • ${isPool ? `${quantity} Orang • ` : ''}${data.notes || 'Bayar Tunai di Tempat'}`,
          items: {
            create: [
              {
                fieldId: field.id,
                slotId: finalSlotId,
                quantity: quantity,
                date: targetDate,
                timeStart,
                timeEnd,
                price: finalPrice,
                isPeakHour: data.hour >= 16,
              },
            ],
          },
          payment: {
            create: {
              amount: finalPrice,
              paymentMethod: data.paymentMethod || 'TUNAI_CASH',
              status: 'PAID',
              paidAt: new Date(),
              paymentGatewayRef: `KASIR-OFFLINE-${Date.now()}`,
            },
          },
        },
      });

      // 6. Update Slot Kuota & Status Secara Atomik (Conditional Atomic Update)
      const nextBooked = currentBooked + quantity;
      const isFull = nextBooked >= maxCap;

      const updateResult = await tx.fieldSlot.updateMany({
        where: {
          id: finalSlotId,
          bookedCapacity: { lte: maxCap - quantity },
          status: { not: 'MAINTENANCE' },
        },
        data: {
          bookedCapacity: nextBooked,
          status: isFull ? 'BOOKED' : 'AVAILABLE',
          bookingId: slot?.bookingId ? slot.bookingId : newBooking.id,
          bookedByUserId: slot?.bookedByUserId ? slot.bookedByUserId : user.id,
        },
      });

      if (updateResult.count === 0) {
        throw new UserFacingError(
          `Slot jam ${timeStart} baru saja terisi atau di-lock oleh pemesan lain di saat bersamaan. Transaksi walk-in dibatalkan untuk menghindari jadwal ganda.`
        );
      }

      return newBooking;
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    return { success: true, booking: result };
  } catch (error: any) {
    console.error("Failed to create direct walk-in booking:", error);
    return { success: false, error: toPublicMessage(error, "Gagal membuat booking langsung.") };
  }
}

/**
 * 10. Buka Kunci / Batalkan Blokir Slot (Jadikan AVAILABLE Kembali)
 */
export async function unblockOrReleaseSlotAction(data: {
  fieldId: string;
  dateStr: string;
  hour: number;
}) {
  await verifySuperAdmin();
  try {
    const targetDate = dateFromKey(data.dateStr);

    const slot = await prisma.fieldSlot.findUnique({
      where: {
        fieldId_date_hour: {
          fieldId: data.fieldId,
          date: targetDate,
          hour: data.hour,
        },
      },
    });

    if (!slot) throw new UserFacingError("Slot tidak ditemukan.");

    await prisma.$transaction(async (tx) => {
      // Jika terhubung ke booking walk-in, batalkan bookingnya
      if (slot.bookingId && slot.bookingId.startsWith('WALKIN-')) {
        await tx.booking.update({
          where: { id: slot.bookingId },
          data: { status: 'CANCELLED', adminNotes: 'Dibatalkan oleh Admin (Slot dibuka kembali)' },
        });
      }

      // Reset slot kembali menjadi AVAILABLE dengan bookedCapacity = 0
      await tx.fieldSlot.update({
        where: { id: slot.id },
        data: {
          status: 'AVAILABLE',
          bookedCapacity: 0,
          bookingId: null,
          bookedByUserId: null,
        },
      });
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to unblock slot:", error);
    return { success: false, error: toPublicMessage(error, "Gagal membuka kunci slot.") };
  }
}

/**
 * 11. Batalkan Booking Tertentu pada Slot (Admin Kasir / Operasional)
 */
export async function cancelSpecificBookingInSlot(bookingId: string, slotId: string) {
  await verifySuperAdmin();
  try {
    await prisma.$transaction(async (tx) => {
      const bookingItem = await tx.bookingItem.findFirst({
        where: { bookingId, slotId },
      });

      const qtyToRelease = bookingItem?.quantity || 1;

      // Update status booking menjadi CANCELLED
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          adminNotes: 'Dibatalkan oleh Admin Kasir / Operasional Lapangan',
        },
      });

      // Kembalikan kuota pada slot
      const slot = await tx.fieldSlot.findUnique({
        where: { id: slotId },
      });

      if (slot) {
        const newBooked = Math.max(0, slot.bookedCapacity - qtyToRelease);
        const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE';
        await tx.fieldSlot.update({
          where: { id: slotId },
          data: {
            bookedCapacity: newBooked,
            status: newStatus,
            bookingId: newBooked === 0 ? null : slot.bookingId,
          },
        });
      }
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to cancel specific booking in slot:", error);
    return { success: false, error: toPublicMessage(error, "Gagal membatalkan pesanan.") };
  }
}

/**
 * 12. CRUD SUPERADMIN: Buat Pesanan Baru Secara Manual
 */
export interface CreateSuperAdminBookingInput {
  venueId: string;
  fieldId: string;
  dateStr: string; // "YYYY-MM-DD"
  hour: number;
  timeStart: string; // "08:00"
  timeEnd: string; // "09:00"
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  nik?: string;
  npwp?: string;
  totalAmount: number;
  paymentMethod: string;
  status: BookingStatus;
  adminNotes?: string;
}

export async function createSuperAdminBookingAction(input: CreateSuperAdminBookingInput) {
  await verifySuperAdmin();
  try {
    const targetDate = dateFromKey(input.dateStr);

    const venue = await prisma.venue.findUnique({
      where: { id: input.venueId },
    });
    if (!venue) throw new UserFacingError('Venue tidak ditemukan.');

    const field = await prisma.venueField.findUnique({
      where: { id: input.fieldId },
    });
    if (!field) throw new UserFacingError('Lapangan tidak ditemukan.');

    const cleanEmail = (input.customerEmail || '').trim().toLowerCase();
    const cleanPhone = (input.customerPhone || '').trim();
    const cleanName = (input.customerName || 'Customer Superadmin').trim();

    // Dapatkan atau buat User untuk booking ini
    let user = null;
    if (cleanEmail) {
      user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    }
    if (!user && cleanPhone) {
      user = await prisma.user.findFirst({ where: { phone: cleanPhone } });
    }
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: cleanName,
          email: cleanEmail || `manual-${Date.now()}@disbudporasport.id`,
          phone: cleanPhone || null,
          role: 'USER',
        },
      });
    }

    // Gunakan CSPRNG (crypto.randomInt) sesuai standar CWE-338 / SonarQube typescript:S2245
    const randomSuffix = crypto.randomInt(100, 1000);
    const bookingId = `GLR-ADM-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    const isPool = field.sportType === 'RENANG';
    const quantity = 1;
    const finalPrice = Math.max(0, input.totalAmount);

    const booking = await prisma.$transaction(async (tx) => {
      // 1. Cek / siapkan slot
      const slot = await tx.fieldSlot.findUnique({
        where: {
          fieldId_date_hour: {
            fieldId: field.id,
            date: targetDate,
            hour: input.hour,
          },
        },
      });

      const maxCap = slot?.maxCapacity || field.maxCapacity || (isPool ? 30 : 1);
      const currentBooked = slot?.bookedCapacity || 0;
      const newBooked = currentBooked + quantity;
      const isFull = newBooked >= maxCap;

      const slotId = slot?.id || `slot-${crypto.randomUUID()}`;

      // 2. Buat Booking
      const newBooking = await tx.booking.create({
        data: {
          id: bookingId,
          userId: user.id,
          venueId: venue.id,
          sportCategory: field.sportType,
          status: input.status,
          paymentMethod: input.paymentMethod || 'TUNAI_CASH',
          totalPrice: finalPrice,
          serviceFee: 0,
          grandTotal: finalPrice,
          qrCodeToken: `QR-${bookingId}`,
          expiresAt: new Date(Date.now() + 24 * 3600000),
          nik: input.nik ? input.nik.trim() : null,
          npwp: input.npwp ? input.npwp.trim() : null,
          senderName: cleanName,
          senderPhone: cleanPhone || null,
          adminNotes: input.adminNotes ? `[SUPERADMIN] ${input.adminNotes}` : '[SUPERADMIN] Dibuat Manual oleh Superadmin',
          items: {
            create: [
              {
                fieldId: field.id,
                slotId: slotId,
                quantity: quantity,
                date: targetDate,
                timeStart: input.timeStart,
                timeEnd: input.timeEnd,
                price: finalPrice,
                isPeakHour: input.hour >= 16,
              },
            ],
          },
          ...(input.status === 'PAID_SUCCESS' ? {
            payment: {
              create: {
                amount: finalPrice,
                paymentMethod: input.paymentMethod || 'TUNAI_CASH',
                status: 'PAID',
                paidAt: new Date(),
                paymentGatewayRef: `SUPERADMIN-MANUAL-${Date.now()}`,
              },
            },
          } : {}),
        },
      });

      // 3. Update Slot
      await tx.fieldSlot.upsert({
        where: {
          fieldId_date_hour: {
            fieldId: field.id,
            date: targetDate,
            hour: input.hour,
          },
        },
        update: {
          bookedCapacity: newBooked,
          status: isFull ? 'BOOKED' : 'AVAILABLE',
          bookingId: slot?.bookingId ? slot.bookingId : newBooking.id,
          bookedByUserId: slot?.bookedByUserId ? slot.bookedByUserId : user.id,
        },
        create: {
          id: slotId,
          fieldId: field.id,
          date: targetDate,
          hour: input.hour,
          timeStart: input.timeStart,
          timeEnd: input.timeEnd,
          price: finalPrice,
          isPeakHour: input.hour >= 16,
          maxCapacity: maxCap,
          bookedCapacity: newBooked,
          status: isFull ? 'BOOKED' : 'AVAILABLE',
          bookingId: newBooking.id,
          bookedByUserId: user.id,
        },
      });

      return newBooking;
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    revalidatePath('/admin/bookings');
    return { success: true, booking };
  } catch (error: any) {
    console.error('Failed to create superadmin booking:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal membuat pesanan manual.') };
  }
}

/**
 * 13. CRUD SUPERADMIN: Perbarui Detail / Status Pesanan
 */
export interface UpdateSuperAdminBookingInput {
  bookingId: string;
  senderName?: string;
  senderPhone?: string;
  nik?: string;
  npwp?: string;
  totalPrice?: number;
  status?: BookingStatus;
  paymentMethod?: string;
  adminNotes?: string;
}

export async function updateSuperAdminBookingAction(input: UpdateSuperAdminBookingInput) {
  await verifySuperAdmin();
  try {
    const existing = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: { items: true, payment: true },
    });

    if (!existing) {
      throw new UserFacingError('Pesanan tidak ditemukan.');
    }

    await prisma.$transaction(async (tx) => {
      const willBePaid = input.status === 'PAID_SUCCESS';
      const willBeCancelled = input.status === 'CANCELLED';

      // 1. Update Booking
      await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          ...(input.senderName ? { senderName: input.senderName.trim() } : {}),
          ...(input.senderPhone !== undefined ? { senderPhone: input.senderPhone.trim() || null } : {}),
          ...(input.nik !== undefined ? { nik: input.nik.trim() || null } : {}),
          ...(input.npwp !== undefined ? { npwp: input.npwp.trim() || null } : {}),
          ...(input.totalPrice !== undefined ? { totalPrice: input.totalPrice, grandTotal: input.totalPrice } : {}),
          ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
        },
      });

      // 2. Jika status diubah menjadi LUNAS (PAID_SUCCESS)
      if (willBePaid) {
        await tx.payment.upsert({
          where: { bookingId: input.bookingId },
          update: {
            status: 'PAID',
            paidAt: new Date(),
            paymentGatewayRef: 'SUPERADMIN-STATUS-UPDATE',
          },
          create: {
            bookingId: input.bookingId,
            amount: input.totalPrice || existing.grandTotal,
            paymentMethod: input.paymentMethod || existing.paymentMethod,
            status: 'PAID',
            paidAt: new Date(),
            paymentGatewayRef: 'SUPERADMIN-STATUS-UPDATE',
          },
        });

        for (const item of existing.items) {
          const slot = await tx.fieldSlot.findFirst({
            where: {
              fieldId: item.fieldId,
              date: item.date,
              timeStart: item.timeStart,
            },
          });

          if (slot) {
            const isFull = slot.bookedCapacity >= slot.maxCapacity;
            const newStatus = slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : (isFull ? 'BOOKED' : 'AVAILABLE');
            await tx.fieldSlot.update({
              where: { id: slot.id },
              data: {
                status: newStatus,
                bookingId: slot.bookingId ? slot.bookingId : existing.id,
                bookedByUserId: slot.bookedByUserId ? slot.bookedByUserId : existing.userId,
              },
            });
          }
        }
      }

      // 3. Jika status diubah menjadi DIBATALKAN (CANCELLED), lepaskan kuota slot
      if (willBeCancelled && existing.status !== 'CANCELLED') {
        for (const item of existing.items) {
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
      }
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath('/');
    revalidatePath('/admin/bookings');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update booking:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal memperbarui pesanan.') };
  }
}

/**
 * 14. CRUD SUPERADMIN: Hapus Pesanan Permanen (Delete Booking)
 * Menghapus pesanan, melepas kuota slot, dan membersihkan berkas fisik bukti QRIS dari penyimpanan
 */
export async function deleteSuperAdminBookingAction(bookingId: string) {
  await verifySuperAdmin();
  try {
    // 1. Ambil data pesanan beserta referensi file bukti sebelum record dihapus
    const existingBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: true,
        paymentProof: true,
      },
    });

    if (!existingBooking) {
      throw new UserFacingError('Pesanan tidak ditemukan.');
    }

    const proofPaths: (string | null | undefined)[] = [
      existingBooking.paymentProofUrl,
      existingBooking.paymentProof?.fileUrl,
    ];

    // 2. Transaksi penghapusan atomik pada database
    await prisma.$transaction(async (tx) => {
      // Lepas kuota pada slot yang terhubung
      for (const item of existingBooking.items) {
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

      // Hapus PaymentProof, Payment, BookingItem, Booking
      await tx.paymentProof.deleteMany({ where: { bookingId } });
      await tx.payment.deleteMany({ where: { bookingId } });
      await tx.bookingItem.deleteMany({ where: { bookingId } });
      await tx.booking.delete({ where: { id: bookingId } });
    }, { maxWait: 10000, timeout: 20000 });

    // 3. Bersihkan seluruh file fisik bukti transfer/QRIS dari folder penyimpanan Supabase & server
    try {
      const cleanupResult = await deleteBookingProofFiles(bookingId, proofPaths);
      console.log(`[Storage Cleanup] Berkas bukti bayar untuk pesanan ${bookingId} berhasil dibersihkan (${cleanupResult.deletedCount} file).`);
    } catch (cleanErr: any) {
      console.warn(`[Storage Cleanup Warning] Kendala saat membersihkan file bukti untuk ${bookingId}:`, cleanErr?.message);
    }

    revalidatePath('/');
    revalidatePath('/admin/bookings');
    return {
      success: true,
      message: 'Pesanan, alokasi slot, dan file fisik bukti pembayaran berhasil dibersihkan permanen.',
    };
  } catch (error: any) {
    console.error('Failed to delete booking:', error);
    return { success: false, error: toPublicMessage(error, 'Gagal menghapus pesanan.') };
  }
}
