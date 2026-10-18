import React from 'react';
import { useApp } from '../../context/AppContext';
import { Venue } from '../../types';

export const RecommendedVenues: React.FC = () => {
  const { venues, setSelectedVenue, setActiveView, t, activeLang } = useApp();

  // Ambil 4 venue teratas
  const displayVenues = [...venues]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  const handleVenueClick = (venue: Venue) => {
    setSelectedVenue(venue);
    setActiveView('VENUE_DETAIL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-black text-slate-900">
            {t.home.recommendedTitle}
          </h2>
          <button 
            onClick={() => setActiveView('EXPLORE')}
            className="text-sm font-bold text-slate-600 transition hover:text-slate-900"
          >
            {t.home.seeAll}
          </button>
        </div>

        {/* Grid Venues (4 columns) */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {displayVenues.map((venue) => (
            <button
              key={venue.id}
              onClick={() => handleVenueClick(venue)}
              className="group flex cursor-pointer flex-col text-left outline-none transition hover:opacity-95"
            >
              {/* Image Container */}
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-100">
                <img
                  src={venue.images[0]}
                  alt={venue.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    target.src = '/images/wibawamukti.png';
                  }}
                />
              </div>

              {/* Text Info */}
              <div className="mt-4 flex flex-col gap-1">
                <h3 className="text-base font-bold text-slate-900">{venue.name}</h3>
                
                <div className="flex items-center text-xs font-semibold text-slate-500">
                  <span>{venue.city}</span>
                  <span className="mx-1.5">•</span>
                  <span className="text-orange-500">
                    {venue.fields.length} {activeLang === 'ID' ? 'Lapangan' : 'Court(s)'}
                  </span>
                </div>

                <div className="mt-1 flex items-center text-xs font-semibold text-slate-500">
                  <span>{t.home.startFrom}</span>
                  <span className="ml-1 text-sm font-black text-[#05BB75]">
                    {formatPrice(venue.minPrice)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
