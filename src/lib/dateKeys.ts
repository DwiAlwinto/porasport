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

/** `YYYY-MM-DD` untuk hari ini. */
export function todayKey(): string {
  return toDateKey(new Date());
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
