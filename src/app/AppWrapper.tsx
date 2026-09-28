"use client";

import React from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { Navbar } from '../components/navbar/Navbar';
import { Footer } from '../components/footer/Footer';
import { HomeView } from '../components/home/HomeView';
import { ExplorePage } from '../components/explore/ExplorePage';
import { VenueDetailPage } from '../components/venue/VenueDetailPage';
import { UserDashboard } from '../components/user/UserDashboard';
import { DatabaseSchemaModal } from '../components/schema/DatabaseSchemaModal';
import { CheckoutPage } from '../components/checkout/CheckoutPage';

// CATATAN KEAMANAN: AdminDashboard dan MitraDashboard tidak lagi di-mount di sini.
// Dulu keduanya hanya disembunyikan lewat state React `activeView`, padahal
// seluruh kodenya ikut ter-bundle ke setiap pengunjung dan bisa dimunculkan
// dengan mengubah state lewat devtools. Portal admin yang sebenarnya ada di
// route /admin/* yang dilindungi server (lihat src/proxy.ts dan
// requireAdminSession). Dashboard mitra yang tersisa di repo ini adalah mock
// dengan data statis, jadi dihapus.

const AppContent: React.FC = () => {
  const { activeView, isLoggedIn } = useApp();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="flex-1">
        {activeView === 'HOME' && <HomeView />}
        {activeView === 'EXPLORE' && <ExplorePage />}
        {activeView === 'VENUE_DETAIL' && <VenueDetailPage />}
        {activeView === 'USER_DASHBOARD' && (isLoggedIn ? <UserDashboard /> : <HomeView />)}
        {activeView === 'CHECKOUT' && <CheckoutPage />}
      </main>

      <Footer />

      {/* Modals */}
      <DatabaseSchemaModal />
    </div>
  );
};

export default function AppWrapper() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
