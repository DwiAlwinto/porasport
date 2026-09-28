/**
 * Sanitasi tujuan navigasi setelah login/registrasi.
 *
 * Nilai `returnUrl` berasal dari query string, jadi sepenuhnya dikendalikan
 * penyerang. Tanpa pemeriksaan, `?returnUrl=https://evil.com` membuat
 * `router.push()` melakukan hard-navigation ke situs lain tepat setelah
 * pengguna memasukkan kredensial yang benar — konteks phishing paling kuat.
 *
 * Hanya path internal yang diizinkan. `//evil.com` juga ditolak karena
 * browser memperlakukannya sebagai URL protocol-relative.
 */
/** Prefiks route yang boleh menjadi tujuan setelah login. */
const KNOWN_PREFIXES = [
  '/admin',
  '/fasilitas',
  '/venue',
  '/checkout',
  '/dashboard',
  '/riwayat',
  '/login',
  '/register',
];

export function safeReturnUrl(raw: string | null | undefined, fallback = '/'): string {  if (!raw) return fallback;

  // Tolak skema berbahaya (javascript:, data:, http:, https:) dan protocol-relative.
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.startsWith('/\\')) return fallback;

  // Tolak byte kontrol dan backslash yang bisa dipakai menipu parser URL.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;

  // Tolak segmen path traversal meski dampaknya kecil di sisi peramban.
  if (raw.split(/[/?]/).includes('..')) return fallback;

  // Hanya path yang benar-benar ada di aplikasi ini yang diizinkan.
  // Perhatikan: '/' TIDAK boleh dipakai sebagai awalan umum, karena itu
  // akan membuat semua path lolos.
  if (raw === '/') return raw;

  const allowed = KNOWN_PREFIXES.some(
    (p) => raw === p || raw.startsWith(`${p}/`) || raw.startsWith(`${p}?`)
  );
  if (!allowed) return fallback;

  return raw;
}
