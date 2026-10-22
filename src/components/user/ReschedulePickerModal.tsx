"use client";

import React, { useState, useEffect, useTransition } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Building2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Booking } from '../../types';
import {
  getRescheduleAvailableSlotsAction,
  confirmCustomerRescheduleAction,
} from '../../actions/rescheduleActions';

interface ReschedulePickerModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: (newDate: string, newTime: string) => void;
}

export const ReschedulePickerModal: React.FC<ReschedulePickerModalProps> = ({
  booking,
  onClose,
  onSuccess,
}) => {
  // Ambil tanggal besok sebagai tanggal default pilihan
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(defaultDateStr);
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fieldId = booking.items?.[0]?.fieldId;
  const fieldName = booking.items?.[0]?.fieldName || 'Lapangan Utama';
  const originalDate = booking.rescheduleOriginalDate || booking.items?.[0]?.date || 'Tanggal Sebelumnya';
  const originalTime = booking.rescheduleOriginalTime || booking.items?.map(i => `${i.timeStart}-${i.timeEnd}`).join(', ') + ' WIB';

  // Muat slot saat tanggal berubah
  useEffect(() => {
    if (!fieldId) return;

    async function loadSlots() {
      setLoadingSlots(true);
      setErrorMessage(null);
      setSelectedSlot(null);

      const res = await getRescheduleAvailableSlotsAction(fieldId, selectedDate);
      if (res.success) {
        setSlots(res.slots || []);
      } else {
        setErrorMessage(res.error || 'Gagal memuat jadwal untuk tanggal ini.');
        setSlots([]);
      }
      setLoadingSlots(false);
    }

    loadSlots();
  }, [fieldId, selectedDate]);

  // Handle submit konfirmasi reschedule
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setErrorMessage('Silakan pilih salah satu jam slot yang tersedia.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await confirmCustomerRescheduleAction({
      bookingId: booking.id,
      newDateStr: selectedDate,
      slotHour: selectedSlot.hour,
      timeStart: selectedSlot.timeStart,
      timeEnd: selectedSlot.timeEnd,
      customerNotes,
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccess(selectedDate, `${selectedSlot.timeStart}-${selectedSlot.timeEnd} WIB`);
      onClose();
    } else {
      setErrorMessage(res.error || 'Gagal mengonfirmasi jadwal pengganti.');
    }
  };

  // Batas minimal tanggal (hari ini) dan maksimal (30 hari ke depan)
  const todayStr = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative my-6 w-full max-w-xl rounded-3xl border border-slate-700 bg-surface p-6 shadow-2xl text-fg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-fg">Pilih Tanggal Pengganti</h3>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 border border-emerald-300">
                  Gratis Rp 0
                </span>
              </div>
              <p className="text-xs text-fg-muted font-medium">
                {booking.venueName} • <span className="font-semibold text-fg">{fieldName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleConfirm} className="mt-4 space-y-4 text-xs">
          {/* Jadwal Semula Info Banner */}
          <div className="rounded-2xl border border-line bg-field p-3.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-fg-faint block">Jadwal Semula (Terdampak):</span>
              <span className="font-bold text-fg line-through text-slate-400">{originalDate}</span>
              <span className="text-slate-400 text-[11px] block">{originalTime}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-amber-700 block">Kompensasi Pemda</span>
              <span className="font-black text-emerald-700 text-sm">Gratis 100%</span>
            </div>
          </div>

          {/* Pilih Tanggal Baru */}
          <div>
            <label className="block font-bold text-fg mb-1.5 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span>Pilih Tanggal Pengganti Baru:</span>
            </label>
            <input
              type="date"
              min={todayStr}
              max={maxDateStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-field py-2.5 px-3.5 text-xs font-bold text-fg outline-none focus:border-emerald-500 shadow-sm"
            />
            <p className="text-[10px] text-fg-muted mt-1">
              Anda dapat memilih tanggal kapan saja dalam rentang 30 hari ke depan.
            </p>
          </div>

          {/* Grid Slot Jam Lapangan */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-fg flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span>Pilih Jam Slot Tersedia:</span>
              </label>
              <span className="text-[10px] text-fg-faint">
                {selectedSlot ? `Terpilih: ${selectedSlot.timeStart}-${selectedSlot.timeEnd} WIB` : 'Pilih 1 jam'}
              </span>
            </div>

            {loadingSlots ? (
              <div className="py-8 text-center text-xs font-semibold text-fg-muted flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Memuat ketersediaan slot lapangan...</span>
              </div>
            ) : slots.length === 0 ? (
              <div className="py-6 text-center text-xs text-fg-muted border border-dashed border-line rounded-2xl">
                Tidak ada slot jadwal yang tersedia pada tanggal ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                {slots.map((s: any) => {
                  const isAvailable = s.status === 'AVAILABLE' && (s.maxCapacity - s.bookedCapacity) > 0;
                  const isSelected = selectedSlot?.id === s.id;

                  return (
                    <button
                      key={s.id || s.hour}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSelectedSlot(s)}
                      className={`relative p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-md shadow-emerald-600/10'
                          : isAvailable
                          ? 'border-line-strong bg-surface hover:border-emerald-400 text-fg'
                          : 'border-line bg-subtle/50 text-fg-faint cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-xs">
                          {s.timeStart} - {s.timeEnd}
                        </span>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-[10px]">
                        {s.status === 'MAINTENANCE' ? (
                          <span className="text-amber-700 font-semibold">Pemeliharaan</span>
                        ) : !isAvailable ? (
                          <span className="text-red-600 font-semibold">Penuh</span>
                        ) : (
                          <span className="text-emerald-700 font-bold">Tersedia</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Catatan Tambahan (Opsional) */}
          <div>
            <label className="block font-bold text-fg mb-1">
              Catatan / Permintaan Khusus (Opsional):
            </label>
            <input
              type="text"
              placeholder="Contoh: Mohon pastikan lampu lapangan menyala jika malam"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-field py-2 px-3 text-xs text-fg outline-none focus:border-emerald-500"
            />
          </div>

          {/* Ringkasan Konfirmasi */}
          {selectedSlot && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 space-y-1.5 text-xs text-emerald-950">
              <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Ringkasan Jadwal Baru Anda:</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                <div>
                  <span className="text-emerald-800">Tanggal Baru:</span>{' '}
                  <strong className="text-emerald-950 block">{selectedDate}</strong>
                </div>
                <div>
                  <span className="text-emerald-800">Jam Baru:</span>{' '}
                  <strong className="text-emerald-950 block">
                    {selectedSlot.timeStart} - {selectedSlot.timeEnd} WIB
                  </strong>
                </div>
              </div>
              <div className="pt-1 text-[11px] text-emerald-800">
                Total Biaya Tambahan: <strong className="text-emerald-700">Rp 0 (Kompensasi Agenda Pemda)</strong>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-line-strong px-4 py-2.5 text-xs font-bold text-fg-subtle hover:bg-subtle transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!selectedSlot || isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Konfirmasi &amp; Terbitkan E-Ticket Baru</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
