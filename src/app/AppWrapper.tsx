"use client";

import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { Navbar } from '../components/navbar/Navbar';
import { Footer } from '../components/footer/Footer';
import { HomeView } from '../components/home/HomeView';
import { ExplorePage } from '../components/explore/ExplorePage';
import { VenueDetailPage } from '../components/venue/VenueDetailPage';
import { UserDashboard } from '../components/user/UserDashboard';
import { DatabaseSchemaModal } from '../components/schema/DatabaseSchemaModal';
import { CheckoutPage } from '../components/checkout/CheckoutPage';
import { isServerActionMismatchError, handleServerActionMismatch } from '../lib/actionErrorHandler';

// CATATAN KEAMANAN: AdminDashboard dan MitraDashboard tidak lagi di-mount di sini.
// Dulu keduanya hanya disembunyikan lewat state React `activeView`, padahal
// seluruh kodenya ikut ter-bundle ke setiap pengunjung dan bisa dimunculkan
// dengan mengubah state lewat devtools. Portal admin yang sebenarnya ada di
// route /admin/* yang dilindungi server (lihat src/proxy.ts dan
// requireAdminSession). Dashboard mitra yang tersisa di repo ini adalah mock
// dengan data statis, jadi dihapus.

const AppContent: React.FC = () => {
  const { activeView, isLoggedIn, isSessionChecking, isMounted } = useApp();
  const [isUpdatingVersion, setIsUpdatingVersion] = useState(false);

  // Deteksi global jika ada Server Action yang versinya tidak cocok karena deployment baru
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (isServerActionMismatchError(reason)) {
        event.preventDefault();
        setIsUpdatingVersion(true);
        handleServerActionMismatch();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 font-sans">
        <Navbar />
        <main className="flex-1 flex items-center justify-center min-h-[50vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#05BB75] border-t-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="flex-1">
        {activeView === 'HOME' && <HomeView />}
        {activeView === 'EXPLORE' && <ExplorePage />}
        {activeView === 'VENUE_DETAIL' && <VenueDetailPage />}
        {activeView === 'USER_DASHBOARD' && (
          isSessionChecking ? (
            <div className="min-h-[50vh] flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#05BB75] border-t-transparent" />
            </div>
          ) : isLoggedIn ? (
            <UserDashboard />
          ) : (
            <HomeView />
          )
        )}
        {activeView === 'CHECKOUT' && <CheckoutPage />}
      </main>

      <Footer />

      {/* Modals */}
      <DatabaseSchemaModal />

      {/* Notifikasi Pembaruan Versi Server */}
      {isUpdatingVersion && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-slate-900/95 px-5 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent shrink-0" />
          <span>Versi aplikasi telah diperbarui oleh server. Memuat ulang halaman...</span>
        </div>
      )}
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
