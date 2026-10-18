"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { BookingStatus, SportCategory, UserCategory } from '@prisma/client';
import { resolveFieldPrice } from '../lib/pricing';
import { todayKey, dateFromKey } from '../lib/dateKeys';
import { toPublicMessage, UserFacingError } from '../lib/userFacingError';
import { getSignedProofUrl } from '../lib/storage';
import { getCurrentAdminAction } from './authActions';

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
      const isPaid = b.status === 'PAID_SUCCESS';
      const isPending = b.status === 'PENDING_PAYMENT';
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
      whereClause.status = filters.status as BookingStatus;
    }

    if (filters?.paymentMethod && filters.paymentMethod !== 'ALL') {
      whereClause.paymentMethod = filters.paymentMethod;
    }

    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.trim();
      whereClause.OR = [
        { id: { contains: q, mode: 'insensitive' } },
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

      // 4. Pastikan status FieldSlot menjadi BOOKED
      for (const item of booking.items) {
        await tx.fieldSlot.updateMany({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
          data: {
            status: 'BOOKED',
            bookingId: booking.id,
            bookedByUserId: booking.userId,
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

      // Bebaskan Slot Lapangan agar bisa dipesan kembali
      for (const item of booking.items) {
        await tx.fieldSlot.updateMany({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
          data: {
            status: 'AVAILABLE',
            bookingId: null,
            bookedByUserId: null,
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

      // Lepaskan slot lapangan agar bisa dipesan kembali
      for (const item of booking.items) {
        await tx.fieldSlot.updateMany({
          where: {
            fieldId: item.fieldId,
            date: item.date,
            timeStart: item.timeStart,
          },
          data: {
            status: 'AVAILABLE',
            bookingId: null,
            bookedByUserId: null,
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

    let slots = await prisma.fieldSlot.findMany({
      where: {
        fieldId,
        date: targetDate,
        hour: { gte: 8, lt: 20 },
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

    // Jika slot untuk tanggal tersebut belum digenerate di DB, buat otomatis 08:00 - 20:00
    if (slots.length === 0) {
      const field = await prisma.venueField.findUnique({
        where: { id: fieldId },
        include: { rates: true },
      });
      if (field) {
        const defaultCap = field.maxCapacity || (field.sportType === 'RENANG' ? 30 : 1);
        const slotsToCreate = [];
        for (let hour = 8; hour < 20; hour++) {
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
          where: { fieldId, date: targetDate, hour: { gte: 8, lt: 20 } },
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

    return (slots as any[]).filter((s) => s.hour >= 8 && s.hour < 20);
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

      // 2. Cek kuota slot terkini
      let slot = await tx.fieldSlot.findUnique({
        where: {
          fieldId_date_hour: {
            fieldId: data.fieldId,
            date: targetDate,
            hour: data.hour,
          },
        },
      });

      const maxCap = slot?.maxCapacity || field.maxCapacity || (isPool ? 30 : 1);
      const currentBooked = slot?.bookedCapacity || 0;
      const newBooked = currentBooked + quantity;

      if (slot && slot.status === 'MAINTENANCE') {
        throw new UserFacingError(`Slot jam ${timeStart} sedang diblokir/maintenance.`);
      }

      if (newBooked > maxCap) {
        const sisa = Math.max(0, maxCap - currentBooked);
        throw new UserFacingError(`Slot jam ${timeStart} hanya tersisa ${sisa} kuota orang, Anda meminta ${quantity} orang.`);
      }

      // 3. Buat Booking Lunas Langsung
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
                slotId: slot ? slot.id : slotId,
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

      // 4. Update slot kuota dan status
      const isFull = newBooked >= maxCap;

      await tx.fieldSlot.upsert({
        where: {
          fieldId_date_hour: {
            fieldId: data.fieldId,
            date: targetDate,
            hour: data.hour,
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
          hour: data.hour,
          timeStart,
          timeEnd,
          price: finalPrice,
          isPeakHour: data.hour >= 16,
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
