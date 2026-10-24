"use client";
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
import {
  getVenues,
  createBooking,
  updateBookingCustomerDetailsAction,
  getMyBookingsAction,
  cancelUserBookingAction,
  completeUserBookingAction,
  submitVenueReviewAction,
} from '../actions/venueActions';
import { getCurrentUserAction, logoutUserAction } from '../actions/userAuthActions';
import { validateAndProcessPaymentProof, uploadPaymentProofAction } from '../actions/paymentValidationActions';
import { getSystemSettings } from '../actions/settingsActions';
import { parseFiltersFromQuery, serialiseFiltersToQuery } from '../lib/filterUrl';
import { parseRouteFromUrl, buildRouteUrl, type AppView } from '../lib/navigationUrl';
import { getWibTodayKey } from '../lib/dateKeys';
import { stripPII } from '../lib/sanitize';
import { TRANSLATIONS, type TranslationDictionary } from '../utils/translations';

interface AppContextType {
  venues: Venue[];
  venuesLoading: boolean;
  venuesError: string | null;
  systemSettings: Record<string, string>;
  refreshSystemSettings: () => Promise<void>;
  activeUser: UserProfile | null;
  bookings: Booking[];
  reviews: VenueReview[];
  searchFilters: SearchFilters;
  selectedVenue: Venue | null;
  activeView: AppView;
  isSchemaModalOpen: boolean;
  isCheckoutModalOpen: boolean;
  activeBookingDraft: {
    venueId: string;
    sportCategory: SportCategory;
    userCategory: UserCategory | null;
    userCategoryLabel?: string | null;
    rateId?: string | null;
    items: BookingItem[];
    bookingId?: string | null;
    expiresAt?: string | null;
  } | null;

  // Actions
  setActiveUser: (user: UserProfile | null) => void;
  setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  setSelectedVenue: (venue: Venue | null) => void;
  setActiveView: (view: AppView) => void;
  setIsSchemaModalOpen: (open: boolean) => void;
  setIsCheckoutModalOpen: (open: boolean) => void;
  setActiveBookingDraft: (draft: any) => void;
  cancelActiveBookingDraft: () => void;
  
  // Search actions
  handleSearchSubmit: (sport?: SportCategory, city?: CityLocation, date?: string) => void;
  
