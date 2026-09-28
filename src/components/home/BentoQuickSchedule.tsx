import React from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, Users, ArrowRight } from 'lucide-react';

export const BentoQuickSchedule: React.FC = () => {
  const { handleSearchSubmit, venues, setSelectedVenue, setActiveView } = useApp();

  // Pick a featured venue for quick availability preview
  const featuredVenue = venues[0];

  const handleBookSlot = () => {
    if (featuredVenue) {
      setSelectedVenue(featuredVenue);
      setActiveView('VENUE_DETAIL');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleSearchSubmit('FUTSAL');
    }
  };

  return (
    <section className="col-span-12 lg:col-span-4 row-span-4 flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Ketersediaan Live</h3>
          <span className="rounded-md bg-lime-100 px-2.5 py-1 text-xs font-bold text-lime-700">
            Hari Ini
          </span>
        </div>

        <p className="mb-4 text-xs font-medium text-slate-500">
          Jadwal real-time {featuredVenue ? featuredVenue.name : 'Lapangan Utama'}:
        </p>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-700">18:00 - 19:00</span>
            </div>
            <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
              BOOKED
            </span>
          </div>

          <div
            onClick={handleBookSlot}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-blue-100 bg-blue-50/70 p-3 transition hover:bg-blue-100/80"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-bold text-blue-900">19:00 - 20:00</span>
            </div>
            <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              AVAILABLE
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-700">20:00 - 21:00</span>
            </div>
            <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
              BOOKED
            </span>
          </div>

          <div
            onClick={handleBookSlot}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-blue-100 bg-blue-50/70 p-3 transition hover:bg-blue-100/80"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-bold text-blue-900">21:00 - 22:00</span>
            </div>
            <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              AVAILABLE
            </span>
          </div>

          <div
            onClick={handleBookSlot}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-blue-100 bg-blue-50/70 p-3 transition hover:bg-blue-100/80"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-bold text-blue-900">22:00 - 23:00</span>
            </div>
            <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              AVAILABLE
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[10px] font-bold text-white">
              A
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[10px] font-bold text-white">
              R
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[10px] font-bold text-white">
              D
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            12 orang baru saja membooking
          </span>
        </div>

        <button
          onClick={handleBookSlot}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-blue-600"
        >
          <span>Lihat Seluruh Slot Jam</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
};
