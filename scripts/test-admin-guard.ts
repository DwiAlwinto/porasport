/**
 * Uji end-to-end penjaga /admin.
 *
 * Membuat token sesi dengan SESSION_SECRET yang sama seperti aplikasi, lalu
 * memakainya sebagai cookie untuk memastikan route /admin menerimanya, dan
 * memastikan token yang rusak / kedaluwarsa ditolak.
 */
import crypto from 'crypto';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const found = env.match(/^SESSION_SECRET=(.+)$/m)?.[1].trim();
if (!found) throw new Error('SESSION_SECRET tidak ditemukan di .env');
const secret: string = found;

function sign(payloadObj: Record<string, unknown>, key: string = secret) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

const attackerKey = 'sport-bekasi-disbudpora-secret-key-2026';

const cases = [
  { name: 'SUPERADMIN valid', token: sign({ userId: 'admin-1', email: 'a@b.c', name: 'A', role: 'SUPERADMIN', exp: Date.now() + 3600000 }), expect: 200 },
  // admin-2 sengaja tidak ada di database, jadi halaman error saat render.
  // Yang diuji di sini hanya: proxy MELALUIKAN token, bukan me-redirect.
  { name: 'ADMIN valid (lolos proxy)', token: sign({ userId: 'admin-2', email: 'a@b.c', name: 'A', role: 'ADMIN', exp: Date.now() + 3600000 }), expect: 'diteruskan' as const },
  { name: 'role USER (ditolak)', token: sign({ userId: 'u1', email: 'a@b.c', name: 'A', role: 'USER', exp: Date.now() + 3600000 }), expect: 307 },
  { name: 'kedaluwarsa', token: sign({ userId: 'admin-1', email: 'a@b.c', name: 'A', role: 'SUPERADMIN', exp: Date.now() - 1000 }), expect: 307 },
  {
    name: 'signature dirusak',
    token: sign({ userId: 'admin-1', email: 'a@b.c', name: 'A', role: 'SUPERADMIN', exp: Date.now() + 3600000 }).slice(0, -3) + 'AAA',
    expect: 307,
  },
  {
    name: 'kunci lama attacker',
    token: sign({ userId: 'admin-1', email: 'x@x.x', name: 'X', role: 'SUPERADMIN', exp: Date.now() + 3600000 }, attackerKey),
    expect: 307,
  },
];

async function main() {
  let fail = 0;
  for (const c of cases) {
    const res = await fetch('http://localhost:3000/admin', {
      headers: { cookie: `admin_session=${c.token}` },
      redirect: 'manual',
    });
    const passedGuard = res.status !== 307;
    const ok =
      c.expect === 'diteruskan' ? passedGuard : res.status === (c.expect as number);
    if (!ok) fail++;
    const loc = res.status === 307 ? ` -> ${res.headers.get('location')}` : '';
    const want =
      c.expect === 'diteruskan' ? 'tidak di-redirect' : `status ${c.expect as number}`;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(28)} status=${res.status} (harapan ${want})${loc}`
    );
  }

  console.log(`\n=== ${cases.length - fail} lulus, ${fail} gagal ===`);
  if (fail > 0) process.exitCode = 1;
}

main();
