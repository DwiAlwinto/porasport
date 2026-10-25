import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cancelOrExpireBookingAction } from '@/actions/adminActions'
import { purgeExpiredRevocations } from '@/lib/revocation'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET not configured')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[CRON] Unauthorized access attempt')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Toleransi (grace period) 60 detik: melindungi berkas bukti transfer yang
    // sedang dalam proses pengiriman via jaringan agar tidak dibatalkan sepihak.
    const gracePeriodThreshold = new Date(Date.now() - 60 * 1000);
    // Batas waktu toleransi verifikasi manual admin (SLA 2 jam): mencegah struk bodong
    // menyandera kuota lapangan tanpa batas waktu (Poin 6).
    const validationSlaThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const expiredBookings = await prisma.booking.findMany({
      where: {
        OR: [
          {
            status: 'PENDING_PAYMENT',
            expiresAt: { lt: gracePeriodThreshold },
          },
          {
            status: 'MENUNGGU_VALIDASI',
            updatedAt: { lt: validationSlaThreshold },
          },
        ],
      },
      include: { items: true },
    })

    if (expiredBookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired bookings found',
        processed: 0,
        results: [],
      })
    }

    const results = []
    for (const booking of expiredBookings) {
      try {
        const isValidationTimeout = booking.status === 'MENUNGGU_VALIDASI';
        const cancelReason = isValidationTimeout
          ? 'SLA MENUNGGU_VALIDASI Expired - Dibatalkan otomatis oleh cron karena melebihi batas waktu 2 jam'
          : 'SLA Expired - Auto cancelled by cron (no payment proof uploaded)';

        const result = await cancelOrExpireBookingAction(
          booking.id,
          'EXPIRED',
          cancelReason
        )
        results.push({
          bookingId: booking.id,
          success: result.success,
          error: result.error,
        })
      } catch (error: any) {
        console.error(`[CRON] Failed to cancel booking ${booking.id}:`, error)
        results.push({
          bookingId: booking.id,
          success: false,
          error: error?.message || 'Unknown error',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`[CRON] Processed ${expiredBookings.length} expired bookings: ${successCount} success, ${failCount} failed`)

    // Sekalian bersihkan catatan pencabutan sesi yang sudah lewat masa
    // berlakunya, supaya tabel `revoked_sessions` tidak tumbuh tanpa batas.
    const purgedRevocations = await purgeExpiredRevocations()

    return NextResponse.json({
      success: true,
      message: `Processed ${expiredBookings.length} expired bookings`,
      processed: expiredBookings.length,
      successCount,
      failCount,
      purgedRevocations,
      results,
    })
  } catch (error: unknown) {
    console.error('[CRON] Error processing expired bookings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}