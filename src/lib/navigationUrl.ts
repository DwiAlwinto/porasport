/**
 * Utilitas untuk sinkronisasi rute dan tampilan aplikasi (AppView) dengan URL browser.
 *
 * Mendukung navigasi SPA bersih (Clean Path URLs):
 * - Beranda: /
 * - Fasilitas: /fasilitas (dengan filter pencarian query string)
 * - Detail Venue: /venue/:id
 * - Dashboard Penyewa: /dashboard
 * - Checkout: /checkout
 *
 * Serta mendukung fallback parameter query: ?view=explore, ?view=venue&id=...
 */

export type AppView = 'HOME' | 'EXPLORE' | 'VENUE_DETAIL' | 'USER_DASHBOARD' | 'CHECKOUT';

export interface ParsedRoute {
  view: AppView;
  venueId: string | null;
}

/**
 * Parsing path dan search query URL menjadi AppView dan ID venue (jika ada).
 */
export function parseRouteFromUrl(pathname: string, search: string): ParsedRoute {
  const params = new URLSearchParams(search);
  const queryView = params.get('view')?.toLowerCase();
  const queryVenue = params.get('venue') || params.get('venueId') || params.get('id');

  // Bersihkan trailing slash kecuali root '/'
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  // 1. Rute Venue Detail: /venue/:id
  if (cleanPath.startsWith('/venue/') || cleanPath === '/venue') {
    const segs = cleanPath.split('/').filter(Boolean);
    const idFromPath = segs[1] ? decodeURIComponent(segs[1]) : null;
    return {
      view: 'VENUE_DETAIL',
      venueId: idFromPath || queryVenue || null,
    };
  }

  // 2. Rute Fasilitas / Eksplorasi
  if (cleanPath === '/fasilitas' || cleanPath === '/explore' || queryView === 'explore' || queryView === 'fasilitas') {
    return {
      view: 'EXPLORE',
      venueId: null,
    };
  }

  // 3. Rute Dashboard / Riwayat Pesanan
  if (cleanPath === '/dashboard' || cleanPath === '/riwayat' || queryView === 'dashboard' || queryView === 'riwayat') {
    return {
      view: 'USER_DASHBOARD',
      venueId: null,
    };
  }

  // 4. Rute Checkout
  if (cleanPath === '/checkout' || queryView === 'checkout') {
    return {
      view: 'CHECKOUT',
      venueId: queryVenue || null,
    };
  }

  // 5. Query param fallback untuk venue (?view=venue atau ?venue=...)
  if (queryView === 'venue' || (queryVenue && cleanPath === '/')) {
    return {
      view: 'VENUE_DETAIL',
      venueId: queryVenue || null,
    };
  }

  // 6. Default: Beranda (Home)
  return {
    view: 'HOME',
    venueId: null,
  };
}

/**
 * Membangun URL path + query string berdasarkan tampilan aktif.
 */
export function buildRouteUrl(
  view: AppView,
  venueId?: string | null,
  filterQueryString?: string
): string {
  const qs = filterQueryString ? (filterQueryString.startsWith('?') ? filterQueryString : `?${filterQueryString}`) : '';

  switch (view) {
    case 'EXPLORE':
      return `/fasilitas${qs}`;
    case 'VENUE_DETAIL':
      return venueId ? `/venue/${encodeURIComponent(venueId)}` : `/fasilitas${qs}`;
    case 'USER_DASHBOARD':
      return `/dashboard`;
    case 'CHECKOUT':
      return `/checkout`;
    case 'HOME':
    default:
      return `/${qs}`;
  }
}