  // Booking lifecycle
  startBookingCheckout: (
    venueId: string,
    sportCategory: SportCategory,
    items: BookingItem[],
    userCategory?: UserCategory | null,
    rateId?: string | null,
    userCategoryLabel?: string | null,
    bookingId?: string | null,
    expiresAt?: string | Date | null
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
  uploadPaymentProofForBooking: (bookingId: string, file: File) => Promise<{ success: boolean; error?: string }>;
  cancelBooking: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  completeBooking: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  refreshBookings: () => Promise<void>;
  bookingsLoading: boolean;
  addReview: (venueId: string, rating: number, comment: string, sportType: string, bookingId?: string) => Promise<boolean>;
  
  // Mitra actions
  toggleFieldMaintenanceSlot: (venueId: string, fieldId: string, date: string, hour: number) => void;
  addNewVenue: (venue: Venue) => void;

  // Language
  activeLang: 'ID' | 'US';
  setActiveLang: (lang: 'ID' | 'US') => void;
  t: TranslationDictionary;

  // Real User Session
  isLoggedIn: boolean;
  isSessionChecking: boolean;
  isMounted: boolean;
  logoutUser: () => Promise<void>;
  checkUserSession: () => Promise<void>;
}

const defaultSearchFilters: SearchFilters = {
  sport: 'ALL',
  city: 'ALL',
  date: getWibTodayKey(),
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

  // System Settings (WhatsApp, Footer, Kontak, dll.)
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});

  const refreshSystemSettings = async () => {
    try {
      const data = await getSystemSettings();
      setSystemSettings(data);
    } catch (e) {
      console.error('[AppContext] Gagal memuat system settings:', e);
    }
  };

  useEffect(() => {
    refreshSystemSettings();
  }, []);

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
  const [isSessionChecking, setIsSessionChecking] = useState(true);

  // Load real user session from server cookies if present
  const checkUserSession = async () => {
    setIsSessionChecking(true);
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
    } finally {
      setIsSessionChecking(false);
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
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const refreshBookings = async () => {
    try {
      setBookingsLoading(true);
      const res = await getMyBookingsAction();
      if (res.success && res.bookings) {
        setBookings(res.bookings as Booking[]);
        try {
          localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(stripPII(res.bookings as object[])));
        } catch {}
      }
    } catch (err) {
      console.error('[AppContext] Gagal memuat pesanan pengguna dari server:', err);
    } finally {
      setBookingsLoading(false);
    }
  };

  // Sinkronisasi pesanan pengguna dari database saat login aktif
  useEffect(() => {
    if (isLoggedIn && activeUser) {
      refreshBookings();
    }
  }, [isLoggedIn, activeUser?.id]);

  const [reviews, setReviews] = useState<VenueReview[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [searchFilters, setSearchFilters] = useState<SearchFilters>(defaultSearchFilters);
  const [activeView, setActiveView] = useState<AppView>('HOME');
  const [selectedVenueState, setSelectedVenueState] = useState<Venue | null>(null);
  const [pendingVenueId, setPendingVenueId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const selectedVenue = selectedVenueState;
  const setSelectedVenue = (venue: Venue | null) => {
    if (venue) {
      const fresh = venues.find((v) => v.id === venue.id) || venue;
      setSelectedVenueState(fresh);
      setPendingVenueId(fresh.id);
    } else {
      setSelectedVenueState(null);
      setPendingVenueId(null);
    }
  };

  const isNavigatingFromPopState = useRef(false);
  const lastPushedView = useRef<AppView>('HOME');
  const lastPushedVenueId = useRef<string | null>(null);
  const isInitialMount = useRef(true);

  // --- 1. Saat pertama mount: baca rute & filter dari URL -----------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { view, venueId } = parseRouteFromUrl(window.location.pathname, window.location.search);
    const fromUrlFilters = parseFiltersFromQuery(window.location.search, defaultSearchFilters);

    setActiveView(view);
    setSearchFilters(fromUrlFilters);
    if (view !== 'CHECKOUT') {
      try {
        sessionStorage.removeItem('gelora_checkout_draft_v1');
        sessionStorage.removeItem('gelora_checkout_end_time_v1');
      } catch {}
    }
    if (venueId) {
      setPendingVenueId(venueId);
    }

    lastPushedView.current = view;
    lastPushedVenueId.current = venueId;
    setIsMounted(true);
  }, []);

  // --- 2. Pasangkan pendingVenueId dengan venues setelah di-fetch ---------
  useEffect(() => {
    if (pendingVenueId && venues.length > 0) {
      const match = venues.find((v) => v.id === pendingVenueId);
      if (match) {
        setSelectedVenueState(match);
      }
    }
  }, [pendingVenueId, venues]);

  // --- 3. Sinkronisasi activeView, selectedVenue, searchFilters -> URL ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isNavigatingFromPopState.current) {
      isNavigatingFromPopState.current = false;
      return;
    }

    const currentVenueId = activeView === 'VENUE_DETAIL' ? (selectedVenueState?.id || pendingVenueId) : null;
    const filterQs = serialiseFiltersToQuery(searchFilters, defaultSearchFilters);
    const targetUrl = buildRouteUrl(activeView, currentVenueId, filterQs);
    const currentFullUrl = `${window.location.pathname}${window.location.search}`;

    if (targetUrl !== currentFullUrl) {
      const isViewChanged = lastPushedView.current !== activeView || lastPushedVenueId.current !== currentVenueId;
      if (isViewChanged) {
        window.history.pushState(null, '', targetUrl);
        lastPushedView.current = activeView;
        lastPushedVenueId.current = currentVenueId;
      } else {
        window.history.replaceState(null, '', targetUrl);
      }
    }
  }, [activeView, selectedVenueState, pendingVenueId, searchFilters]);

  // --- 4. Dukungan tombol Back / Forward browser (popstate) ---------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      isNavigatingFromPopState.current = true;
      const { view, venueId } = parseRouteFromUrl(window.location.pathname, window.location.search);
      const fromUrlFilters = parseFiltersFromQuery(window.location.search, defaultSearchFilters);

      if (lastPushedView.current === 'CHECKOUT' && view !== 'CHECKOUT') {
        setActiveBookingDraft(null);
        try {
          sessionStorage.removeItem('gelora_checkout_draft_v1');
          sessionStorage.removeItem('gelora_checkout_end_time_v1');
        } catch {}
      }

      setActiveView(view);
      setSearchFilters(fromUrlFilters);

      if (venueId) {
        setPendingVenueId(venueId);
        const match = venues.find((v) => v.id === venueId);
        setSelectedVenueState(match || null);
      } else {
        setSelectedVenueState(null);
        setPendingVenueId(null);
      }

      lastPushedView.current = view;
      lastPushedVenueId.current = venueId;
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [venues]);

  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [activeBookingDraft, setActiveBookingDraft] = useState<{
    venueId: string;
    sportCategory: SportCategory;
    userCategory: UserCategory | null;
    userCategoryLabel?: string | null;
    rateId?: string | null;
    items: BookingItem[];
    bookingId?: string | null;
    expiresAt?: string | null;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem('gelora_checkout_draft_v1');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeLang, setActiveLangState] = useState<'ID' | 'US'>(() => {
    if (typeof window === 'undefined') return 'ID';
    try {
      const saved = localStorage.getItem('sport_bekasi_lang');
      return saved === 'US' ? 'US' : 'ID';
    } catch {
      return 'ID';
    }
  });

  const setActiveLang = (lang: 'ID' | 'US') => {
    setActiveLangState(lang);
    try {
      localStorage.setItem('sport_bekasi_lang', lang);
    } catch {
      // ignore
    }
  };

  const t = TRANSLATIONS[activeLang] || TRANSLATIONS.ID;

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
    userCategory: UserCategory | null = null,
    rateId?: string | null,
    userCategoryLabel?: string | null,
    bookingId?: string | null,
    expiresAt?: string | Date | null
  ) => {
    const expiresAtStr = expiresAt ? new Date(expiresAt).toISOString() : null;
    const draft = { venueId, sportCategory, userCategory, userCategoryLabel, rateId, items, bookingId, expiresAt: expiresAtStr };
    setActiveBookingDraft(draft);
    try {
      sessionStorage.setItem('gelora_checkout_draft_v1', JSON.stringify(draft));
      const endTimeMs = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 600 * 1000;
      sessionStorage.setItem('gelora_checkout_end_time_v1', endTimeMs.toString());
    } catch {
      // Penyimpanan dinonaktifkan
    }
    setIsCheckoutModalOpen(false); // Just in case
    setActiveView('CHECKOUT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelActiveBookingDraft = async () => {
    const bookingIdToCancel = activeBookingDraft?.bookingId;
    setActiveBookingDraft(null);
    try {
      sessionStorage.removeItem('gelora_checkout_draft_v1');
      sessionStorage.removeItem('gelora_checkout_end_time_v1');
    } catch {}

    if (bookingIdToCancel) {
      try {
        await cancelUserBookingAction(bookingIdToCancel);
        await refreshBookings();
      } catch (err) {
        console.error('[cancelActiveBookingDraft] Gagal membatalkan booking di server:', err);
      }
    }
  };

  const handleSetActiveView = (view: AppView) => {
    if (activeView === 'CHECKOUT' && view !== 'CHECKOUT') {
      cancelActiveBookingDraft();
    }
    setActiveView(view);
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
    let newBookingId = activeBookingDraft.bookingId;
    let bookingCreatedAt = new Date().toISOString();

    if (newBookingId) {
      // Booking sudah dikunci riil di database saat pre-hold. Update identitas pemesan
      const updateRes = await updateBookingCustomerDetailsAction({
        bookingId: newBookingId,
        nik: verificationData?.nik,
        npwp: verificationData?.npwp,
        senderName: verificationData?.senderName,
        senderPhone: verificationData?.senderPhone,
      });

      if (!updateRes.success) {
        throw new Error(updateRes.error || 'Gagal memperbarui data pemesan.');
      }
    } else {
      // Fallback: Create booking with PENDING_PAYMENT status jika belum di-prehold
      const res = await createBooking({
        venueId: activeBookingDraft.venueId,
        totalAmount: totalAmount,
        paymentMethod: method,
        sportCategory: activeBookingDraft.sportCategory as any,
        userCategory: activeBookingDraft.userCategory,
        rateId: activeBookingDraft.rateId || undefined,
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
          isPeakHour: i.isPeakHour,
          quantity: i.quantity || 1,
        }))
      });

      if (!res.success || !res.booking) {
        return null;
      }

      newBookingId = res.booking.id;
      bookingCreatedAt = res.booking.createdAt.toString();
    }

    // Step 2: If proof file provided, upload and validate
    if (verificationData?.paymentProofFile) {
      const file = verificationData.paymentProofFile;
      const formData = new FormData();
      formData.append('bookingId', newBookingId);
      formData.append('file', file);
      
      const validationResult = await uploadPaymentProofAction(formData);

      if (!validationResult.success) {
        throw new Error(validationResult.error || 'Gagal mengunggah dan memvalidasi bukti pembayaran.');
      }

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
        serviceFee: 0,
        grandTotal: totalAmount,
        status: validationResult.newStatus === 'PAID_SUCCESS' ? 'PAID_SUCCESS' : ((validationResult.newStatus as any) || 'MENUNGGU_VALIDASI'),
        paymentMethod: method,
        createdAt: bookingCreatedAt,
        expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
        qrCodeToken: `QR-${newBookingId}`,
        hasReviewed: false,
        nik: verificationData?.nik,
        npwp: verificationData?.npwp,
        senderName: verificationData?.senderName,
        paymentProofUrl: 'uploaded',
        ocrValidationResult: validationResult.ocrResult,
        ocrProcessedAt: new Date().toISOString(),
      };

      setBookings(prev => [mappedBooking, ...prev]);
      try {
        sessionStorage.removeItem('gelora_checkout_draft_v1');
        sessionStorage.removeItem('gelora_checkout_end_time_v1');
      } catch {}
      await refreshBookings();
      // Draft tidak langsung diset null di sini agar CheckoutPage dan CheckoutModal
      // tidak mengalami glitch/flash "Tidak Ada Pesanan Aktif" sebelum selesai me-render completedBooking
      return mappedBooking;
    }

    // No proof file - just return the pending booking
    const data = await getVenues();
    setVenues(data as any[]);

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
      serviceFee: 0,
      grandTotal: totalAmount,
      status: 'PENDING_PAYMENT',
      paymentMethod: method,
      createdAt: bookingCreatedAt,
      expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
      qrCodeToken: `QR-${newBookingId}`,
      hasReviewed: false,
      nik: verificationData?.nik,
      npwp: verificationData?.npwp,
      senderName: verificationData?.senderName,
      paymentProofUrl: undefined,
    };

    setBookings(prev => [mappedBooking, ...prev]);
    try {
      sessionStorage.removeItem('gelora_checkout_draft_v1');
    } catch {}
    setActiveBookingDraft(null);
    return mappedBooking;
  }

  const uploadPaymentProofForBooking = async (
    bookingId: string,
    file: File
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const formData = new FormData();
      formData.append('bookingId', bookingId);
      formData.append('file', file);
      const res = await uploadPaymentProofAction(formData);
      if (res.success) {
        await refreshBookings();
        return { success: true };
      }
      return { success: false, error: res.error || 'Gagal mengunggah bukti pembayaran.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Terjadi kesalahan sistem saat unggah bukti.' };
    }
  };

  const cancelBooking = async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await cancelUserBookingAction(bookingId);
      if (res.success) {
        await refreshBookings();
        return { success: true };
      } else {
        return { success: false, error: res.error || 'Gagal membatalkan pesanan.' };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Terjadi kesalahan saat membatalkan pesanan.' };
    }
  };

  const completeBooking = async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await completeUserBookingAction(bookingId);
      if (res.success) {
        await refreshBookings();
        return { success: true };
      } else {
        return { success: false, error: res.error || 'Gagal menyelesaikan pesanan.' };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Terjadi kesalahan saat menyelesaikan pesanan.' };
    }
  };

  const addReview = async (
    venueId: string,
    rating: number,
    comment: string,
    sportType: string,
    bookingId?: string
  ): Promise<boolean> => {
    if (!activeUser) return false;
    try {
      const res = await submitVenueReviewAction({
        bookingId,
        venueId,
        rating,
        comment,
        sportType,
      });

      if (!res.success) {
        alert(res.error || 'Gagal mengirimkan ulasan.');
        return false;
      }

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

      // Mark user booking as reviewed in state
      setBookings((prev) =>
        prev.map((b) =>
          b.venueId === venueId && b.userId === activeUser.id
            ? { ...b, hasReviewed: true }
            : b
        )
      );

      // Refresh venues from server so updated rating is visible
      const updatedVenues = await getVenues();
      setVenues((updatedVenues ?? []) as Venue[]);

      await refreshBookings();
      return true;
    } catch (e: any) {
      console.error('[addReview] Error:', e);
      alert('Terjadi kesalahan saat mengirimkan ulasan.');
      return false;
    }
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
        systemSettings,
        refreshSystemSettings,
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
        setActiveView: handleSetActiveView,
        setIsSchemaModalOpen,
        setIsCheckoutModalOpen,
        setActiveBookingDraft,
        cancelActiveBookingDraft,
        handleSearchSubmit,
        startBookingCheckout,
        completePayment,
        uploadPaymentProofForBooking,
        cancelBooking,
        completeBooking,
        refreshBookings,
        bookingsLoading,
        addReview,
        toggleFieldMaintenanceSlot,
        addNewVenue,
        activeLang,
        setActiveLang,
        t,
        isLoggedIn,
        isSessionChecking,
        isMounted,
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
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[useApp] Peringatan: useApp dipanggil di luar AppProvider. Komponen menggunakan safe fallback.');
    }
    return {
      venues: [],
      venuesLoading: false,
      venuesError: null,
      systemSettings: {},
      refreshSystemSettings: async () => {},
      activeUser: null,
      bookings: [],
      reviews: [],
      searchFilters: defaultSearchFilters,
      selectedVenue: null,
      activeView: 'HOME',
      isSchemaModalOpen: false,
      isCheckoutModalOpen: false,
      activeBookingDraft: null,
      setActiveUser: () => {},
      setSearchFilters: () => {},
      setSelectedVenue: () => {},
      setActiveView: () => {},
      setIsSchemaModalOpen: () => {},
      setIsCheckoutModalOpen: () => {},
      setActiveBookingDraft: () => {},
      cancelActiveBookingDraft: () => {},
      handleSearchSubmit: () => {},
      startBookingCheckout: () => {},
      completePayment: async () => null,
      uploadPaymentProofForBooking: async () => ({ success: false, error: 'Di luar AppProvider' }),
      cancelBooking: async () => ({ success: false, error: 'Di luar AppProvider' }),
      completeBooking: async () => ({ success: false, error: 'Di luar AppProvider' }),
      refreshBookings: async () => {},
      bookingsLoading: false,
      addReview: async () => false,
      toggleFieldMaintenanceSlot: () => {},
      addNewVenue: () => {},
      activeLang: 'ID',
      setActiveLang: () => {},
      t: TRANSLATIONS.ID,
      isLoggedIn: false,
      isSessionChecking: false,
      isMounted: true,
      logoutUser: async () => {},
      checkUserSession: async () => {},
    } as AppContextType;
  }
  return context;
};
