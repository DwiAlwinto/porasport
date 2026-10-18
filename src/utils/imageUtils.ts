import React from 'react';

export const SPORT_FALLBACK_IMAGES: Record<string, string> = {
  SEPAK_BOLA: '/images/stadion-1.jpg',
  BASKET: '/images/gor-basket-1.png',
  VOLI: '/images/gor-voli-1.jpeg',
  BADMINTON: '/images/badminton-1.jpeg',
  MENEMBAK: '/images/shooter-1.jpg',
  ATLETIK: '/images/atletik-1.jpeg',
  FUTSAL: '/images/gor-futsal-1.jpg',
  MINI_SOCCER: '/images/minisoccer-1.jpeg',
  ROLLER_SPORT: '/images/rollersport-1.jpeg',
  RENANG: '/images/renang-1.jpeg',
  SQUASH: '/images/squash-1.jpeg',
  SKATEPARK: '/images/skatepark-1.jpeg',
  PADEL: '/images/badminton-1.jpeg',
  TENIS: '/images/badminton-1.jpeg',
  PANJAT_TEBING: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&auto=format&fit=crop&q=80',
  default: '/images/stadion-1.jpg',
};

export function getFallbackImageForUrl(urlOrName: string = '', sportHint?: string): string {
  const text = (urlOrName + ' ' + (sportHint || '')).toLowerCase();

  if (text.includes('stadion') || text.includes('sepak') || text.includes('bola')) return SPORT_FALLBACK_IMAGES.SEPAK_BOLA;
  if (text.includes('basket')) return SPORT_FALLBACK_IMAGES.BASKET;
  if (text.includes('voli')) return SPORT_FALLBACK_IMAGES.VOLI;
  if (text.includes('badminton')) return SPORT_FALLBACK_IMAGES.BADMINTON;
  if (text.includes('shooter') || text.includes('menembak') || text.includes('tembak') || text.includes('perbakin')) return SPORT_FALLBACK_IMAGES.MENEMBAK;
  if (text.includes('panjat') || text.includes('climb') || text.includes('tebing') || text.includes('boulder')) return SPORT_FALLBACK_IMAGES.PANJAT_TEBING;
  if (text.includes('atletik') || text.includes('track')) return SPORT_FALLBACK_IMAGES.ATLETIK;
  if (text.includes('futsal')) return SPORT_FALLBACK_IMAGES.FUTSAL;
  if (text.includes('minisoccer') || text.includes('mini_soccer') || text.includes('soccer')) return SPORT_FALLBACK_IMAGES.MINI_SOCCER;
  if (text.includes('roller') || text.includes('rollersport')) return SPORT_FALLBACK_IMAGES.ROLLER_SPORT;
  if (text.includes('renang') || text.includes('aquatik') || text.includes('aquatic')) return SPORT_FALLBACK_IMAGES.RENANG;
  if (text.includes('squash')) return SPORT_FALLBACK_IMAGES.SQUASH;
  if (text.includes('skate')) return SPORT_FALLBACK_IMAGES.SKATEPARK;

  if (sportHint && SPORT_FALLBACK_IMAGES[sportHint.toUpperCase()]) {
    return SPORT_FALLBACK_IMAGES[sportHint.toUpperCase()];
  }

  return SPORT_FALLBACK_IMAGES.default;
}

export const DEFAULT_VENUE_IMAGE = '/images/wibawamukti.png';

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  // Prevent infinite error looping
  target.onerror = null;
  // Fallback ke aset lokal yang dijamin ada (bukan gambar palsu eksternal).
  if (!target.src.endsWith(DEFAULT_VENUE_IMAGE)) {
    target.src = DEFAULT_VENUE_IMAGE;
  }
}




