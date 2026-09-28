import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PRISMA_SCHEMA_TEXT,
  SQL_SCHEMA_TEXT,
  SCHEMA_EXPLANATION,
} from '../../schema/databaseSchema';
import {
  X,
  Database,
  Code2,
  Copy,
  Check,
  FileText,
  Table,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const DatabaseSchemaModal: React.FC = () => {
  const { isSchemaModalOpen, setIsSchemaModalOpen } = useApp();
  const [activeTab, setActiveTab] = useState<'ERD' | 'PRISMA' | 'SQL'>('ERD');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!isSchemaModalOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Struktur Database & Schema ERD</h3>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                  Langkah Pertama
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Arsitektur Relasional untuk Venue, User, Field, Slot Booking, Payment, & Review
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSchemaModalOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6">
          <button
            onClick={() => setActiveTab('ERD')}
            className={`flex items-center gap-2 border-b-2 py-3.5 text-sm font-semibold transition ${
              activeTab === 'ERD'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Relasi & ERD Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('PRISMA')}
            className={`flex items-center gap-2 border-b-2 py-3.5 text-sm font-semibold transition ${
              activeTab === 'PRISMA'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="h-4 w-4" />
            <span>Prisma ORM (schema.prisma)</span>
          </button>
          <button
            onClick={() => setActiveTab('SQL')}
            className={`flex items-center gap-2 border-b-2 py-3.5 text-sm font-semibold transition ${
              activeTab === 'SQL'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="h-4 w-4" />
            <span>PostgreSQL DDL (schema.sql)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'ERD' && (
            <div className="space-y-6">
              {/* ERD Diagram Visualization Box */}
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-slate-50 p-5">
                <div className="mb-3 flex items-center gap-2 font-bold text-slate-800">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  <span>Arsitektur Relasional Stadion Wibawa Mukti Sport Bekasi</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="text-xs font-bold text-slate-500">ENTITAS AKUN</div>
                    <div className="mt-1 font-bold text-slate-900">users</div>
                    <p className="mt-1 text-xs text-slate-600">
                      Multi-role: <span className="font-semibold text-emerald-600">USER</span> (penyewa) &amp;{' '}
                      <span className="font-semibold text-emerald-600">MITRA_OWNER</span> (pemilik venue).
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="text-xs font-bold text-slate-500">ENTITAS VENUE &amp; LAPANGAN</div>
                    <div className="mt-1 font-bold text-slate-900">venues &rarr; venue_fields</div>
                    <p className="mt-1 text-xs text-slate-600">
                      1 Venue memiliki N lapangan. Tiap lapangan memiliki tarif beda untuk jam{' '}
                      <span className="font-semibold text-slate-800">Non-Peak vs Peak</span>.
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="text-xs font-bold text-slate-500">KALENDER &amp; PEMESANAN</div>
                    <div className="mt-1 font-bold text-slate-900">field_slots &larr; bookings</div>
                    <p className="mt-1 text-xs text-slate-600">
                      Slot per jam dengan status <span className="font-semibold text-emerald-600">AVAILABLE</span>,{' '}
                      <span className="font-semibold text-red-600">BOOKED</span>, atau{' '}
                      <span className="font-semibold text-amber-600">MAINTENANCE</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Explanations List */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {SCHEMA_EXPLANATION.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-400"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700">
                        {idx + 1}
                      </span>
                      <span>{item.title}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* ERD Flow Chart Note */}
              <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-xs text-slate-300">
                <div className="font-semibold text-white">Alur Pemesanan &amp; Ketersediaan Kalender (Core Workflow):</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-800 px-2 py-1 text-emerald-400 font-mono">User Cari Venue</span>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <span className="rounded bg-slate-800 px-2 py-1 text-emerald-400 font-mono">Pilih Tanggal &amp; Slot Jam (field_slots)</span>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <span className="rounded bg-slate-800 px-2 py-1 text-emerald-400 font-mono">Checkout (15 Min Expiry)</span>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <span className="rounded bg-slate-800 px-2 py-1 text-emerald-400 font-mono">Bayar via QRIS / VA</span>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <span className="rounded bg-slate-800 px-2 py-1 text-emerald-400 font-mono">e-Ticket QR Terbit</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PRISMA' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  File: prisma/schema.prisma (TypeScript + Next.js ORM compatible)
                </span>
                <button
                  onClick={() => handleCopy(PRISMA_SCHEMA_TEXT, 'PRISMA')}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
                >
                  {copiedText === 'PRISMA' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Salin Schema Prisma</span>
                    </>
                  )}
                </button>
              </div>
              <div className="max-h-[55vh] overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-emerald-300 font-mono ring-1 ring-slate-800">
                <pre>{PRISMA_SCHEMA_TEXT}</pre>
              </div>
            </div>
          )}

          {activeTab === 'SQL' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  File: sql/schema.sql (PostgreSQL / Supabase / Neon DDL Script)
                </span>
                <button
                  onClick={() => handleCopy(SQL_SCHEMA_TEXT, 'SQL')}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
                >
                  {copiedText === 'SQL' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Salin SQL Script</span>
                    </>
                  )}
                </button>
              </div>
              <div className="max-h-[55vh] overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-emerald-300 font-mono ring-1 ring-slate-800">
                <pre>{SQL_SCHEMA_TEXT}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileText className="h-4 w-4 text-emerald-600" />
            <span>Siap diintegrasikan dengan PostgreSQL / Supabase / Prisma ORM</span>
          </div>
          <button
            onClick={() => setIsSchemaModalOpen(false)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Tutup Schema
          </button>
        </div>
      </div>
    </div>
  );
};
