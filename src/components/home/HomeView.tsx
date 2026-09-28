import React from 'react';
import { HeroSection } from './HeroSection';
import { PromoBanner } from './PromoBanner';
import { RecommendedVenues } from './RecommendedVenues';
import { PromoBannerCarousel } from './PromoBannerCarousel';

export const HomeView: React.FC = () => {
  return (
    <div className="min-h-screen bg-white pb-12">
      <HeroSection />
      <PromoBanner />
      <RecommendedVenues />
      <PromoBannerCarousel />
    </div>
  );
};
