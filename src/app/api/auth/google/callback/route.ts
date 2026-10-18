import { NextRequest, NextResponse } from 'next/server';
import { googleAuthLoginUser, googleAuthRegisterUser } from '@/actions/userAuthActions';
import { safeReturnUrl } from '@/lib/safeUrl';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = req.cookies;
  const expectedState = cookieStore.get('oauth_state')?.value;
  const oauthMode = cookieStore.get('oauth_mode')?.value || 'login';
  // Cookie bisa saja dibuat oleh versi lama yang belum menyanitasi, jadi
  // tetap dibersihkan di sini sebelum dipakai.
  const returnUrl = safeReturnUrl(cookieStore.get('oauth_return_url')?.value);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const errorRedirectTarget = oauthMode === 'register' ? `${baseUrl}/register` : `${baseUrl}/login`;

  // Cek jika user membatalkan di Google
  if (error) {
    return NextResponse.redirect(`${errorRedirectTarget}?error=${encodeURIComponent(error)}`);
  }

  // Verifikasi Anti-CSRF State
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      `${errorRedirectTarget}?error=${encodeURIComponent('Verifikasi keamanan Google (CSRF) gagal. Silakan coba kembali.')}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${errorRedirectTarget}?google_dev_mode=true&state=${state}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${errorRedirectTarget}?google_dev_mode=true&state=${state}`
    );
  }

  // Simulasi login dev: HANYA saat kredensial Google tidak dikonfigurasi
  // DAN server benar-benar berjalan di mode pengembangan.
  if (process.env.NODE_ENV !== 'production') {
    const devEmail = searchParams.get('dev_email');
    const devName = searchParams.get('dev_name');

    if (devEmail && devName) {
      const profile = {
        email: devEmail,
        name: devName,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(devName)}`,
      };

      const authRes =
        oauthMode === 'register'
          ? await googleAuthRegisterUser(profile)
          : await googleAuthLoginUser(profile);

      if (!authRes.success) {
        if ((authRes as any).notRegistered) {
          const res = NextResponse.redirect(
            `${baseUrl}/register?error=${encodeURIComponent(
              'Akun Google belum terdaftar. Silakan registrasi terlebih dahulu.'
            )}&email=${encodeURIComponent(devEmail)}&name=${encodeURIComponent(devName)}`
          );
          res.cookies.delete('oauth_state');
          res.cookies.delete('oauth_mode');
          res.cookies.delete('oauth_return_url');
          return res;
        }

        return NextResponse.redirect(
          `${errorRedirectTarget}?error=${encodeURIComponent(authRes.error || 'Gagal memproses user.')}`
        );
      }

      const res = NextResponse.redirect(`${baseUrl}${returnUrl}`);
      res.cookies.delete('oauth_state');
      res.cookies.delete('oauth_mode');
      res.cookies.delete('oauth_return_url');
      return res;
    }
  }

  try {
    // 1. Tukar authorization code dengan access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token exchange error:', tokenData);
      return NextResponse.redirect(
        `${errorRedirectTarget}?error=${encodeURIComponent('Gagal menukarkan token otorisasi Google.')}`
      );
    }

    // 2. Ambil data profil user dari Google UserInfo API
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userRes.json();

    if (!userRes.ok || !userData.email) {
      console.error('Google userinfo fetch error:', userData);
      return NextResponse.redirect(
        `${errorRedirectTarget}?error=${encodeURIComponent('Gagal membaca data profil dari akun Google.')}`
      );
    }

    const profile = {
      googleId: userData.id,
      email: userData.email,
      name: userData.name || userData.email.split('@')[0],
      avatarUrl: userData.picture,
    };

    // 3. Proses berdasarkan mode: LOGIN atau REGISTER
    if (oauthMode === 'login') {
      const loginRes = await googleAuthLoginUser(profile);

      if (!loginRes.success) {
        if ((loginRes as any).notRegistered) {
          // Akun belum terdaftar: Arahkan ke register dengan pesan jelas dan auto-fill data
          const res = NextResponse.redirect(
            `${baseUrl}/register?error=${encodeURIComponent(
              'Akun Google belum terdaftar. Silakan lakukan registrasi akun terlebih dahulu.'
            )}&email=${encodeURIComponent(userData.email)}&name=${encodeURIComponent(
              userData.name || ''
            )}`
          );
          res.cookies.delete('oauth_state');
          res.cookies.delete('oauth_mode');
          res.cookies.delete('oauth_return_url');
          return res;
        }

        return NextResponse.redirect(
          `${baseUrl}/login?error=${encodeURIComponent(loginRes.error || 'Gagal masuk menggunakan Google.')}`
        );
      }
    } else {
      // mode === 'register'
      const registerRes = await googleAuthRegisterUser(profile);

      if (!registerRes.success) {
        return NextResponse.redirect(
          `${baseUrl}/register?error=${encodeURIComponent(registerRes.error || 'Gagal mendaftar menggunakan Google.')}`
        );
      }
    }

    // 4. Sukses, bersihkan cookie state & mode lalu arahkan ke tujuan
    const res = NextResponse.redirect(`${baseUrl}${returnUrl}`);
    res.cookies.delete('oauth_state');
    res.cookies.delete('oauth_mode');
    res.cookies.delete('oauth_return_url');
    return res;
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(
      `${errorRedirectTarget}?error=${encodeURIComponent('Terjadi kesalahan internal saat autentikasi Google.')}`
    );
  }
}
