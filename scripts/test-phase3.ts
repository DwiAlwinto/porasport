import { safeReturnUrl } from '../src/lib/safeUrl';
import { stripPII } from '../src/lib/sanitize';

let pass = 0;
let fail = 0;

const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${JSON.stringify(actual)}${
      ok ? '' : `  (harapan ${JSON.stringify(expected)})`
    }`
  );
};

console.log('--- open redirect ---');
check('https://evil.com', safeReturnUrl('https://evil.com'), '/');
check('//evil.com (protocol-relative)', safeReturnUrl('//evil.com'), '/');
check('http://evil.com', safeReturnUrl('http://evil.com'), '/');
check('javascript:alert(1)', safeReturnUrl('javascript:alert(1)'), '/');
check('data:text/html,x', safeReturnUrl('data:text/html,x'), '/');
check('/\\evil.com', safeReturnUrl('/\\evil.com'), '/');
check('path relatif tanpa slash', safeReturnUrl('evil.com'), '/');
check('berupa newline', safeReturnUrl('/\nevil.com'), '/');
check('null', safeReturnUrl(null), '/');
check('undefined', safeReturnUrl(undefined), '/');
check('string kosong', safeReturnUrl(''), '/');

console.log('\n--- path internal yang sah ---');
check('/', safeReturnUrl('/'), '/');
check('/admin/venues', safeReturnUrl('/admin/venues'), '/admin/venues');
check('/admin/login', safeReturnUrl('/admin/login'), '/admin/login');
check('/login?returnUrl=/admin', safeReturnUrl('/login?returnUrl=/admin'), '/login?returnUrl=/admin');
check('/fasilitas', safeReturnUrl('/fasilitas'), '/fasilitas');

console.log('\n--- path tak dikenal ditolak ---');
check('/rahasia', safeReturnUrl('/rahasia'), '/');
check('/admin/../etc (path traversal)', safeReturnUrl('/admin/../etc'), '/');
check('/api/payment/webhook', safeReturnUrl('/api/payment/webhook'), '/');

console.log('\n--- PII dibuang sebelum disimpan ---');
const booking = {
  id: 'GLR-1',
  venueName: 'Stadion',
  nik: '3273010101900001',
  npwp: '12.345.678.9-012.000',
  senderPhone: '08123456789',
  paymentProofUrl: 'https://x.supabase.co/a.png',
  grandTotal: 50000000,
};
const cleaned = stripPII([booking])[0] as Record<string, unknown>;
check('nik dibuang', 'nik' in cleaned, false);
check('npwp dibuang', 'npwp' in cleaned, false);
check('senderPhone dibuang', 'senderPhone' in cleaned, false);
check('paymentProofUrl dibuang', 'paymentProofUrl' in cleaned, false);
check('data bisnis tetap ada', cleaned.id, 'GLR-1');
check('total tetap ada', cleaned.grandTotal, 50000000);
check('asli tidak termutasi', booking.nik, '3273010101900001');

console.log(`\n=== ${pass} lulus, ${fail} gagal ===`);
if (fail > 0) process.exitCode = 1;
