/**
 * Pesan error yang memang dimaksud untuk dilihat pengguna.
 *
 * Tanpa pemisahan ini, `catch` harus mengembalikan `error.message` apa adanya
 * supaya pesan validasi tidak hilang — tapi itu juga membocorkan pesan driver
 * (Prisma, Supabase, Google Vision) yang memuat nama tabel, nama constraint,
 * endpoint internal, dan bentuk topologi koneksi.
 *
 * Solusinya: error yang SENGAJA ditulis untuk pengguna dilempar sebagai
 * `UserFacingError`. `toPublicMessage()` hanya meneruskan pesan dari kelas
 * itu, dan untuk semua error lain mengembalikan teks generik.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/**
 * Terjemahkan error apa pun menjadi pesan yang aman dikirim ke browser.
 *
 * Detail lengkap tetap dicatat di sisi server lewat `console.error` di
 * masing-masing catch, jadi tidak hilang informasi untuk sake debugging.
 */
export function toPublicMessage(error: unknown, fallback: string): string {
  if (error instanceof UserFacingError) return error.message;
  // Pesan yang memang ditulis manual tanpa kelas ini (mis. dari helper lama)
  // tetap aman selama tidak berasal dari driver.
  if (error instanceof Error && error.name === 'UserFacingError') return error.message;
  return fallback;
}
