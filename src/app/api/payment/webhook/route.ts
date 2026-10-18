import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../../lib/prisma';

/**
 * Payment Gateway Webhook Handler (Midtrans / Xendit / Standard QRIS)
 * Endpoint: POST /api/payment/webhook
 *
 * WAJIB tervalidasi tanda tangan. Tanpa itu, siapa pun yang bisa menjangkau
 * endpoint ini dapat menandai booking apa pun menjadi LUNAS tanpa transfer,
 * karena cukup mengirim body JSON sederhana.
 *
 * Set PAYMENT_WEBHOOK_SECRET di environment. Quandari, body HMAC seperti
 * `sha256=<hex>` dihitung dari body mentah (raw body, bukan hasil parse).
 */
function isValidSignature(rawBody: string, provided: string | null): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !secret.trim()) {
    console.error(
      '[PAYMENT WEBHOOK] PAYMENT_WEBHOOK_SECRET belum diset. Webhook ditolak.'
    );
    return false;
  }
  if (!provided) return false;

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    // Baca body sebagai teks dulu: tanda tangan harus dihitung atas body mentah.
    const rawBody = await req.text();
    const providedSignature =
      req.headers.get('x-webhook-signature') ??
      req.headers.get('x-callback-token') ??
      null;

    if (!isValidSignature(rawBody, providedSignature)) {
      console.warn('[PAYMENT WEBHOOK] Tanda tangan tidak valid, permintaan ditolak.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
    }

    // Jangan log seluruh payload: isinya memuat data identitas pengirim.
    const orderId = (body.order_id || body.external_id || body.bookingId) as string | undefined;
    const rawStatus = String(body.transaction_status || body.status || '').toLowerCase();
    const paymentType = String(body.payment_type || body.payment_method || 'QRIS');
    const transactionId = String(body.transaction_id || body.id || `TX-${Date.now()}`);

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing order_id or external_id' },
        { status: 400 }
      );
    }

    // Cari booking terkait di database
    const booking = await prisma.booking.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!booking) {
      console.warn(`[PAYMENT WEBHOOK] Booking ${orderId} not found in DB.`);
      return NextResponse.json(
        { error: `Booking ${orderId} not found` },
        { status: 404 }
      );
    }

    // Nominal dari gateway TIDAK pernah ditulis ke tabel pembayaran. Bandingkan
    // saja sebagai penanda, lalu tetap pakai nilai tagihan di database.
    const reportedAmount = Number(body.gross_amount || body.amount || '0');
    if (reportedAmount > 0 && Math.abs(reportedAmount - booking.grandTotal) > 1) {
      console.warn(
        `[PAYMENT WEBHOOK] Nominal gateway tidak cocok dengan tagihan untuk ${orderId}, diproses memakai nilai database.`
      );
    }

    // 1. Kondisi Lunas (PAID / SETTLEMENT / CAPTURE)
    if (
      rawStatus === 'settlement' ||
      rawStatus === 'capture' ||
      rawStatus === 'paid' ||
      rawStatus === 'success'
    ) {
      await prisma.$transaction(async (tx) => {
        // Update booking status
        await tx.booking.update({
          where: { id: orderId },
          data: { status: 'PAID_SUCCESS' },
        });

        // Upsert record Payment
        await tx.payment.upsert({
          where: { bookingId: orderId },
          update: {
            status: 'PAID',
            paidAt: new Date(),
            paymentGatewayRef: transactionId,
            paymentMethod: paymentType.toUpperCase(),
          },
          create: {
            bookingId: orderId,
            // Nominal SELALU dari database. Nilai di body gateway hanya dicatat
            // di syslog, tidak pernah ditulis ke tabel pembayaran.
            amount: booking.grandTotal,
            paymentMethod: paymentType.toUpperCase(),
            status: 'PAID',
            paidAt: new Date(),
            paymentGatewayRef: transactionId,
          },
        });

        // Kunci slot lapangan menjadi BOOKED
        if (booking.items && booking.items.length > 0) {
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
        }
      }, { maxWait: 10000, timeout: 20000 });

      console.log(`[PAYMENT WEBHOOK] Successfully verified PAID for booking ${orderId}`);
      return NextResponse.json({
        success: true,
        message: 'Payment verified and booking confirmed',
        order_id: orderId,
        status: 'PAID_SUCCESS',
      });
    }

    // 2. Kondisi Kadaluwarsa / Dibatalkan (EXPIRE / CANCEL / DENY)
    if (
      rawStatus === 'expire' ||
      rawStatus === 'expired' ||
      rawStatus === 'cancel' ||
      rawStatus === 'cancelled' ||
      rawStatus === 'deny'
    ) {
      const targetBookingStatus = rawStatus.includes('expire') ? 'EXPIRED' : 'CANCELLED';

      await prisma.$transaction(async (tx) => {
        // Update status booking (enum Prisma adalah CANCELLED)
        await tx.booking.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' },
        });

        // Update payment record
        await tx.payment.upsert({
          where: { bookingId: orderId },
          update: {
            status: targetBookingStatus,
            paymentGatewayRef: transactionId,
          },
          create: {
            bookingId: orderId,
            amount: booking.grandTotal,
            paymentMethod: paymentType.toUpperCase(),
            status: targetBookingStatus,
            paymentGatewayRef: transactionId,
          },
        });

        if (booking.items && booking.items.length > 0) {
          for (const item of booking.items) {
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
              await tx.fieldSlot.update({
                where: { id: slot.id },
                data: {
                  bookedCapacity: newBooked,
                  status: slot.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE',
                  bookingId: newBooked === 0 ? null : slot.bookingId,
                  bookedByUserId: newBooked === 0 ? null : slot.bookedByUserId,
                },
              });
            }
          }
        }
      }, { maxWait: 10000, timeout: 20000 });

      console.log(`[PAYMENT WEBHOOK] Booking ${orderId} released as ${targetBookingStatus}`);
      return NextResponse.json({
        success: true,
        message: `Booking updated to ${targetBookingStatus} and slots released`,
        order_id: orderId,
        status: targetBookingStatus,
      });
    }

    // 3. Status PENDING (Menunggu Pembayaran)
    return NextResponse.json({
      success: true,
      message: 'Pending webhook acknowledged',
      order_id: orderId,
      status: 'PENDING_PAYMENT',
    });
  } catch (error: any) {
    console.error('[PAYMENT WEBHOOK ERROR]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error processing webhook', details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * Health-check Endpoint
 * GET /api/payment/webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'Sport Bekasi Payment Gateway Webhook Handler',
    supportedGateways: ['Midtrans', 'Xendit', 'Standard QRIS / Direct Callback'],
    timestamp: new Date().toISOString(),
  });
}
