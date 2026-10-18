"use client";

import React, { useState, useEffect, useTransition } from 'react';
import {
  CalendarDays,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  User,
  Phone,
  DollarSign,
  AlertTriangle,
  Building2,
  Layers,
  ChevronRight,
  Users,
  Trash2,
} from 'lucide-react';
import {
  getAdminVenuesWithFields,
  getFieldSlotsForDate,
  blockSlotAction,
  directWalkInBookingAction,
  unblockOrReleaseSlotAction,
  cancelSpecificBookingInSlot,
} from '../../../actions/adminActions';

export default function AdminSchedulePage() {
  const [venues, setVenues] = useState<any[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal State
  const [activeSlotModal, setActiveSlotModal] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<'WALK_IN' | 'BLOCK' | 'VIEW_INFO'>('WALK_IN');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInNik, setWalkInNik] = useState('');
  const [walkInSwimmerCount, setWalkInSwimmerCount] = useState<number>(1);
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState('TUNAI_CASH');
  const [walkInNotes, setWalkInNotes] = useState('');
  const [blockReason, setBlockReason] = useState('Perawatan Rumput & Fasilitas Lapangan');

  // Load venues on mount
  useEffect(() => {
    async function loadVenues() {
      const v = await getAdminVenuesWithFields();
      setVenues(v || []);
      if (v && v.length > 0) {
        setSelectedVenueId(v[0].id);
        if (v[0].fields && v[0].fields.length > 0) {
          setSelectedFieldId(v[0].fields[0].id);
        }
      }
    }
    loadVenues();
  }, []);

  // Update selected field when venue changes
  const handleVenueChange = (venueId: string) => {
    setSelectedVenueId(venueId);
    const v = venues.find((item) => item.id === venueId);
    if (v && v.fields && v.fields.length > 0) {
      setSelectedFieldId(v.fields[0].id);
    } else {
      setSelectedFieldId('');
    }
  };

  // Load slots whenever field or date changes
  const fetchSlots = async () => {
    if (!selectedFieldId) {
      setSlots([]);
      return;
    }
    setLoading(true);
    const res = await getFieldSlotsForDate(selectedFieldId, selectedDate);
    setSlots(res || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSlots();
  }, [selectedFieldId, selectedDate]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);
  const selectedField = selectedVenue?.fields?.find((f: any) => f.id === selectedFieldId);
  const isPool = selectedField?.sportType === 'RENANG';

  const handleSlotClick = (slot: any) => {
    setActiveSlotModal(slot);
    setWalkInSwimmerCount(1);
    setWalkInName('');
    setWalkInPhone('');
    setWalkInNik('');
    setWalkInNotes('');

    const maxCap = slot.maxCapacity || (isPool ? 30 : 1);
    const bookedCap = slot.bookedCapacity || 0;
    const remCap = Math.max(0, maxCap - bookedCap);

    if (slot.status === 'MAINTENANCE') {
      setModalMode('VIEW_INFO');
    } else if (isPool) {
      if (remCap > 0) {
        setModalMode('WALK_IN');
      } else {
        setModalMode('VIEW_INFO');
      }
    } else {
      if (slot.status === 'AVAILABLE') {
        setModalMode('WALK_IN');
      } else {
        setModalMode('VIEW_INFO');
      }
    }
  };

  // Submit direct walk-in
  const handleConfirmWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSlotModal || !walkInName.trim()) {
      alert('Nama pemesan langsung wajib diisi.');
      return;
    }

    startTransition(async () => {
      const res = await directWalkInBookingAction({
        fieldId: selectedFieldId,
        venueId: selectedVenueId,
        dateStr: selectedDate,
        hour: activeSlotModal.hour,
        customerName: walkInName.trim(),
        customerPhone: walkInPhone.trim(),
        nik: walkInNik.trim(),
        paymentMethod: walkInPaymentMethod,
        swimmerCount: isPool ? walkInSwimmerCount : 1,
        notes: walkInNotes.trim(),
      });

      if (res.success) {
        showToast(
          `Slot ${activeSlotModal.timeStart}-${activeSlotModal.timeEnd} berhasil dibooking langsung ${isPool ? `(${walkInSwimmerCount} orang) ` : ''}untuk ${walkInName}!`
        );
        setActiveSlotModal(null);
        fetchSlots();
      } else {
        alert(res.error || 'Gagal melakukan booking langsung.');
      }
    });
  };

  // Submit block slot
  const handleConfirmBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSlotModal) return;

    startTransition(async () => {
      const res = await blockSlotAction({
        fieldId: selectedFieldId,
        dateStr: selectedDate,
        hour: activeSlotModal.hour,
        reason: blockReason,
      });

      if (res.success) {
        showToast(
          `Slot ${activeSlotModal.timeStart}-${activeSlotModal.timeEnd} berhasil diblokir (${blockReason})!`
        );
        setActiveSlotModal(null);
        fetchSlots();
      } else {
        alert(res.error || 'Gagal memblokir slot.');
      }
    });
  };

  // Unblock slot
  const handleUnblockSlot = (slot: any) => {
    startTransition(async () => {
      const res = await unblockOrReleaseSlotAction({
        fieldId: selectedFieldId,
        dateStr: selectedDate,
        hour: slot.hour,
      });

      if (res.success) {
        showToast(`Slot ${slot.timeStart}-${slot.timeEnd} berhasil dibuka kembali (AVAILABLE).`);
        setActiveSlotModal(null);
        fetchSlots();
      } else {
        alert(res.error || 'Gagal membuka kunci slot.');
      }
    });
  };

  // Cancel specific booking in slot
  const handleCancelBookingItem = (bookingId: string, slotId: string, guestName: string) => {
    if (!confirm(`Batalkan pesanan untuk "${guestName}" dan kembalikan kuota ke slot ini?`)) {
      return;
    }
    startTransition(async () => {
      const res = await cancelSpecificBookingInSlot(bookingId, slotId);
      if (res.success) {
        showToast(`Pesanan ${guestName} berhasil dibatalkan dan kuota dikembalikan.`);
        setActiveSlotModal(null);
        fetchSlots();
      } else {
        alert(res.error || 'Gagal membatalkan pesanan.');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-xs font-bold text-emerald-700 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-line pb-5">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-700 mb-1">
          <CalendarDays className="h-4 w-4" />
          <span>Operasional Lapangan &amp; Kasir Loket</span>
        </div>
        <h1 className="text-2xl font-black text-fg tracking-tight">
          Blokir Jadwal &amp; Booking Langsung (Kasir Walk-in)
        </h1>
        <p className="text-xs text-fg-muted">
          Kunci slot jam lapangan untuk masa pemeliharaan, latihan kontingen atlet daerah, atau buat pesanan instan lunas di tempat.
        </p>
      </div>

      {/* Controls Bar: Venue, Field, Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-3xl border border-line bg-surface p-5 shadow-xl shadow-slate-200/60 backdrop-blur-xl">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-fg-muted block mb-1.5">
            1. Pilih Venue / Gelanggang Olahraga
          </label>
          <select
            value={selectedVenueId}
            onChange={(e) => handleVenueChange(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-blue-500"
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.city})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-fg-muted block mb-1.5">
            2. Pilih Lapangan
          </label>
          <select
            value={selectedFieldId}
            onChange={(e) => setSelectedFieldId(e.target.value)}
            disabled={!selectedVenue?.fields || selectedVenue.fields.length === 0}
            className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-blue-500 disabled:opacity-50"
          >
            {selectedVenue?.fields?.map((f: any) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.sportType} • {f.type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-fg-muted block mb-1.5">
            3. Pilih Tanggal Jadwal
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-fg-subtle">
        <span className="text-[11px] text-fg-faint uppercase font-extrabold">Keterangan:</span>
        {isPool ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span>Kosong / Tersedia Penuh (0/30)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-sky-500" />
              <span>Terisi Sebagian (Sisa Kuota Terbuka)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-purple-500" />
              <span>Penuh (30/30 Orang)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span>Tutup / Pemeliharaan Kolam</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span>Tersedia (Bisa dipesan / dibooking kasir)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <span>Kasir Walk-in (Booking Langsung Loket)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-purple-500" />
              <span>Booking Online (Masyarakat)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span>Terblokir / Acara Dinas (Maintenance)</span>
            </div>
          </>
        )}
      </div>

      {/* Slot Grid 06:00 - 23:00 */}
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-fg flex items-center gap-2">
              <span>Jadwal Slot Jam: {selectedField?.name || 'Lapangan'}</span>
              {isPool && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-300">
                  Kapasitas 30 Orang/Jam
                </span>
              )}
            </h3>
            <p className="text-xs text-fg-muted">
              {new Date(selectedDate).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700">
            Tarif: Rp {selectedField?.priceNonPeak?.toLocaleString('id-ID')} {isPool ? '/ orang / jam' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs font-bold text-fg-faint">
            Memuat slot jadwal lapangan...
          </div>
        ) : slots.length === 0 ? (
          <div className="py-12 text-center text-xs text-fg-muted">
            Tidak ada data slot jam untuk lapangan ini.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {slots.map((slot) => {
              const maxCap = slot.maxCapacity || (isPool ? 30 : 1);
              const bookedCap = slot.bookedCapacity || 0;
              const remCap = Math.max(0, maxCap - bookedCap);
              const isMaintenance = slot.status === 'MAINTENANCE';
              const isPoolFull = isPool && (remCap <= 0 || slot.status === 'BOOKED');
              const isBooked = isPool ? isPoolFull : slot.status === 'BOOKED';
              const isWalkIn = !isPool && isBooked && slot.booking?.id?.startsWith('WALKIN-');
              const isPartiallyBooked = isPool && bookedCap > 0 && bookedCap < maxCap && !isMaintenance;

              let cardStyle = 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/60';
              if (isMaintenance) {
                cardStyle = 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100/60';
              } else if (isWalkIn) {
                cardStyle = 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100/60';
              } else if (isPartiallyBooked) {
                cardStyle = 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100/60';
              } else if (isBooked) {
                cardStyle = 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100/60';
              }

              return (
                <button
                  key={slot.id}
                  onClick={() => handleSlotClick(slot)}
                  className={`flex flex-col justify-between p-3.5 rounded-2xl border text-left transition hover:-translate-y-0.5 shadow-sm ${cardStyle}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black font-mono">
                      {slot.timeStart} - {slot.timeEnd}
                    </span>
                    {isMaintenance ? (
                      <Lock className="h-3.5 w-3.5 text-amber-700" />
                    ) : isPool ? (
                      <span className={`rounded-full px-1.5 py-0.2 text-[8px] font-black ${
                        isPoolFull
                          ? 'bg-purple-600 text-white'
                          : bookedCap > 0
                          ? 'bg-sky-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {bookedCap}/{maxCap}
                      </span>
                    ) : isWalkIn ? (
                      <span className="rounded bg-blue-500 px-1.5 py-0.2 text-[8px] font-black text-white">
                        Walk-in
                      </span>
                    ) : isBooked ? (
                      <span className="rounded bg-purple-500 px-1.5 py-0.2 text-[8px] font-black text-white">
                        Online
                      </span>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    )}
                  </div>

                  <div className="mt-2.5">
                    {isMaintenance ? (
                      <div className="text-[10px] font-bold text-amber-700 line-clamp-1">
                        {slot.bookedByUserId?.replace('BLOCKED: ', '') || 'DIBLOKIR'}
                      </div>
                    ) : isPool ? (
                      <div>
                        {isPoolFull ? (
                          <div className="text-[10px] font-black text-purple-700">Penuh (30 Orang)</div>
                        ) : bookedCap > 0 ? (
                          <div className="text-[10px] font-bold text-sky-800">
                            Sisa <span className="font-black">{remCap}</span> kuota
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-emerald-700">
                            Tersedia 30 kuota
                          </div>
                        )}
                      </div>
                    ) : isWalkIn ? (
                      <div className="text-[10px] font-bold text-blue-700 line-clamp-1">
                        {slot.booking?.senderName || 'Kasir Walk-in'}
                      </div>
                    ) : isBooked ? (
                      <div className="text-[10px] font-bold text-purple-700 line-clamp-1">
                        {slot.booking?.senderName || slot.booking?.user?.name || 'Terpesan'}
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-emerald-700">
                        Rp {slot.price.toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: ACTION SLOT */}
      {activeSlotModal && (() => {
        const modalMaxCap = activeSlotModal.maxCapacity || (isPool ? 30 : 1);
        const modalBookedCap = activeSlotModal.bookedCapacity || 0;
        const modalRemCap = Math.max(0, modalMaxCap - modalBookedCap);
        const modalIsMaintenance = activeSlotModal.status === 'MAINTENANCE';
        const canWalkIn = !modalIsMaintenance && modalRemCap > 0;
        const allItems = activeSlotModal.bookingItems || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative my-6 w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-fg flex items-center gap-2">
                    <span>Slot Jam: {activeSlotModal.timeStart} - {activeSlotModal.timeEnd} WIB</span>
                  </h3>
                  <p className="text-xs text-fg-muted">
                    {selectedField?.name} • {selectedVenue?.name}
                  </p>
                </div>
                <button
                  onClick={() => setActiveSlotModal(null)}
                  className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
                >
                  ✕
                </button>
              </div>

              {/* Capacity Banner for Pool */}
              {isPool && (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/80 p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-sky-700" />
                    <div>
                      <span className="font-extrabold text-sky-950">Kapasitas Slot Renang:</span>
                      <p className="text-[11px] text-sky-700">Maksimal 30 orang per jam</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sky-950 text-sm">
                      {modalBookedCap} / {modalMaxCap} Terisi
                    </span>
                    <p className="text-[11px] font-bold text-emerald-700">
                      Sisa {modalRemCap} Kuota
                    </p>
                  </div>
                </div>
              )}

              {/* Mode Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 my-4 rounded-xl bg-field p-1 border border-line">
                <button
                  type="button"
                  disabled={!canWalkIn}
                  onClick={() => setModalMode('WALK_IN')}
                  className={`py-2 text-xs font-bold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    modalMode === 'WALK_IN'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  Kasir Walk-in
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('VIEW_INFO')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    modalMode === 'VIEW_INFO'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  Peserta ({allItems.length || (activeSlotModal.booking ? 1 : 0)})
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('BLOCK')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    modalMode === 'BLOCK'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  Blokir Total
                </button>
              </div>

              {/* TAB 1: KASIR WALK-IN */}
              {modalMode === 'WALK_IN' && (
                <form onSubmit={handleConfirmWalkIn} className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-fg-subtle block mb-1">
                      Nama Pemesan Langsung (Wajib)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Pak Lurah / Bpk. Sutrisno"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-blue-500"
                    />
                  </div>

                  {isPool && (
                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">
                        Jumlah Pengguna / Perenang (Sisa Kuota: {modalRemCap} Orang)
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setWalkInSwimmerCount(Math.max(1, walkInSwimmerCount - 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface font-black text-fg hover:bg-subtle"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={modalRemCap}
                          value={walkInSwimmerCount}
                          onChange={(e) => setWalkInSwimmerCount(Math.min(modalRemCap, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-20 text-center rounded-xl border border-line-strong bg-field p-2 text-xs font-black text-fg outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setWalkInSwimmerCount(Math.min(modalRemCap, walkInSwimmerCount + 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface font-black text-fg hover:bg-subtle"
                        >
                          +
                        </button>
                        <span className="text-xs font-bold text-fg-muted">Orang</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">No. WhatsApp</label>
                      <input
                        type="text"
                        placeholder="08123456789"
                        value={walkInPhone}
                        onChange={(e) => setWalkInPhone(e.target.value)}
                        className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-fg-subtle block mb-1">NIK (Opsional)</label>
                      <input
                        type="text"
                        maxLength={16}
                        placeholder="16 digit angka"
                        value={walkInNik}
                        onChange={(e) => setWalkInNik(e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-fg-subtle block mb-1">Metode Pembayaran</label>
                    <select
                      value={walkInPaymentMethod}
                      onChange={(e) => setWalkInPaymentMethod(e.target.value)}
                      className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-blue-500"
                    >
                      <option value="TUNAI_CASH">💵 Uang Tunai / Cash (Lunas di Kasir)</option>
                      <option value="QRIS_KASIR">📱 QRIS Kasir DISBUDPORA</option>
                      <option value="TRANSFER_BANK">🏦 Transfer Bank Rekening Dinas</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-fg-subtle block mb-1">Catatan Keperluan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Latihan warga / renang santai"
                      value={walkInNotes}
                      onChange={(e) => setWalkInNotes(e.target.value)}
                      className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-700 flex items-center justify-between font-bold">
                    <span>Total Tagihan Sewa (Lunas Kasir):</span>
                    <span className="text-sm font-black text-fg">
                      Rp {(activeSlotModal.price * (isPool ? walkInSwimmerCount : 1)).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSlotModal(null)}
                      className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 disabled:opacity-50"
                    >
                      Konfirmasi Booking Lunas (Walk-in)
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: DAFTAR PEMESAN / PESERTA */}
              {modalMode === 'VIEW_INFO' && (
                <div className="space-y-4 text-xs">
                  {modalIsMaintenance ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                      <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                        <span className="text-amber-800 font-bold">Status Slot:</span>
                        <span className="font-black text-amber-900">DIBLOKIR / MAINTENANCE</span>
                      </div>
                      <div>
                        <span className="text-amber-700">Alasan Blokir:</span>
                        <div className="mt-1 font-bold text-amber-900">
                          {activeSlotModal.bookedByUserId?.replace('BLOCKED: ', '') || 'Perawatan'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {allItems.length > 0 ? (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                          {allItems.map((item: any, idx: number) => {
                            const b = item.booking;
                            const pemesan = b?.senderName || b?.user?.name || 'Pengunjung';
                            const phone = b?.user?.phone || '-';
                            const qty = item.quantity || 1;
                            const isWalkin = b?.id?.startsWith('WALKIN-');

                            return (
                              <div
                                key={item.id || idx}
                                className="rounded-2xl border border-line bg-field p-3.5 space-y-1.5"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-black text-fg text-xs flex items-center gap-1.5">
                                      <span>{pemesan}</span>
                                      {isWalkin ? (
                                        <span className="rounded bg-blue-500 px-1.5 py-0.2 text-[8px] font-black text-white">
                                          Walk-in Kasir
                                        </span>
                                      ) : (
                                        <span className="rounded bg-purple-500 px-1.5 py-0.2 text-[8px] font-black text-white">
                                          Online
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-fg-muted">
                                      WA: {phone} • {qty} Orang
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-emerald-700">
                                      Rp {item.price?.toLocaleString('id-ID')}
                                    </div>
                                    <span className="text-[10px] text-fg-muted font-mono uppercase">
                                      {b?.paymentMethod}
                                    </span>
                                  </div>
                                </div>

                                {b?.adminNotes && (
                                  <div className="text-[10px] text-fg-muted italic">
                                    Catatan: {b.adminNotes}
                                  </div>
                                )}

                                <div className="pt-1 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleCancelBookingItem(b?.id, activeSlotModal.id, pemesan)}
                                    disabled={isPending}
                                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-100"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Batalkan &amp; Kembalikan Kuota</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : activeSlotModal.booking ? (
                        <div className="rounded-2xl border border-line bg-field p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-fg-muted">Pemesan:</span>
                            <span className="font-bold text-fg">
                              {activeSlotModal.booking?.senderName || activeSlotModal.booking?.user?.name || 'Kasir'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-fg-muted">Metode Bayar:</span>
                            <span className="font-semibold text-emerald-700">
                              {activeSlotModal.booking?.paymentMethod}
                            </span>
                          </div>
                          {activeSlotModal.booking?.adminNotes && (
                            <div className="text-fg-muted italic text-[11px] pt-1">
                              {activeSlotModal.booking.adminNotes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-fg-muted">
                          Belum ada peserta yang memesan slot ini.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setActiveSlotModal(null)}
                      className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
                    >
                      Tutup
                    </button>
                    {(modalIsMaintenance || activeSlotModal.status === 'BOOKED' || modalBookedCap > 0) && (
                      <button
                        type="button"
                        onClick={() => handleUnblockSlot(activeSlotModal)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500"
                      >
                        <Unlock className="h-4 w-4" />
                        <span>Buka Kunci / Reset Slot Penuh</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: BLOKIR TOTAL */}
              {modalMode === 'BLOCK' && (
                <form onSubmit={handleConfirmBlock} className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-fg-subtle block mb-2">Pilih Alasan Blokir:</label>
                    <div className="space-y-1.5">
                      {[
                        'Perawatan Air Kolam & Kuras Berkala',
                        'Acara Dinas DISBUDPORA / Pemkab Bekasi',
                        'Latihan Atlet Daerah / Pertandingan Tertutup',
                        'Perbaikan Pompa Air & Kebersihan',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setBlockReason(preset)}
                          className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold transition ${
                            blockReason === preset
                              ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold'
                              : 'border-line bg-field text-fg-muted hover:bg-subtle'
                          }`}
                        >
                          • {preset}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3">
                      <label className="font-bold text-fg-muted block mb-1">Atau Alasan Kustom:</label>
                      <input
                        type="text"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-bold text-fg outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-700 text-[11px] leading-relaxed">
                    ⚠️ Slot ini akan langsung ditutup dari website publik dan loket kasir sehingga tidak dapat dipesan lagi.
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSlotModal(null)}
                      className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-500 disabled:opacity-50"
                    >
                      Kunci &amp; Blokir Total Jadwal Ini
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
