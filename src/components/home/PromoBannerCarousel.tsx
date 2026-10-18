"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { getPromoBanners } from '../../actions/bannerActions';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PromoBannerCarousel: React.FC = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Hanya ambil banner yang aktif
      const data = await getPromoBanners(true);
      setBanners(data);
      setIsLoading(false);
    }
    load();
  }, []);

  // Autoplay functionality
  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // 5 seconds
    
    return () => clearInterval(interval);
  }, [banners.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  }, [banners.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 mt-16 mb-24 animate-pulse">
        <div className="w-full aspect-[16/9] md:aspect-[21/9] bg-slate-200 rounded-3xl"></div>
      </div>
    );
  }

  if (banners.length === 0) {
    return null; // Don't show anything if no active banners
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mt-8 mb-24">
      <div className="relative rounded-3xl overflow-hidden bg-slate-100 shadow-xl shadow-slate-200/50 group">
        
        {/* Banner Images */}
        <div 
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {banners.map((banner) => {
            if (banner.linkUrl) {
              const isExternal = banner.linkUrl.startsWith('http://') || banner.linkUrl.startsWith('https://');
              return (
                <a
                  key={banner.id}
                  href={banner.linkUrl}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  className="w-full shrink-0 relative aspect-[16/9] md:aspect-[21/9] block cursor-pointer group/slide"
                  title={banner.title || 'Promo Banner'}
                >
                  <Image 
                    src={banner.imageUrl} 
                    alt={banner.title || 'Promo Banner'} 
                    fill 
                    className="object-cover transition-transform duration-500 group-hover/slide:scale-[1.01]"
                    priority={currentIndex === 0}
                  />
                </a>
              );
            }

            return (
              <div key={banner.id} className="w-full shrink-0 relative aspect-[16/9] md:aspect-[21/9]">
                <Image 
                  src={banner.imageUrl} 
                  alt={banner.title || 'Promo Banner'} 
                  fill 
                  className="object-cover"
                  priority={currentIndex === 0}
                />
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows (Hanya tampil jika banner > 1) */}
        {banners.length > 1 && (
          <>
            <button 
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-emerald-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white hover:scale-110 focus:outline-none"
              aria-label="Previous banner"
            >
              <ChevronLeft className="w-6 h-6 ml-0.5" />
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-emerald-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white hover:scale-110 focus:outline-none"
              aria-label="Next banner"
            >
              <ChevronRight className="w-6 h-6 mr-0.5" />
            </button>

            {/* Dots Indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`transition-all rounded-full ${
                    idx === currentIndex 
                      ? 'w-6 h-2 bg-emerald-500 shadow-sm' 
                      : 'w-2 h-2 bg-white/60 hover:bg-white/90'
                  }`}
                  aria-label={`Go to banner ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
