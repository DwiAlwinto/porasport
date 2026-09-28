import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { safeReturnUrl } from '@/lib/safeUrl';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Disanitasi sebelum disimpan ke cookie, bukan hanya saat dibaca.
  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));

  // Generate cryptographic anti-CSRF state token
  const state = crypto.randomBytes(24).toString('hex');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const response = NextResponse.redirect(
    clientId
      ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
          clientId
        )}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=openid%20email%20profile&state=${state}&prompt=select_account`
      : `${baseUrl}/login?google_dev_mode=true&state=${state}`
  );

  // Simpan state di cookie HTTP-only untuk verifikasi callback
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 menit
  });

  if (returnUrl) {
    response.cookies.set('oauth_return_url', returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
  }

  return response;
}
