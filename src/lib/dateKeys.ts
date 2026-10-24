/**
 * Utilitas kunci tanggal untuk slot jadwal.
 *
 * Semua pembuat slot HARUS memakai fungsi dari file ini. Kolom
 * `FieldSlot.date` bertipe `@db.Date` (tanggal kalender tanpa zona waktu) dan
 * id slot dibentuk dari kunci `YYYY-MM-DD`. Kalau satu jalur menghitung kunci
 * dengan cara berbeda — misalnya memakai `toISOString()` pada tengah malam
 * waktu lokal — hasilnya bergeser satu hari di wilayah UTC+ seperti Bekasi,
 * sehingga slot yang sama terduplikasi.
 */

/** Kunci `YYYY-MM-DD` dari objek Date, memakai getter UTC. */
export function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Mengambil tanggal hari ini dalam zona waktu resmi WIB (Asia/Jakarta, UTC+7) dalam format YYYY-MM-DD.
 * Digunakan untuk batas minimal kalender (min) agar tidak bergeser tanggal saat dini hari di Bekasi.
 */
export function getWibTodayKey(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date(Date.now() + 7 * 3600 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/** `YYYY-MM-DD` untuk hari ini dalam zona waktu WIB. */
export function todayKey(): string {
  return getWibTodayKey();
}

/** Periksa apakah sebuah tanggal (YYYY-MM-DD) berada di masa lalu (sebelum hari ini WIB). */
export function isDateInPast(dateKey: string): boolean {
  if (!dateKey) return false;
  return dateKey < getWibTodayKey();
}

/** Parse `YYYY-MM-DD` menjadi tengah malam UTC, konsisten dengan toDateKey. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    return new Date(NaN);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

/** Tambah sejumlah hari pada kunci tanggal, tanpa melewati batas tengah malam. */
export function addDaysToKey(key: string, days: number): string {
  const base = parseDateKey(key);
  if (Number.isNaN(base.getTime())) return key;
  return toDateKey(new Date(base.getTime() + days * 86_400_000));
}

/** Tanggal dalam bentuk UTC midnight — nilai yang cocok untuk kolom `@db.Date`. */
export function dateFromKey(key: string): Date {
  return parseDateKey(key);
}
