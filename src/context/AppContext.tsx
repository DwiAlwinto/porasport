"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Venue,
  Booking,
  UserProfile,
  VenueReview,
  SearchFilters,
  SportCategory,
  CityLocation,
  TimeOfDayFilter,
  BookingItem,
  PaymentMethodType,
} from '../types';
import type { UserCategory } from '@prisma/client';
import { getVenues, createBooking } from '../actions/venueActions';
import { getCurrentUserAction, logoutUserAction } from '../actions/userAuthActions';
import { validateAndProcessPaymentProof } from '../actions/paymentValidationActions';
import { parseFiltersFromQuery, serialiseFiltersToQuery } from '../lib/filterUrl';
import { stripPII } from '../lib/sanitize';

interface AppContextType {
  venues: Venue[];
  venuesLoading: boolean;
  venuesError: string | null;
  activeUser: UserProfile | null;
  bookings: Booking[];
  reviews: VenueReview[];
  searchFilters: SearchFilters;
  selectedVenue: Venue | null;
  activeView: 'HOME' | 'EXPLORE' | 'VENUE_DETAIL' | 'USER_DASHBOARD' | 'CHECKOUT';
  isSchemaModalOpen: boolean;
  isCheckoutModalOpen: boolean;
  activeBookingDraft: {
    venueId: string;
    sportCategory: SportCategory;
    userCategory: UserCategory | null;
    items: BookingItem[];
  } | null;

  // Actions
  setActiveUser: (user: UserProfile | null) => void;
  setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  setSelectedVenue: (venue: Venue | null) => void;
  setActiveView: (view: 'HOME' | 'EXPLORE' | 'VENUE_DETAIL' | 'USER_DASHBOARD' | 'CHECKOUT') => void;
  setIsSchemaModalOpen: (open: boolean) => void;
  setIsCheckoutModalOpen: (open: boolean) => void;
  
  // Search actions
  handleSearchSubmit: (sport?: SportCategory, city?: CityLocation, date?: string) => void;
  
  // Booking lifecycle
  startBookingCheckout: (
    venueId: string,
    sportCategory: SportCategory,
    items: BookingItem[],
    userCategory?: UserCategory | null
  ) => void;
  completePayment: (
    bookingId: string,
    method: PaymentMethodType,
    verificationData?: {
      nik?: string;
      npwp?: string;
      senderName?: string;
      senderPhone?: string;
      paymentProofFile?: File;
    }
  ) => Promise<Booking | null>;
  cancelBooking: (bookingId: string) => void;
  addReview: (venueId: string, rating: number, comment: string, sportType: string) => void;
  
  // Mitra actions
  toggleFieldMaintenanceSlot: (venueId: string, fieldId: string, date: string, hour: number) => void;
  addNewVenue: (venue: Venue) => void;

  // Language
  activeLang: 'ID' | 'US';
  setActiveLang: (lang: 'ID' | 'US') => void;

  // Real User Session
  isLoggedIn: boolean;
  logoutUser: () => Promise<void>;
  checkUserSession: () => Promise<void>;
}

const defaultSearchFilters: SearchFilters = {
  sport: 'ALL',
  city: 'ALL',
  date: new Date().toISOString().split('T')[0],
  // null = tanpa batas anggaran, bukan angka tetap yang bisa menyaring venue
  maxPrice: null,
  facilities: [],
  timeOfDay: 'ALL',
  sortBy: 'POPULARITY',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  BOOKINGS: 'gelora_bookings_v3',
  REVIEWS: 'gelora_reviews_v3',
  VENUES: 'gelora_venues_v1000_user_files',
  MAINTENANCE_SLOTS: 'gelora_maintenance_v3',
};

/**
 * Data di browser dibersihkan lewat `stripPII` (src/lib/sanitize.ts) supaya
 * NIK dan NPWP tidak pernah tersimpan di localStorage, dan `clearPersistedData`
 * membersihkannya saat logout.
 */
