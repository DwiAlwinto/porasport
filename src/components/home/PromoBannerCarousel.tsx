"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { getPromoBanners } from '../../actions/bannerActions';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PromoBannerCarousel: React.FC = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Touch Swipe state untuk navigasi layar sentuh (mobile)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      // Hanya ambil banner yang aktif
      const data = await getPromoBanners(true);
      setBanners(data);
      setIsLoading(false);
    }
    load();
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  }, [banners.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  // Autoplay functionality (dijeda jika user mengarahkan kursor atau menyentuh layar)
  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      handleNext();
    }, 5000); // 5 detik
    
    return () => clearInterval(interval);
  }, [banners.length, isPaused, handleNext]);

  // Touch Gesture Event Handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    setIsPaused(false);
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrevious();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 mt-8 mb-20 animate-pulse">
        <div className="w-full aspect-[12/5] bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  if (banners.length === 0) {
    return null; // Tidak menampilkan apa-apa jika tidak ada banner aktif
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mt-8 mb-20">
      {/* Kontainer banner dengan rasio aspek proporsional 2.4:1 (12/5) & border-radius aman rounded-2xl */}
      <div 
        className="relative rounded-2xl overflow-hidden bg-slate-100 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/80 group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        
        {/* Banner Images Slider */}
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
                  className="w-full shrink-0 relative aspect-[12/5] block cursor-pointer group/slide bg-slate-100"
                  title={banner.title || 'Promo Banner'}
                >
                  <Image 
                    src={banner.imageUrl} 
                    alt={banner.title || 'Promo Banner'} 
                    fill 
                    className="object-cover object-center transition-transform duration-500 group-hover/slide:scale-[1.01]"
                    priority={currentIndex === 0}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1152px"
                  />
                </a>
              );
            }

            return (
              <div 
                key={banner.id} 
                className="w-full shrink-0 relative aspect-[12/5] bg-slate-100"
              >
                <Image 
                  src={banner.imageUrl} 
                  alt={banner.title || 'Promo Banner'} 
                  fill 
                  className="object-cover object-center"
                  priority={currentIndex === 0}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1152px"
                />
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows (Hanya tampil jika banner > 1) */}
        {banners.length > 1 && (
          <>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePrevious();
              }}
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-white hover:text-emerald-700 hover:scale-105 focus:outline-none ring-1 ring-black/5"
              aria-label="Previous banner"
            >
              <ChevronLeft className="w-5 h-5 ml-[-1px]" />
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-white hover:text-emerald-700 hover:scale-105 focus:outline-none ring-1 ring-black/5"
              aria-label="Next banner"
            >
              <ChevronRight className="w-5 h-5 mr-[-1px]" />
            </button>
          </>
        )}
      </div>

      {/* Dots Indicator di Luar Gambar Banner (Agar tidak menutupi teks, logo, atau grafik bagian bawah) */}
      {banners.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`transition-all duration-300 rounded-full focus:outline-none ${
                idx === currentIndex 
                  ? 'w-7 h-2 bg-emerald-600 shadow-sm shadow-emerald-500/30' 
                  : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
              }`}
              aria-label={`Go to banner ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
