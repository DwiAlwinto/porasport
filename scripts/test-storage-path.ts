import { toStoragePath } from '../src/lib/storage';

let pass = 0;
let fail = 0;

const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${JSON.stringify(actual)}${
      ok ? '' : `  (harapan ${JSON.stringify(expected)})`
    }`
  );
};

const HOST = 'https://sdovgdwexfaafcncwmmr.supabase.co';

console.log('--- path baru (format yang sekarang disimpan) ---');
check(
  'path langsung',
  toStoragePath('payment-proofs/GLR-1/1727000000000-bukti.jpg'),
  'payment-proofs/GLR-1/1727000000000-bukti.jpg'
);

console.log('\n--- URL publik lama (rows yang sudah tersimpan) ---');
check(
  'URL object/public',
  toStoragePath(`${HOST}/storage/v1/object/public/booking-files/payment-proofs/GLR-1/a.jpg`),
  'payment-proofs/GLR-1/a.jpg'
);

console.log('\n--- URL bertanda tangan ---');
check(
  'URL object/sign',
  toStoragePath(`${HOST}/storage/v1/object/sign/booking-files/payment-proofs/GLR-1/a.jpg?token=xyz`),
  'payment-proofs/GLR-1/a.jpg'
);

console.log('\n--- nilai yang tidak dikenal harus null, bukan exception ---');
check('null', toStoragePath(null), null);
check('undefined', toStoragePath(undefined), null);
check('string kosong', toStoragePath(''), null);
check("sentinella 'uploaded'", toStoragePath('uploaded'), null);
check('URL asing', toStoragePath('https://evil.com/x.jpg'), null);
check('path traversal', toStoragePath('../../etc/passwd'), null);
check('path tanpa prefix bucket', toStoragePath('promo-banners/x.png'), null);

console.log(`\n=== ${pass} lulus, ${fail} gagal ===`);
if (fail > 0) process.exitCode = 1;
