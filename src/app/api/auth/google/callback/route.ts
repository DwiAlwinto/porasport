import { NextRequest, NextResponse } from 'next/server';
import { googleAuthUpsertUser } from '@/actions/userAuthActions';
import { safeReturnUrl } from '@/lib/safeUrl';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = req.cookies;
  const expectedState = cookieStore.get('oauth_state')?.value;
  // Cookie bisa saja dibuat oleh versi lama yang belum menyanitasi, jadi
  // tetap dibersihkan di sini sebelum dipakai.
  const returnUrl = safeReturnUrl(cookieStore.get('oauth_return_url')?.value);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  // Cek jika user membatalkan di Google
  if (error) {
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error)}`);
  }

  // Verifikasi Anti-CSRF State
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent('Verifikasi keamanan Google (CSRF) gagal. Silakan coba kembali.')}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  // Jalur simulasi lokal (login dev tanpa kredensial Google).
  //
  // Dulu cabang ini hanya bergantung pada query param `dev_email`/`dev_name`
  // tanpa pemeriksaan environment apa pun, sehingga bisa dipanggil di produksi:
  // penyerang cukup mengambil cookie oauth_state miliknya sendiri lalu
  // meminta sesi untuk email siapa pun, termasuk admin. Jadi sekarang ia
  // berada DI DALAM blok pemeriksaan kredensial di bawah, yang otomatis
  // menolak saat Google Client ID/Secret belum dikonfigurasi.
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/login?google_dev_mode=true&state=${state}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/login?google_dev_mode=true&state=${state}`
    );
  }

  // Simulasi login dev: HANYA saat kredensial Google tidak dikonfigurasi
  // DAN server benar-benar berjalan di mode pengembangan.
  if (process.env.NODE_ENV !== 'production') {
    const devEmail = searchParams.get('dev_email');
    const devName = searchParams.get('dev_name');

    if (devEmail && devName) {
      const upsertRes = await googleAuthUpsertUser({
        email: devEmail,
        name: devName,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(devName)}`,
      });

      if (!upsertRes.success) {
        return NextResponse.redirect(
          `${baseUrl}/login?error=${encodeURIComponent(upsertRes.error || 'Gagal menyimpan user.')}`
        );
      }

      const res = NextResponse.redirect(`${baseUrl}${returnUrl}`);
      res.cookies.delete('oauth_state');
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
        `${baseUrl}/login?error=${encodeURIComponent('Gagal menukarkan token otorisasi Google.')}`
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
        `${baseUrl}/login?error=${encodeURIComponent('Gagal membaca data profil dari akun Google.')}`
      );
    }

    // 3. Simpan data user ke PostgreSQL database dengan role 'USER'
    const upsertRes = await googleAuthUpsertUser({
      googleId: userData.id,
      email: userData.email,
      name: userData.name || userData.email.split('@')[0],
      avatarUrl: userData.picture,
    });

    if (!upsertRes.success) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(upsertRes.error || 'Gagal menyimpan user.')}`
      );
    }

    // 4. Sukses, bersihkan cookie state dan arahkan ke tujuan
    const res = NextResponse.redirect(`${baseUrl}${returnUrl}`);
    res.cookies.delete('oauth_state');
    res.cookies.delete('oauth_return_url');
    return res;
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent('Terjadi kesalahan internal saat autentikasi Google.')}`
    );
  }
}
