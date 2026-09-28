import React from 'react';

export const PromoBanner: React.FC = () => {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-shadow duration-300">
          <img 
            src="/images/wibawamukti.png" 
            alt="Stadion Wibawa Mukti" 
            className="w-full h-auto object-cover max-h-[500px]"
            onError={(e) => {
              const target = e.currentTarget;
              target.src = 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?q=80&w=2000&auto=format&fit=crop'; 
            }}
          />
        </div>
      </div>
    </section>
  );
};
