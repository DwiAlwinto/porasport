import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const ADMIN_COOKIE = 'admin_session';
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Ambil kunci penandatangan cookie sesi admin.
 *
 * Sengaja tidak mengimpor dari `@/lib/auth` supaya tidak menarik modul Prisma
 * ke jalur proxy. Kalau env belum siap, biarkan request lewat supaya aplikasi
 * bisa menampilkan error yang jelas, bukan redirect misterius.
 */
function readSecret(): string | null {
  try {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return null;
    const match = fs.readFileSync(envPath, 'utf8').match(/^SESSION_SECRET=(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Verifikasi cookie `admin_session` tanpa memanggil server action.
 *
 * Token berbentuk `base64url(payload).base64url(HMAC-SHA256(payload))`.
 */
function isValidAdminToken(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(provided, expected)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return false;
    return parsed.role === 'ADMIN' || parsed.role === 'SUPERADMIN';
  } catch {
    return false;
  }
}

function supabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return '*.supabase.co';
  try {
    return new URL(url).hostname;
  } catch {
    return '*.supabase.co';
  }
}

/**
 * Content-Security-Policy berbasis nonce.
 *
 * Next.js membaca nonce dari header ini dan menempelkannya ke setiap tag
 * script yang ia hasilkan. Nonce dibuat baru tiap request, jadi penyerang
 * tidak bisa menebaknya.
 */
function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // React dan Tailwind menyuntikkan style inline, jadi tetap perlu
    // 'unsafe-inline' di directive style.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${supabaseHost()}`,
    "font-src 'self' data:",
    isDev
      ? "connect-src 'self' ws: wss: http://localhost:* http://192.168.*:*"
      : `connect-src 'self' https://${supabaseHost()}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/**
 * Proxy aplikasi.
 *
 * Dua tugas:
 *  1. Menolak permintaan ke /admin yang tidak punya sesi admin valid.
 *  2. Membuat nonce untuk Content-Security-Policy di setiap request.
 *
 * Catatan: CSP berbasis nonce hanya bisa bekerja pada halaman yang di-render
 * secara dinamis, karena nonce disisipkan saat server rendering. Halaman
 * statis tidak punya request header sehingga tidak mendapat nonce. Root layout
 * karena itu dipaksa `force-dynamic`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- 1. Penjaga /admin ---
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!PUBLIC_ADMIN_PATHS.has(pathname)) {
      const secret = readSecret();
      if (secret && !isValidAdminToken(request.cookies.get(ADMIN_COOKIE)?.value, secret)) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // --- 2. Nonce untuk CSP ---
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Semua route, kecuali aset statis dan API.
     * API tidak butuh nonce: handler-nya mengembalikan JSON, bukan HTML.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images/|sitemap.xml|robots.txt).*)',
  ],
};
