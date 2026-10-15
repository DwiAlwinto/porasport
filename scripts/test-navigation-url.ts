import { parseRouteFromUrl, buildRouteUrl } from '../src/lib/navigationUrl';

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

console.log('--- parseRouteFromUrl: Pathname Bersih ---');
check('Root / -> HOME', parseRouteFromUrl('/', ''), { view: 'HOME', venueId: null });
check('/fasilitas -> EXPLORE', parseRouteFromUrl('/fasilitas', ''), { view: 'EXPLORE', venueId: null });
check('/fasilitas/ (trailing slash) -> EXPLORE', parseRouteFromUrl('/fasilitas/', ''), { view: 'EXPLORE', venueId: null });
check('/explore -> EXPLORE', parseRouteFromUrl('/explore', ''), { view: 'EXPLORE', venueId: null });
check('/venue/venue-aquatic -> VENUE_DETAIL', parseRouteFromUrl('/venue/venue-aquatic', ''), { view: 'VENUE_DETAIL', venueId: 'venue-aquatic' });
check('/dashboard -> USER_DASHBOARD', parseRouteFromUrl('/dashboard', ''), { view: 'USER_DASHBOARD', venueId: null });
check('/riwayat -> USER_DASHBOARD', parseRouteFromUrl('/riwayat', ''), { view: 'USER_DASHBOARD', venueId: null });
check('/checkout -> CHECKOUT', parseRouteFromUrl('/checkout', ''), { view: 'CHECKOUT', venueId: null });

console.log('\n--- parseRouteFromUrl: Query Fallback ---');
check('?view=explore -> EXPLORE', parseRouteFromUrl('/', '?view=explore'), { view: 'EXPLORE', venueId: null });
check('?view=fasilitas -> EXPLORE', parseRouteFromUrl('/', '?view=fasilitas'), { view: 'EXPLORE', venueId: null });
check('?view=venue&id=v-1 -> VENUE_DETAIL', parseRouteFromUrl('/', '?view=venue&id=v-1'), { view: 'VENUE_DETAIL', venueId: 'v-1' });
check('?venue=v-2 -> VENUE_DETAIL', parseRouteFromUrl('/', '?venue=v-2'), { view: 'VENUE_DETAIL', venueId: 'v-2' });
check('?view=dashboard -> USER_DASHBOARD', parseRouteFromUrl('/', '?view=dashboard'), { view: 'USER_DASHBOARD', venueId: null });
check('?view=checkout -> CHECKOUT', parseRouteFromUrl('/', '?view=checkout'), { view: 'CHECKOUT', venueId: null });

console.log('\n--- buildRouteUrl ---');
check('HOME tanpa filter -> /', buildRouteUrl('HOME'), '/');
check('HOME dengan filter -> /?sport=BASKET', buildRouteUrl('HOME', null, '?sport=BASKET'), '/?sport=BASKET');
check('EXPLORE tanpa filter -> /fasilitas', buildRouteUrl('EXPLORE'), '/fasilitas');
check('EXPLORE dengan filter -> /fasilitas?sport=BASKET', buildRouteUrl('EXPLORE', null, '?sport=BASKET'), '/fasilitas?sport=BASKET');
check('VENUE_DETAIL -> /venue/v-aquatic', buildRouteUrl('VENUE_DETAIL', 'v-aquatic'), '/venue/v-aquatic');
check('USER_DASHBOARD -> /dashboard', buildRouteUrl('USER_DASHBOARD'), '/dashboard');
check('CHECKOUT -> /checkout', buildRouteUrl('CHECKOUT'), '/checkout');

console.log(`\n=== ${pass} lulus, ${fail} gagal ===`);
if (fail > 0) process.exitCode = 1;
