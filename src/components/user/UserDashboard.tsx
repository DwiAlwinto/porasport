import React, { useState } from 'react';
import { handleImageError, getFallbackImageForUrl } from '../../utils/imageUtils';
import { useApp } from '../../context/AppContext';
import {
  Booking,
  BookingStatus,
} from '../../types';
import {
  Calendar,
  Clock,
  QrCode,
  Star,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
  MessageSquare,
  User as UserIcon,
  Phone,
  Mail,
  Building2,
  ArrowRight,
} from 'lucide-react';

export const UserDashboard: React.FC = () => {
  const {
    activeUser,
    setActiveUser,
    bookings,
    cancelBooking,
    addReview,
    setActiveView,
    venues,
    t,
    activeLang,
  } = useApp();

  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [reviewModalBooking, setReviewModalBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [activeQrModalBooking, setActiveQrModalBooking] = useState<Booking | null>(null);

  // Filter user bookings
  const userBookings = bookings.filter((b) => b.userId === activeUser?.id);
  const filteredBookings = userBookings.filter((b) => {
    if (statusTab === 'ALL') return true;
    return b.status === statusTab;
  });

  const handleOpenReviewModal = (booking: Booking) => {
    setReviewModalBooking(booking);
    setRating(5);
    setComment('');
  };

  const handleSendReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalBooking) return;
    addReview(
      reviewModalBooking.venueId,
      rating,
      comment,
      reviewModalBooking.sportCategory
    );
    setReviewModalBooking(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top Profile Header */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-6 text-white sm:px-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <img
                  src={activeUser?.avatar || ''}
                  alt={activeUser?.name || 'User'}
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black">{activeUser?.name || 'User'}</h1>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                      {activeUser?.role === 'MITRA_OWNER' ? t.userDashboard.userRoleMitra : t.userDashboard.userRoleRenter}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {activeUser?.email || ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {activeUser?.phone || ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('EXPLORE')}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                >
                  {t.userDashboard.orderNewCourt}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* STATUS TABS */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setStatusTab('ALL')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabAll} ({userBookings.length})
          </button>
          <button
            onClick={() => setStatusTab('PENDING_PAYMENT')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'PENDING_PAYMENT'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabPending} (
            {userBookings.filter((b) => b.status === 'PENDING_PAYMENT').length})
          </button>
          <button
            onClick={() => setStatusTab('PAID_SUCCESS')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'PAID_SUCCESS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabPaid} (
            {userBookings.filter((b) => b.status === 'PAID_SUCCESS').length})
          </button>
          <button
            onClick={() => setStatusTab('COMPLETED')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'COMPLETED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabCompleted} (
            {userBookings.filter((b) => b.status === 'COMPLETED').length})
          </button>
          <button
            onClick={() => setStatusTab('CANCELLED')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusTab === 'CANCELLED'
                ? 'bg-slate-700 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.userDashboard.tabCancelled} ({userBookings.filter((b) => b.status === 'CANCELLED').length})
          </button>
        </div>

        {/* BOOKING HISTORY LIST */}
        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <Calendar className="mb-3 h-12 w-12 text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">
                {t.userDashboard.noBookingsTitle}
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                {t.userDashboard.noBookingsDesc}
              </p>
              <button
                onClick={() => setActiveView('EXPLORE')}
                className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                {t.userDashboard.exploreCourts}
              </button>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-slate-900">
                      #{booking.id}
                    </span>
                    <span className="text-xs text-slate-400">• {booking.createdAt}</span>
                  </div>
                  <div>
                    {booking.status === 'PENDING_PAYMENT' && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        {booking.paymentProofUrl
                          ? t.userDashboard.statusPendingValidation
                          : t.userDashboard.statusPendingPayment}
                      </span>
                    )}
                    {booking.status === 'PAID_SUCCESS' && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        {t.userDashboard.statusPaidSuccess}
                      </span>
                    )}
                    {booking.status === 'COMPLETED' && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                        {t.userDashboard.statusCompleted}
                      </span>
                    )}
                    {booking.status === 'CANCELLED' && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                        {t.userDashboard.statusCancelled}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-4">
                    <img
                      src={booking.venueImage || getFallbackImageForUrl(booking.venueName, booking.sportCategory)}
                      alt={booking.venueName}
                      className="h-20 w-20 rounded-xl object-cover bg-slate-100 shrink-0"
                      onError={handleImageError}
                    />
                    <div>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {(t.categories as any)[booking.sportCategory] || booking.sportCategory}
                      </span>
                      <h3 className="mt-1 text-base font-black text-slate-900">
                        {booking.venueName}
                      </h3>
                      <p className="text-xs text-slate-500">{booking.venueAddress}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                        <span>📅 {booking.items[0]?.date}</span>
                        <span>•</span>
                        <span>
                          ⏰ {booking.items.map((i) => `${i.timeStart}-${i.timeEnd}`).join(', ')} WIB (
                          {booking.items.length} {t.userDashboard.hours})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="flex flex-col items-end justify-between gap-3 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-slate-400">{t.userDashboard.totalPrice}</div>
                      <div className="text-base font-black text-slate-900">
                        {new Intl.NumberFormat(activeLang === 'US' ? 'en-US' : 'id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          maximumFractionDigits: 0,
                        }).format(booking.grandTotal)}
                      </div>
                      <div className="text-[11px] text-slate-500">{t.userDashboard.via} {booking.paymentMethod}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {booking.status === 'PAID_SUCCESS' && (
                        <button
                          onClick={() => setActiveQrModalBooking(booking)}
                          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800"
                        >
                          <QrCode className="h-4 w-4 text-emerald-400" />
                          <span>{t.userDashboard.viewTicket}</span>
                        </button>
                      )}

                      {booking.status === 'PENDING_PAYMENT' && (
                        <button
                          onClick={() => cancelBooking(booking.id)}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          {t.userDashboard.cancelOrder}
                        </button>
                      )}

                      {booking.status === 'COMPLETED' && !booking.hasReviewed && (
                        <button
                          onClick={() => handleOpenReviewModal(booking)}
                          className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-600"
                        >
                          <Star className="h-4 w-4 fill-white" />
                          <span>{t.userDashboard.giveReview}</span>
                        </button>
                      )}

                      {booking.status === 'COMPLETED' && booking.hasReviewed && (
                        <span className="text-xs font-semibold text-emerald-600">
                          {t.userDashboard.reviewSubmitted}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* QR CODE E-TICKET MODAL */}
      {activeQrModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-sm font-bold text-slate-900">{t.userDashboard.eTicketTitle}</div>
              <button
                onClick={() => setActiveQrModalBooking(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 text-center">
              <span className="font-mono text-xs font-bold text-emerald-600">
                #{activeQrModalBooking.id}
              </span>
              <h3 className="mt-1 text-base font-black text-slate-900">
                {activeQrModalBooking.venueName}
              </h3>
              <p className="text-xs text-slate-500">
                📅 {activeQrModalBooking.items[0]?.date} •{' '}
                {activeQrModalBooking.items.map((i) => i.timeStart).join(', ')} WIB
              </p>

              {/* QR Pattern */}
              <div className="mx-auto my-5 flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-md">
                <div className="grid h-full w-full grid-cols-7 gap-1">
                  {Array.from({ length: 49 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-xs ${
                        [0, 1, 2, 6, 7, 8, 40, 41, 42, 46, 47, 48].includes(i) ||
                        (i * 5) % 3 === 0
                          ? 'bg-slate-900'
                          : 'bg-white'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {t.userDashboard.paidVia} {activeQrModalBooking.paymentMethod}
              </span>
              <p className="mt-4 text-[11px] text-slate-400">
                {t.userDashboard.qrInstructions}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW & RATING MODAL */}
      {reviewModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {t.userDashboard.reviewModalTitle}
              </h3>
              <button
                onClick={() => setReviewModalBooking(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendReview} className="mt-4 space-y-4">
              <div>
                <div className="text-xs font-bold text-slate-700">
                  Venue: {reviewModalBooking.venueName}
                </div>
                <div className="text-xs text-slate-400">
                  {t.userDashboard.shareExperience}
                </div>
              </div>

              {/* Star rating selector */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  {t.userDashboard.courtRating}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                        s <= rating
                          ? 'bg-amber-400 text-white scale-110 shadow-sm'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      <Star className={`h-5 w-5 ${s <= rating ? 'fill-white' : ''}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-slate-800">
                    {rating} {t.userDashboard.starsOf}
                  </span>
                </div>
              </div>

              {/* Comment text area */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  {t.userDashboard.reviewCommentLabel}
                </label>
                <textarea
                  rows={3}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t.userDashboard.reviewPlaceholder}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                {t.userDashboard.submitReview}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
