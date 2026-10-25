import React from 'react';
import { Info, Tag, FileText, CheckCircle2, RotateCcw, ShieldAlert, Calendar } from 'lucide-react';

export interface FormattedNotes {
  categoryLabel: string | null;
  uploadLabel: string | null;
  checkInLabel: string | null;
  lateRecoveryLabel: string | null;
  auditCancelLabel: string | null;
  pemdaAgendaLabel: string | null;
  refundLabel: string | null;
  freeText: string | null;
  humanSummary: string;
}

/**
 * Menerjemahkan catatan sistem / metadata database (seperti KATEGORI:AMATIR; UPLOAD_COUNT:1)
 * menjadi bahasa Indonesia yang manusiawi, rapi, dan mudah dibaca oleh kasir maupun warga.
 */
export function formatAdminNotesToHuman(rawNotes?: string | null): FormattedNotes | null {
  if (!rawNotes || !rawNotes.trim()) return null;

  let text = rawNotes;

  // 1. Ekstrak Kategori (KATEGORI:AMATIR -> Kategori: Amatir / Rekreasi)
  let categoryLabel: string | null = null;
  const categoryMatch = text.match(/KATEGORI:\s*([A-Za-z0-9_]+)/i);
  if (categoryMatch) {
    const cat = categoryMatch[1].toUpperCase();
    if (cat === 'AMATIR') categoryLabel = 'Amatir / Rekreasi';
    else if (cat === 'PELAJAR' || cat === 'SISWA') categoryLabel = 'Pelajar / Siswa (Subsidi)';
    else if (cat === 'UMUM') categoryLabel = 'Masyarakat Umum';
    else if (cat === 'KLUB') categoryLabel = 'Klub Olahraga';
    else if (cat === 'INSTITUSI' || cat === 'KEDINASAN') categoryLabel = 'Instansi / Kedinasan';
    else categoryLabel = cat;
    text = text.replace(categoryMatch[0], '');
  }

  // 2. Ekstrak Upload Count (UPLOAD_COUNT:1 -> Unggahan Bukti ke-1)
  let uploadLabel: string | null = null;
  const uploadMatch = text.match(/UPLOAD_COUNT:\s*(\d+)/i);
  if (uploadMatch) {
    const count = parseInt(uploadMatch[1], 10);
    uploadLabel = count === 1 ? 'Unggahan Bukti ke-1' : `Unggahan Bukti ke-${count} (Maks. 2x)`;
    text = text.replace(uploadMatch[0], '');
  }

  // 3. Ekstrak Check-in Gerbang (CHECKED_IN: 25/10/2026, 09.00 -> Sudah Masuk Gerbang)
  let checkInLabel: string | null = null;
  const checkInMatch = text.match(/CHECKED_IN:\s*([^;|]+)/i);
  if (checkInMatch) {
    checkInLabel = `Sudah Masuk Gerbang (${checkInMatch[1].trim()})`;
    text = text.replace(checkInMatch[0], '');
  }

  // 4. Ekstrak Pemulihan Kasda (LATE_RECOVERY: ...)
  let lateRecoveryLabel: string | null = null;
  const recoveryMatch = text.match(/\[LATE_RECOVERY:\s*([^\]]+)\]/i);
  if (recoveryMatch) {
    lateRecoveryLabel = `Dipulihkan via Kasda: ${recoveryMatch[1].trim()}`;
    text = text.replace(recoveryMatch[0], '');
  }

  // 5. Ekstrak Audit Pembatalan ([AUDIT_CANCEL: ...])
  let auditCancelLabel: string | null = null;
  const auditCancelMatch = text.match(/\[AUDIT_CANCEL:\s*([^\]]+)\]/i);
  if (auditCancelMatch) {
    auditCancelLabel = `Log Pembatalan: ${auditCancelMatch[1].trim()}`;
    text = text.replace(auditCancelMatch[0], '');
  }

  // 6. Ekstrak Agenda Pemda
  let pemdaAgendaLabel: string | null = null;
  const pemdaMatch = text.match(/Agenda Pemda:\s*([^;|]+)/i);
  if (pemdaMatch) {
    pemdaAgendaLabel = pemdaMatch[1].trim();
    text = text.replace(pemdaMatch[0], '');
  }

  // 7. Ekstrak Refund
  let refundLabel: string | null = null;
  const refundMatch = text.match(/Pengajuan Refund oleh Warga:\s*([^;|]+)/i);
  if (refundMatch) {
    refundLabel = refundMatch[1].trim();
    text = text.replace(refundMatch[0], '');
  }

  // 8. Bersihkan teks manual dari sisa format sistem
  const cleanFreeText = text
    .replace(/[;|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Susun ringkasan satu baris (human summary)
  const summaryParts: string[] = [];
  if (categoryLabel) summaryParts.push(`Kategori: ${categoryLabel}`);
  if (uploadLabel) summaryParts.push(uploadLabel);
  if (checkInLabel) summaryParts.push(checkInLabel);
  if (lateRecoveryLabel) summaryParts.push(lateRecoveryLabel);
  if (auditCancelLabel) summaryParts.push(auditCancelLabel);
  if (pemdaAgendaLabel) summaryParts.push(`Agenda Pemda: ${pemdaAgendaLabel}`);
  if (refundLabel) summaryParts.push(`Refund: ${refundLabel}`);
  if (cleanFreeText) summaryParts.push(`Catatan: ${cleanFreeText}`);

  return {
    categoryLabel,
    uploadLabel,
    checkInLabel,
    lateRecoveryLabel,
    auditCancelLabel,
    pemdaAgendaLabel,
    refundLabel,
    freeText: cleanFreeText || null,
    humanSummary: summaryParts.join(' • ') || rawNotes,
  };
}

/**
 * Komponen UI badge rapi dan elegan untuk menggantikan teks teknis pemrograman di modal admin & warga.
 */
export const AdminNotesBadgeView: React.FC<{ notes?: string | null; className?: string }> = ({
  notes,
  className = '',
}) => {
  const parsed = formatAdminNotesToHuman(notes);
  if (!parsed) return null;

  const {
    categoryLabel,
    uploadLabel,
    checkInLabel,
    lateRecoveryLabel,
    auditCancelLabel,
    pemdaAgendaLabel,
    refundLabel,
    freeText,
  } = parsed;

  const hasAnyBadge =
    categoryLabel ||
    uploadLabel ||
    checkInLabel ||
    lateRecoveryLabel ||
    auditCancelLabel ||
    pemdaAgendaLabel ||
    refundLabel;

  if (!hasAnyBadge && !freeText) return null;

  return (
    <div className={`mt-3 rounded-2xl border border-line bg-surface p-3.5 space-y-2 text-xs shadow-xs ${className}`}>
      <div className="font-bold text-fg flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-muted">
        <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span>Rincian Verifikasi &amp; Catatan Pesanan:</span>
      </div>

      {hasAnyBadge && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {categoryLabel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-bold">
              <Tag className="h-3 w-3 text-blue-600" />
              <span>Kategori: {categoryLabel}</span>
            </span>
          )}
          {uploadLabel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              <FileText className="h-3 w-3 text-emerald-600" />
              <span>{uploadLabel}</span>
            </span>
          )}
          {checkInLabel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
              <CheckCircle2 className="h-3 w-3 text-purple-600" />
              <span>{checkInLabel}</span>
            </span>
          )}
          {lateRecoveryLabel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              <RotateCcw className="h-3 w-3 text-amber-600" />
              <span>{lateRecoveryLabel}</span>
            </span>
          )}
          {pemdaAgendaLabel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
              <Calendar className="h-3 w-3 text-indigo-600" />
              <span>Agenda Pemda: {pemdaAgendaLabel}</span>
            </span>
          )}
          {refundLabel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
              <span>Rekening Refund: {refundLabel}</span>
            </span>
          )}
          {auditCancelLabel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 font-semibold">
              <ShieldAlert className="h-3 w-3 text-red-600" />
              <span>{auditCancelLabel}</span>
            </span>
          )}
        </div>
      )}

      {freeText && (
        <div className="text-[11px] text-fg leading-relaxed bg-field p-2.5 rounded-xl border border-line-strong">
          <strong className="text-fg-muted">Catatan Tambahan:</strong> {freeText}
        </div>
      )}
    </div>
  );
};
