"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';
import { adminLogoutAction } from '../../actions/authActions';

// Konfigurasi Batas Waktu Keamanan Admin DISBUDPORA
const IDLE_TIMEOUT_SECONDS = 20 * 60; // 20 Menit (1200 detik)
const WARNING_WINDOW_SECONDS = 2 * 60; // Peringatan muncul 2 menit sebelum logout (120 detik)
const STORAGE_KEY = 'porasport_admin_last_activity_v1';

export const AdminIdleTimeout: React.FC = () => {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(IDLE_TIMEOUT_SECONDS);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const lastRecordedActivityRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);

  // Fungsi logout yang aman
  const performLogout = useCallback(async (reason: 'timeout' | 'manual' = 'timeout') => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);

    try {
      localStorage.removeItem(STORAGE_KEY);
      await adminLogoutAction();
    } catch (err) {
      console.error('[AdminIdleTimeout] Error during logout:', err);
    } finally {
      const targetUrl = reason === 'timeout' ? '/admin/login?reason=timeout' : '/admin/login';
      window.location.href = targetUrl;
    }
  }, []);

  // Perbarui stempel waktu aktivitas terakhir (dengan sinkronisasi multi-tab)
  const recordActivity = useCallback(() => {
    const now = Date.now();
    // Throttle agar tidak menulis ke localStorage di setiap piksel mouse move (minimal jeda 3 detik)
    if (now - lastRecordedActivityRef.current < 3000) return;

    lastRecordedActivityRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, now.toString());
    } catch {}

    // Jika modal peringatan sedang terbuka dan pengguna berinteraksi lagi, tutup peringatan
    if (showWarningModal) {
      setShowWarningModal(false);
      setSecondsRemaining(IDLE_TIMEOUT_SECONDS);
    }
  }, [showWarningModal]);

  // Tombol "Tetap Masuk"
  const handleStayLoggedIn = () => {
    const now = Date.now();
    lastRecordedActivityRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, now.toString());
    } catch {}
    setShowWarningModal(false);
    setSecondsRemaining(IDLE_TIMEOUT_SECONDS);
  };

  useEffect(() => {
    // Inisialisasi awal timestamp jika belum ada
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing) {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      } else {
        lastRecordedActivityRef.current = parseInt(existing, 10) || Date.now();
      }
    } catch {}

    // Pasang pendengar event aktivitas pengguna
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserEvent = () => recordActivity();

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserEvent, { passive: true });
    });

    // Sinkronisasi antar-tab browser via event storage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime)) {
          lastRecordedActivityRef.current = remoteTime;
          setShowWarningModal(false);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Heartbeat Interval: Cek inaktivitas setiap 1 detik
    const timerInterval = setInterval(() => {
      if (isLoggingOutRef.current) return;

      let lastActive = lastRecordedActivityRef.current;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > lastActive) {
            lastActive = parsed;
            lastRecordedActivityRef.current = parsed;
          }
        }
      } catch {}

      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastActive) / 1000);
      const remaining = Math.max(0, IDLE_TIMEOUT_SECONDS - elapsedSeconds);

      setSecondsRemaining(remaining);

      // Jika waktu habis (20 menit tanpa aktivitas) -> Auto Logout
      if (remaining <= 0) {
        clearInterval(timerInterval);
        performLogout('timeout');
        return;
      }

      // Jika tersisa <= 2 menit (120 detik) -> Tampilkan modal peringatan
      if (remaining <= WARNING_WINDOW_SECONDS) {
        setShowWarningModal(true);
      } else {
        setShowWarningModal(false);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserEvent);
      });
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(timerInterval);
    };
  }, [recordActivity, performLogout]);

  // Format detik ke format menit dan detik (MM:SS)
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!showWarningModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-3xl border border-line bg-surface p-6 sm:p-7 text-center shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pulsing Warning Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/10">
          <Clock className="h-8 w-8 animate-pulse text-amber-600" />
        </div>

        {/* Security Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-800 mb-3">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Sistem Keamanan DISBUDPORA Kab. Bekasi</span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-black text-fg">
          Sesi Anda Akan Berakhir Demi Keamanan
        </h3>

        {/* Description */}
        <p className="mt-2 text-xs text-fg-muted leading-relaxed">
          Tidak ada aktivitas terdeteksi selama 18 menit. Demi mencegah penyalahgunaan saat komputer ditinggalkan, sesi administrator Anda akan otomatis ditutup dalam:
        </p>

        {/* Countdown Timer Display */}
        <div className="my-5 flex items-center justify-center">
          <div className="rounded-2xl border border-amber-300 bg-amber-50/80 px-6 py-2.5 font-mono text-2xl font-black text-amber-900 shadow-inner">
            {formatTime(secondsRemaining)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 mt-6">
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={() => performLogout('manual')}
            className="flex-1 rounded-xl border border-line-strong py-3 text-xs font-bold text-fg-muted hover:bg-subtle hover:text-fg transition flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout Sekarang</span>
          </button>

          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleStayLoggedIn}
            className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Tetap Masuk</span>
          </button>
        </div>
      </div>
    </div>
  );
};
