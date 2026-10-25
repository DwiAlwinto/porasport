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
    userCategory?: string;
    userCategoryLabel?: string;
    requiresIdVerification?: boolean;
    verificationInstruction?: string;
    date: string;
    timeSlots: string;
    quantity: number;
    totalAmount: number;
    paymentMethod: string;
    paidAt?: string;
    checkedInAt?: string;
    isAlreadyCheckedIn?: boolean;
    isExpired?: boolean;
    isFuture?: boolean;
    timingNotice?: string;
    sessionStatus?: 'EARLY' | 'ACTIVE' | 'ENDED' | 'NORMAL';
    adminNotes?: string;
    rescheduleStatus?: string;
    rescheduleReason?: string;
    rescheduleOriginalDate?: string;
    rescheduleOriginalTime?: string;
    rescheduleTargetDate?: string;
    rescheduleTargetTime?: string;
    isVerifiedByAdmin?: boolean;
  };
}

// Helper waktu zona WIB (Asia/Jakarta, UTC+7)
function getWibDateDetails() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map: Record<string, string> = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;
  const totalMinutesNow = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);

  return { dateStr, timeStr, totalMinutesNow };
}

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

// Masking PII untuk perlindungan privasi publik (Celah IDOR - Poin 15)
function maskNik(nik?: string | null): string | undefined {
  if (!nik) return undefined;
  const clean = nik.trim();
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 6)}******${clean.slice(-4)}`;
}

function maskPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const clean = phone.trim();
  if (clean.length < 6) return clean;
  return `${clean.slice(0, 4)}****${clean.slice(-3)}`;
}

function maskEmail(email?: string | null): string | undefined {
  if (!email || !email.includes('@')) return email || undefined;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

// Identifikasi subsidi tarif pelajar/sekolah atau atlet (Poin 12)
function parseCategoryFromNotes(adminNotes?: string | null): {
  category?: string;
  label?: string;
  requiresIdVerification: boolean;
  instruction?: string;
} {
  if (!adminNotes) return { requiresIdVerification: false };

  let cat: string | undefined = undefined;
  const match = adminNotes.match(/KATEGORI:\s*([A-Z_]+)/);
  if (match) {
    cat = match[1].trim();
  } else if (adminNotes.includes('PELAJAR')) {
    cat = 'PELAJAR';
  } else if (adminNotes.includes('PERTANDINGAN')) {
    cat = 'PERTANDINGAN';
  } else if (adminNotes.includes('SOSIAL')) {
    cat = 'SOSIAL';
  } else if (adminNotes.includes('AMATIR')) {
    cat = 'AMATIR';
  }

  if (cat === 'PELAJAR') {
    return {
      category: 'PELAJAR',
      label: 'Tarif Subsidi Pelajar / Siswa',
      requiresIdVerification: true,
      instruction:
        '⚠️ PERHATIAN PETUGAS GERBANG: Warga menggunakan tarif subsidi pelajar. WAJIB periksa Kartu Pelajar (OSIS/Mahasiswa) / Surat Pengantar Sekolah asli sebelum mengizinkan masuk!',
    };
  }

  if (cat === 'SOSIAL') {
    return {
      category: 'SOSIAL',
      label: 'Tarif Sosial Kemasyarakatan',
      requiresIdVerification: true,
      instruction:
        '⚠️ PERHATIAN PETUGAS GERBANG: Warga menggunakan tarif sosial. Periksa surat rekomendasi kegiatan sosial / RT / RW.',
    };
  }

  if (cat === 'PERTANDINGAN') {
    return {
      category: 'PERTANDINGAN',
      label: 'Event / Pertandingan Resmi',
      requiresIdVerification: true,
      instruction:
        'ℹ️ PERHATIAN PETUGAS GERBANG: Jadwal resmi pertandingan / turnamen. Konfirmasi surat izin pelaksanaan kegiatan.',
    };
  }

  return {
    category: cat,
    label: cat ? `Kategori ${cat}` : undefined,
    requiresIdVerification: false,
  };
}

/**
 * 1. Verifikasi Keaslian Tiket (Online Scan)
 * Dapat diakses publik saat kamera HP petugas/pengunjung scan QR Code tiket.
 * Dilengkapi proteksi IDOR, Anti-Double Check-in, & Validasi Tanggal Kedaluwarsa.
 */
export async function verifyTicketAction(tokenOrId: string): Promise<TicketVerificationResult> {
  try {
    if (!tokenOrId || typeof tokenOrId !== 'string') {
      return { success: false, error: 'Token atau ID Tiket tidak valid.' };
    }

    const clean = tokenOrId.trim();

    // Verifikasi sesi petugas/admin
    const adminSession = await getCurrentAdminAction();
    const isAdmin = Boolean(adminSession && adminSession.admin);

    // IDOR PROTECTION (Poin 15):
    // Jika BUKAN admin, HANYA izinkan pencarian berdasarkan token acak qrCodeToken berentropi tinggi.
    // Dilarang keras mencari berdasarkan database ID (seperti GLR-xxx atau WALKIN-xxx) untuk publik.
    let booking;
    if (isAdmin) {
      booking = await prisma.booking.findFirst({
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
    } else {
      booking = await prisma.booking.findFirst({
        where: {
          OR: [
            { qrCodeToken: clean },
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
    }

    if (!booking) {
      if (!isAdmin && (clean.startsWith('GLR-') || clean.startsWith('WALKIN-') || clean.startsWith('booking-'))) {
        return {
          success: false,
          error:
            'Akses Ditolak: Pemindaian publik wajib menggunakan token QR resmi berkeamanan tinggi, bukan nomor ID database langsung.',
        };
      }
      return { success: false, error: 'Tiket tidak ditemukan dalam sistem resmi DISBUDPORA.' };
    }

    // 1. Poin 3: Deteksi Status Check-In Sebelumnya (Anti-Double Check-in)
    let checkedInAt: string | undefined = undefined;
    let isAlreadyCheckedIn = false;
    if (booking.adminNotes && booking.adminNotes.includes('CHECKED_IN:')) {
      const match = booking.adminNotes.match(/CHECKED_IN:\s*([^;]+)/);
      if (match) {
        checkedInAt = match[1].trim();
        isAlreadyCheckedIn = true;
      }
    }

    // 2. Poin 10: Validasi Tanggal & Jam Kedaluwarsa
    const wib = getWibDateDetails();
    const targetDate = booking.rescheduleTargetDate
      ? booking.rescheduleTargetDate.toISOString().split('T')[0]
      : (booking.items[0]?.date ? booking.items[0].date.toISOString().split('T')[0] : booking.createdAt.toISOString().split('T')[0]);

    let isExpired = false;
    let isFuture = false;
    let sessionStatus: 'EARLY' | 'ACTIVE' | 'ENDED' | 'NORMAL' = 'NORMAL';
    let timingNotice: string | undefined = undefined;

    let earliestMinutes = Infinity;
    let latestMinutes = -Infinity;
    let earliestTimeStr = '08:00';
    let latestTimeStr = '20:00';

    if (booking.items.length > 0) {
      for (const item of booking.items) {
        const startM = timeStringToMinutes(item.timeStart);
        const endM = timeStringToMinutes(item.timeEnd);
        if (startM < earliestMinutes) {
          earliestMinutes = startM;
          earliestTimeStr = item.timeStart;
        }
        if (endM > latestMinutes) {
          latestMinutes = endM;
          latestTimeStr = item.timeEnd;
        }
      }
    }

    if (targetDate < wib.dateStr) {
      isExpired = true;
      timingNotice = `Tiket telah KEDALUWARSA. Jadwal bermain adalah tanggal ${targetDate}.`;
    } else if (targetDate > wib.dateStr) {
      isFuture = true;
      timingNotice = `Jadwal bermain belum tiba. Tiket ini berlaku untuk tanggal ${targetDate}.`;
    } else {
      // Tanggal HARI INI: Cek jendela sesi (Pintu masuk dibuka 30 menit sebelum sesi pertama)
      const gateOpenMinutes = earliestMinutes - 30;
      if (wib.totalMinutesNow < gateOpenMinutes) {
        sessionStatus = 'EARLY';
        const openH = Math.floor(gateOpenMinutes / 60).toString().padStart(2, '0');
        const openM = (gateOpenMinutes % 60).toString().padStart(2, '0');
        timingNotice = `Pintu gerbang dibuka mulai pukul ${openH}:${openM} WIB (30 menit sebelum sesi ${earliestTimeStr} WIB).`;
      } else if (wib.totalMinutesNow > latestMinutes) {
        sessionStatus = 'ENDED';
        timingNotice = `Sesi sewa lapangan telah berakhir pada pukul ${latestTimeStr} WIB.`;
      } else {
        sessionStatus = 'ACTIVE';
        timingNotice = `Sesi aktif (${earliestTimeStr} - ${latestTimeStr} WIB). Pengunjung dipersilakan masuk lapangan.`;
      }
    }

    const isPendingReschedule = booking.rescheduleStatus === 'PENDING_CUSTOMER';
    const isRejectedRefund = booking.rescheduleStatus === 'REJECTED_REFUND';
    const isValid =
      booking.status === 'PAID_SUCCESS' &&
      !isPendingReschedule &&
      !isRejectedRefund &&
      !isExpired &&
      !isAlreadyCheckedIn;

    const firstItem = booking.items[0];
    const timeSlots = booking.items.map((i) => `${i.timeStart} - ${i.timeEnd}`).join(', ');

    // 3. Poin 12: Kategori Tarif Subsidi
    const categoryInfo = parseCategoryFromNotes(booking.adminNotes);

    // 4. Poin 15: Masking Data Sensitif untuk Publik (IDOR Prevention)
    const customerPhone = isAdmin
      ? booking.senderPhone || booking.user?.phone || undefined
      : maskPhone(booking.senderPhone || booking.user?.phone);
    const customerEmail = isAdmin
      ? booking.user?.email || undefined
      : maskEmail(booking.user?.email);
    const nik = isAdmin ? booking.nik || undefined : maskNik(booking.nik);

    return {
      success: true,
      ticket: {
        id: booking.id,
        qrCodeToken: booking.qrCodeToken,
        status: booking.status,
        isValid,
        customerName: booking.senderName || booking.user?.name || 'Warga Pengunjung',
        customerEmail,
        customerPhone,
        nik,
        venueName: booking.venue?.name || 'Fasilitas Olahraga DISBUDPORA',
        venueAddress: booking.venue?.address || booking.venue?.city || 'Kabupaten Bekasi',
        fieldName: firstItem?.field?.name || 'Lapangan',
        sportCategory: booking.sportCategory,
        userCategory: categoryInfo.category,
        userCategoryLabel: categoryInfo.label,
        requiresIdVerification: categoryInfo.requiresIdVerification,
        verificationInstruction: categoryInfo.instruction,
        date: targetDate,
        timeSlots: timeSlots || 'Sesuai Jadwal',
        quantity: firstItem?.quantity || 1,
        totalAmount: booking.grandTotal,
        paymentMethod: booking.paymentMethod,
        paidAt: booking.payment?.paidAt?.toISOString() || booking.updatedAt.toISOString(),
        checkedInAt,
        isAlreadyCheckedIn,
        isExpired,
        isFuture,
        timingNotice,
        sessionStatus,
        adminNotes: booking.adminNotes || undefined,
        rescheduleStatus: booking.rescheduleStatus || undefined,
        rescheduleReason: booking.rescheduleReason || undefined,
        rescheduleOriginalDate: booking.rescheduleOriginalDate
          ? booking.rescheduleOriginalDate.toISOString().split('T')[0]
          : undefined,
        rescheduleOriginalTime: booking.rescheduleOriginalTime || undefined,
        rescheduleTargetDate: booking.rescheduleTargetDate
          ? booking.rescheduleTargetDate.toISOString().split('T')[0]
          : undefined,
        rescheduleTargetTime: booking.rescheduleTargetTime || undefined,
        isVerifiedByAdmin: isAdmin,
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
 * Dilengkapi validasi ketat anti double check-in (screenshot sharing) & verifikasi tanggal.
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
      include: { items: true },
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

    // Poin 3: Cek apakah tiket sudah pernah di-check-in (Anti Screenshot Sharing)
    if (booking.adminNotes && booking.adminNotes.includes('CHECKED_IN:')) {
      const match = booking.adminNotes.match(/CHECKED_IN:\s*([^;]+)/);
      const prevStamp = match ? match[1].trim() : 'sebelumnya';
      return {
        success: false,
        error: `⛔ DITOLAK: Tiket ini SUDAH DIGUNAKAN untuk check-in pada (${prevStamp}). Check-in ganda tidak diperkenankan demi mencegah penyalahgunaan screenshot tiket.`,
      };
    }

    // Poin 10: Cek tanggal pemakaian (Anti Tiket Kedaluwarsa / Belum Waktunya)
    const wib = getWibDateDetails();
    const targetDate = booking.rescheduleTargetDate
      ? booking.rescheduleTargetDate.toISOString().split('T')[0]
      : (booking.items[0]?.date ? booking.items[0].date.toISOString().split('T')[0] : '');

    if (targetDate && targetDate < wib.dateStr) {
      return {
        success: false,
        error: `⛔ DITOLAK: Tiket telah KEDALUWARSA. Jadwal sewa adalah tanggal ${targetDate}, sedangkan hari ini ${wib.dateStr}.`,
      };
    }

    if (targetDate && targetDate > wib.dateStr) {
      return {
        success: false,
        error: `⛔ DITOLAK: Jadwal belum tiba. Tiket ini dijadwalkan untuk tanggal ${targetDate}. Belum dapat di-check-in hari ini.`,
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
