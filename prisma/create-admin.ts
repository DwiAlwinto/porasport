/**
 * Membuat atau mereset akun admin pertama.
 *
 * Script ini menggantikan `ensureDefaultAdminExists()` yang dulu berjalan
 * otomatis di setiap render halaman admin dengan kredensial yang tertulis
 * di source. Sekarang pembuatan akun hanya bisa dilakukan lewat baris perintah
 * di mesin yang memang memegang akses ke server.
 *
 * Pemakaian:
 *   npm run db:create-admin -- --email admin@sportbekasi.id --password 'KataSandiKuat123'
 *
 * Argumen bisa lewat environment:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:create-admin
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Ukuran minimum sengaja tidak terlalu tinggi supaya tidak mengganggu,
 * tidak mengganggu, tapi cukup menolak sandi yang jelas-jelas lemah.
 */
function validatePassword(password: string): string | null {
  if (password.length < 12) {
    return 'Kata sandi minimal 12 karakter.';
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    return 'Kata sandi harus memuat minimal 3 dari: huruf kecil, huruf besar, angka, dan simbol.';
  }
  return null;
}

async function main() {
  const email = (argValue('--email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = argValue('--password') || process.env.ADMIN_PASSWORD || '';
  const name = argValue('--name') || process.env.ADMIN_NAME || 'Super Admin DISBUDPORA';
  const role = (argValue('--role') || process.env.ADMIN_ROLE || 'SUPERADMIN').toUpperCase();

  if (!email || !email.includes('@')) {
    throw new Error('Email wajib diisi. Contoh: npm run db:create-admin -- --email admin@sportbekasi.id --password "KataSandiKuat123"');
  }
  const pwError = validatePassword(password);
  if (pwError) {
    throw new Error(pwError);
  }
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    throw new Error('Role harus ADMIN atau SUPERADMIN.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = hashPassword(password);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: role as 'ADMIN' | 'SUPERADMIN' },
    });
    console.log(`Kata sandi & role untuk ${email} berhasil direset (role: ${role}).`);
  } else {
    await prisma.user.create({
      data: {
        name,
        email,
        phone: '081299990000',
        passwordHash,
        role: role as 'ADMIN' | 'SUPERADMIN',
      },
    });
    console.log(`Akun ${role} dibuat: ${email}`);
  }

  // Tidak mencetak kata sandi ke stdout supaya tidak ikut terekam di log CI.
  console.log('Selesai. Silakan login melalui /admin/login.');
}

main()
  .catch((e: unknown) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