function clearPersistedData() {
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    // Bersihkan sisa kunci lama dari versi sebelumnya.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('gelora_')) localStorage.removeItem(key);
    }
  } catch {
    // Penyimpanan bisa dinonaktifkan; abaikan.
  }
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [venues, setVenues] = useState<Venue[]>([]);
  // Status pemuatan venue. Tanpa ini halaman Fasilitas sempat menampilkan
  // "tidak ada venue" selama data masih di-fetch.
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  // Load Venues from Server Actions
  useEffect(() => {
    let cancelled = false;

    async function loadVenues() {
      setVenuesLoading(true);
      setVenuesError(null);
      try {
        const data = await getVenues();
        if (cancelled) return;
        // Venue kosong adalah kondisi sah (belum ada data), bukan error.
        setVenues((data ?? []) as Venue[]);
      } catch (e: unknown) {
        if (cancelled) return;
        // Detail error dicatat di server; yang ditampilkan ke pengguna hanya
        // teks generik agar tidak membocorkan detail internal.
        console.error('[AppContext] Gagal memuat venue:', e);
        setVenuesError('Gagal memuat daftar venue dari server. Coba muat ulang halaman.');
      } finally {
        if (!cancelled) setVenuesLoading(false);
      }
    }

    loadVenues();
    return () => {
      cancelled = true;
    };
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);

  // Load real user session from server cookies if present
  const checkUserSession = async () => {
    try {
      const res = await getCurrentUserAction();
      if (res.success && res.user) {
        setIsLoggedIn(true);
        setActiveUser({
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          phone: res.user.phone || '',
          avatar: res.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(res.user.name)}`,
          role: res.user.role as any,
        });
      } else {
        setIsLoggedIn(false);
        setActiveUser(null);
      }
    } catch (e) {
      console.error('Failed to load user session:', e);
      setIsLoggedIn(false);
      setActiveUser(null);
    }
  };

  useEffect(() => {
    checkUserSession();
  }, []);

  const logoutUser = async () => {
    await logoutUserAction();
    // Data di browser ikut dihapus; kalau tidak, NIK/NPWP milik pengguna
    // sebelumnya masih terbaca di komputer yang dipakai bersama.
    clearPersistedData();
    setBookings([]);
    setReviews([]);
    setIsLoggedIn(false);
    setActiveUser(null);
  };
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      const parsed = saved ? JSON.parse(saved) : [];
      // Buang PII yang mungkin tertulis oleh versi lama.
      return Array.isArray(parsed) ? (stripPII(parsed as object[]) as Booking[]) : [];
    } catch {
      return [];
    }
  });

  const [reviews, setReviews] = useState<VenueReview[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [searchFilters, setSearchFilters] = useState<SearchFilters>(defaultSearchFilters);

  // --- Sinkronisasi filter <-> URL ---------------------------------
  // 1. Saat mount, baca filter dari query string supaya hasil pencarian
  //    bisa dibagikan lewat link dan tidak hilang saat di-refresh.
  useEffect(() => {
    const fromUrl = parseFiltersFromQuery(window.location.search, defaultSearchFilters);
    setSearchFilters(fromUrl);
  }, []);

  // 2. Setiap filter berubah, tulis balik ke URL tanpa menambah riwayat,
  //    supaya tombol "back" browser tidak terisi oleh tiap geseran slider.
  useEffect(() => {
    const qs = serialiseFiltersToQuery(searchFilters, defaultSearchFilters);
    const next = `${window.location.pathname}${qs}`;
    window.history.replaceState(null, '', next);
  }, [searchFilters]);

  // 3. Tombol back / forward browser memulihkan filter dari URL.
  useEffect(() => {
    const onPopState = () => {
      setSearchFilters(
        parseFiltersFromQuery(window.location.search, defaultSearchFilters)
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [selectedVenueState, setSelectedVenueState] = useState<Venue | null>(null);
  const selectedVenue = selectedVenueState;
  const setSelectedVenue = (venue: Venue | null) => {
    if (venue) {
      const fresh = venues.find((v) => v.id === venue.id) || venue;
      setSelectedVenueState(fresh);
    } else {
      setSelectedVenueState(null);
    }
  };
  const [activeView, setActiveView] = useState<'HOME' | 'EXPLORE' | 'VENUE_DETAIL' | 'USER_DASHBOARD' | 'CHECKOUT'>('HOME');
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [activeBookingDraft, setActiveBookingDraft] = useState<{
    venueId: string;
    sportCategory: SportCategory;
    userCategory: UserCategory | null;
    items: BookingItem[];
  } | null>(null);
  const [activeLang, setActiveLang] = useState<'ID' | 'US'>('ID');

  // Clean up legacy localStorage venue keys
  useEffect(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('gelora_venues_')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      // Jangan pernah menulis NIK/NPWP ke localStorage.
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(stripPII(bookings)));
    } catch (e) {
      console.error('Failed to save bookings:', e);
    }
  }, [bookings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
    } catch (e) {
      console.error('Failed to save reviews:', e);
    }
  }, [reviews]);

  const handleSearchSubmit = (sport?: SportCategory, city?: CityLocation, date?: string) => {
    setSearchFilters((prev) => ({
      ...prev,
      sport: sport ?? prev.sport,
      city: city ?? prev.city,
      date: date ?? prev.date,
    }));
    setActiveView('EXPLORE');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startBookingCheckout = (
    venueId: string,
    sportCategory: SportCategory,
    items: BookingItem[],
    userCategory: UserCategory | null = null
  ) => {
    setActiveBookingDraft({ venueId, sportCategory, userCategory, items });
    setIsCheckoutModalOpen(false); // Just in case
    setActiveView('CHECKOUT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function completePayment(
    bookingId: string,
    method: PaymentMethodType,
    verificationData?: {
      nik?: string;
      npwp?: string;
      senderName?: string;
      senderPhone?: string;
      paymentProofFile?: File;
    }
  ): Promise<Booking | null> {
    if (!activeBookingDraft || !activeUser) return null;

    const totalAmount = activeBookingDraft.items.reduce((sum, item) => sum + item.price, 0);

    // Step 1: Create booking with PENDING_PAYMENT status
    // `userId` tidak lagi dikirim: server menentukannya dari sesi login.
    const res = await createBooking({
      venueId: activeBookingDraft.venueId,
      totalAmount: totalAmount,
      paymentMethod: method,
      sportCategory: activeBookingDraft.sportCategory as any,
      userCategory: activeBookingDraft.userCategory,
      nik: verificationData?.nik,
      npwp: verificationData?.npwp,
      senderName: verificationData?.senderName,
      senderPhone: verificationData?.senderPhone,
      paymentProofUrl: '', // Will be updated after upload
      items: activeBookingDraft.items.map(i => ({ 
        slotId: i.slotId, 
        fieldId: i.fieldId,
        date: i.date,
        timeStart: i.timeStart,
        timeEnd: i.timeEnd,
        price: i.price,
        isPeakHour: i.isPeakHour
      }))
    });

    if (!res.success || !res.booking) {
      return null;
    }

    const newBookingId = res.booking.id;

    // Step 2: If proof file provided, upload and validate
    if (verificationData?.paymentProofFile) {
      const file = verificationData.paymentProofFile;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const validationResult = await validateAndProcessPaymentProof(
        newBookingId,
        buffer,
        file.name,
        file.type
      );

      // Refresh venues to get updated slots
      const data = await getVenues();
      setVenues(data as any[]);

      // Append new booking to local state with validation result
      const mappedBooking: Booking = {
        id: newBookingId,
        userId: activeUser!.id,
        venueId: activeBookingDraft.venueId,
        venueName: venues.find(v => v.id === activeBookingDraft.venueId)?.name || 'Venue',
        venueAddress: 'Bekasi',
        venueImage: venues.find(v => v.id === activeBookingDraft.venueId)?.images[0] || '',
        sportCategory: activeBookingDraft.sportCategory,
        items: activeBookingDraft.items,
        totalPrice: totalAmount,
        serviceFee: 5000,
        grandTotal: totalAmount + 5000,
        status: validationResult.newStatus === 'PAID_SUCCESS' ? 'PAID_SUCCESS' : 'MENUNGGU_VALIDASI',
        paymentMethod: method,
        createdAt: res.booking.createdAt.toString(),
        expiresAt: new Date(Date.now() + 60 * 60000).toISOString(),
        qrCodeToken: `QR-${newBookingId}`,
        hasReviewed: false,
        nik: verificationData?.nik,
        npwp: verificationData?.npwp,
        senderName: verificationData?.senderName,
        paymentProofUrl: validationResult.ocrResult ? 'uploaded' : undefined,
        ocrValidationResult: validationResult.ocrResult,
        ocrProcessedAt: new Date().toISOString(),
      };

      setBookings(prev => [mappedBooking, ...prev]);
      setActiveBookingDraft(null);
      return mappedBooking;
    }

    // No proof file - just return the pending booking
    const data = await getVenues();
    setVenues(data as any[]);

    const mappedBooking: Booking = {
      id: res.booking.id,
      userId: activeUser!.id,
      venueId: activeBookingDraft.venueId,
      venueName: venues.find(v => v.id === activeBookingDraft.venueId)?.name || 'Venue',
      venueAddress: 'Bekasi',
      venueImage: venues.find(v => v.id === activeBookingDraft.venueId)?.images[0] || '',
      sportCategory: activeBookingDraft.sportCategory,
      items: activeBookingDraft.items,
      totalPrice: totalAmount,
      serviceFee: 5000,
      grandTotal: totalAmount + 5000,
      status: 'PENDING_PAYMENT',
      paymentMethod: method,
      createdAt: res.booking.createdAt.toString(),
      expiresAt: new Date(Date.now() + 60 * 60000).toISOString(),
      qrCodeToken: `QR-${res.booking.id}`,
      hasReviewed: false,
      nik: verificationData?.nik,
      npwp: verificationData?.npwp,
      senderName: verificationData?.senderName,
      paymentProofUrl: undefined,
    };

    setBookings(prev => [mappedBooking, ...prev]);
    setActiveBookingDraft(null);
    return mappedBooking;
  }

  const cancelBooking = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'CANCELLED',
            }
          : b
      )
    );
  };

  const addReview = (venueId: string, rating: number, comment: string, sportType: string) => {
    if (!activeUser) return;
    const newReview: VenueReview = {
      id: `rev-${Date.now()}`,
      venueId,
      userId: activeUser.id,
      userName: activeUser.name,
      userAvatar: activeUser.avatar,
      rating,
      comment,
      createdAt: 'Baru saja',
      sportType,
    };
    setReviews((prev) => [newReview, ...prev]);

    // Mark user booking as reviewed
    setBookings((prev) =>
      prev.map((b) =>
        b.venueId === venueId && b.userId === activeUser.id && b.status === 'COMPLETED'
          ? { ...b, hasReviewed: true }
          : b
      )
    );
  };

  const toggleFieldMaintenanceSlot = (venueId: string, _fieldId: string, _date: string, _hour: number) => {
    // We can simulate maintenance toggle
    setVenues((prev) =>
      prev.map((v) =>
        v.id === venueId
          ? {
              ...v,
              updatedAt: new Date().toISOString(),
            }
          : v
      )
    );
  };

  const addNewVenue = (newVenue: Venue) => {
    setVenues((prev) => [newVenue, ...prev]);
  };

  return (
    <AppContext.Provider
      value={{
        venues,
        venuesLoading,
        venuesError,
        activeUser,
        bookings,
        reviews,
        searchFilters,
        selectedVenue,
        activeView,
        isSchemaModalOpen,
        isCheckoutModalOpen,
        activeBookingDraft,
        setActiveUser,
        setSearchFilters,
        setSelectedVenue,
        setActiveView,
        setIsSchemaModalOpen,
        setIsCheckoutModalOpen,
        handleSearchSubmit,
        startBookingCheckout,
        completePayment,
        cancelBooking,
        addReview,
        toggleFieldMaintenanceSlot,
        addNewVenue,
        activeLang,
        setActiveLang,
        isLoggedIn,
        logoutUser,
        checkUserSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
