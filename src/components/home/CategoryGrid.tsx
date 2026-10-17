import React from 'react';
import { useApp } from '../../context/AppContext';
import { SportCategory } from '../../types';
import {
  Trophy,
  Flame,
  Zap,
} from 'lucide-react';

interface SportCard {
  id: SportCategory;
  name: string;
  emoji: string;
  desc: string;
  badge?: string;
  gradient: string;
}

const CATEGORY_CARDS: SportCard[] = [
  {
    id: 'MINI_SOCCER',
    name: 'Mini Soccer',
    emoji: '🥅',
    desc: 'Wibawa Mukti & Sukatani',
    badge: 'Favorit',
    gradient: 'from-lime-500/10 to-lime-600/20 border-lime-500/30 text-lime-700',
  },
  {
    id: 'SEPAK_BOLA',
    name: 'Sepak Bola',
    emoji: '⚽',
    desc: 'Grand Wisata, Cibarusah, dll',
    badge: 'Populer',
    gradient: 'from-emerald-500/10 to-emerald-600/20 border-emerald-500/30 text-emerald-700',
  },
  {
    id: 'FUTSAL',
    name: 'Lapangan Futsal',
    emoji: '⚽',
    desc: 'Sukatani & Grand Wisata',
    gradient: 'from-teal-500/10 to-teal-600/20 border-teal-500/30 text-teal-700',
  },
  {
    id: 'VOLI',
    name: 'Lapangan Voli',
    emoji: '🏐',
    desc: 'Cibarusah & GOR Tambun Sel.',
    gradient: 'from-amber-500/10 to-amber-600/20 border-amber-500/30 text-amber-700',
  },
  {
    id: 'MENEMBAK',
    name: 'Lapangan Tembak',
    emoji: '🎯',
    desc: 'Perbakin Wibawa Mukti & Tarumajaya',
    badge: 'Presisi',
    gradient: 'from-red-500/10 to-red-600/20 border-red-500/30 text-red-700',
  },
  {
    id: 'TENIS',
    name: 'Lapangan Tenis',
    emoji: '🎾',
    desc: 'GOR Tambun & Wibawa Mukti',
    gradient: 'from-yellow-500/10 to-yellow-600/20 border-yellow-500/30 text-yellow-700',
  },
  {
    id: 'BASKET',
    name: 'Bola Basket',
    emoji: '🏀',
    desc: 'Grand Wisata, Ckr. Barat, GOR Tambun',
    gradient: 'from-orange-500/10 to-orange-600/20 border-orange-500/30 text-orange-700',
  },
  {
    id: 'RENANG',
    name: 'Kolam Renang',
    emoji: '🏊',
    desc: 'Wibawa Mukti & Cikarang Utara',
    badge: 'Olympic',
    gradient: 'from-cyan-500/10 to-cyan-600/20 border-cyan-500/30 text-cyan-700',
  },
  {
    id: 'SKATEPARK',
    name: 'Skateboard',
    emoji: '🛹',
    desc: 'Bowl & Street Wibawa Mukti',
    gradient: 'from-purple-500/10 to-purple-600/20 border-purple-500/30 text-purple-700',
  },
  {
    id: 'BADMINTON',
    name: 'Bulu Tangkis',
    emoji: '🏸',
    desc: 'Wibawa Mukti & GOR Tambun',
    gradient: 'from-blue-500/10 to-blue-600/20 border-blue-500/30 text-blue-700',
  },
  {
    id: 'STADION',
    name: 'Stadion Utama',
    emoji: '🏟️',
    desc: 'Stadion Wibawa Mukti Cikarang',
    badge: 'Standar FIFA',
    gradient: 'from-indigo-500/10 to-indigo-600/20 border-indigo-500/30 text-indigo-700',
  },
  {
    id: 'ATLETIK',
    name: 'Trek Lari / Atletik',
    emoji: '🏃',
    desc: 'Lintasan Tartan Wibawa Mukti',
    gradient: 'from-rose-500/10 to-rose-600/20 border-rose-500/30 text-rose-700',
  },
  {
    id: 'ROLLER_SPORT',
    name: 'Trek Sepatu Roda',
    emoji: '🛼',
    desc: 'Sirkuit Grand Wisata',
    gradient: 'from-fuchsia-500/10 to-fuchsia-600/20 border-fuchsia-500/30 text-fuchsia-700',
  },
  {
    id: 'SQUASH',
    name: 'Lapangan Squash',
    emoji: '🎾',
    desc: 'Indoor Court Standar',
    gradient: 'from-amber-500/10 to-amber-600/20 border-amber-500/30 text-amber-700',
  },
  {
    id: 'PADEL',
    name: 'Padel Tennis',
    emoji: '🎾',
    desc: 'Padel Glass Court',
    gradient: 'from-teal-500/10 to-teal-600/20 border-teal-500/30 text-teal-700',
  },
];

export const CategoryGrid: React.FC = () => {
  const { handleSearchSubmit } = useApp();

  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
              <Zap className="h-4 w-4" />
              <span>Kategori Olahraga</span>
            </div>
            <h2 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
              Pilih Cabang Olahraga Favoritmu
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Klik kategori untuk melihat seluruh daftar lapangan yang tersedia secara real-time.
            </p>
          </div>
          <button
            onClick={() => handleSearchSubmit('ALL')}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Lihat Semua Kategori &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
          {CATEGORY_CARDS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSearchSubmit(cat.id)}
              className={`group relative flex flex-col items-center justify-center rounded-2xl border bg-gradient-to-br p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md ${cat.gradient}`}
            >
              {cat.badge && (
                <span className="absolute -top-2 right-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  {cat.badge}
                </span>
              )}
              <div className="mb-2 text-4xl transition group-hover:scale-110">{cat.emoji}</div>
              <h3 className="text-base font-bold text-slate-900">{cat.name}</h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">{cat.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
