import React, { useState } from 'react';
import {
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles,
  Building2,
  X,
  MessageCircle,
  ArrowRight,
  FileText,
  AlertCircle,
  Award,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { Booking } from '../../types';
import { requestRescheduleRefundAction } from '../../actions/rescheduleActions';

interface PemdaNoticeModalProps {
  booking: Booking;
  userName?: string;
  onClose: () => void;
  onOpenPicker: (booking: Booking) => void;
}

const BANK_OPTIONS = [
  'Bank BJB (Bank Daerah Jawa Barat / Banten)',
  'Bank Central Asia (BCA)',
  'Bank Mandiri',
  'Bank Rakyat Indonesia (BRI)',
  'Bank Negara Indonesia (BNI)',
  'Bank Syariah Indonesia (BSI)',
  'Bank CIMB Niaga',
  'Bank Permata',
  'Bank Danamon',
];

export const PemdaNoticeModal: React.FC<PemdaNoticeModalProps> = ({
  booking,
  userName,
  onClose,
  onOpenPicker,
}) => {
  const recipientName = booking.senderName || userName || 'Warga / Penyewa Terhormat';
  const bookingRef = booking.id;
  const originalDate = booking.rescheduleOriginalDate || booking.items?.[0]?.date || 'Tanggal Sebelumnya';
  const originalTime = booking.rescheduleOriginalTime || booking.items?.map(i => `${i.timeStart}-${i.timeEnd}`).join(', ') + ' WIB';
  const reason = booking.rescheduleReason || 'Agenda Resmi Kedinasan Pemerintah Kabupaten Bekasi / DISBUDPORA';

  // Refund Form State (Poin 11: Rekening Refund Terstruktur)
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [bankName, setBankName] = useState(BANK_OPTIONS[0]);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(recipientName);
  const [refundReason, setRefundReason] = useState('Jadwal bentrok dengan agenda pribadi');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Format link WhatsApp CS DISBUDPORA untuk opsi refund / bantuan
  const waHelpText = encodeURIComponent(
    `Halo Admin DISBUDPORA Kab. Bekasi, saya ${recipientName} ingin menanyakan/konfirmasi perihal pergeseran jadwal dinas Pemda untuk pesanan saya #${booking.id} di ${booking.venueName}.`
  );
  const waHelpUrl = `https://wa.me/6281234567890?text=${waHelpText}`;

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber.trim() || !accountHolderName.trim()) {
      alert('Nomor Rekening dan Nama Pemilik Rekening wajib diisi.');
      return;
    }

    if (!confirm(`Konfirmasi pengajuan refund sebesar Rp ${booking.grandTotal.toLocaleString('id-ID')} ke rekening ${bankName} no: ${accountNumber} a/n ${accountHolderName}?`)) {
      return;
    }

    setIsSubmittingRefund(true);
    try {
      const res = await requestRescheduleRefundAction(booking.id, {
        bankName,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim(),
        reason: refundReason.trim(),
      });

      if (res.success) {
        alert(res.message || 'Pengajuan refund berhasil dicatat! Bendahara DISBUDPORA akan memproses transfer pengembalian dana.');
        onClose();
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } else {
        alert(res.error || 'Gagal memproses pengajuan refund.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem saat mengajukan refund.');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative my-8 w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-amber-500/30 bg-slate-900 text-slate-100 shadow-2xl shadow-amber-950/50">
        {/* Top Grand Regal Header Accent */}
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-emerald-700 to-slate-900 px-6 py-6 border-b border-amber-400/30">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-900/40 border border-amber-200/50 shrink-0">
                <ShieldCheck className="h-8 w-8 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-400/40">
                    Pemberitahuan Resmi Pemda
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    REF: PEMKAB-BKS/{bookingRef.slice(-6).toUpperCase()}
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">
                  Penyesuaian Jadwal Fasilitas Olahraga
                </h2>
                <p className="text-xs font-medium text-emerald-200">
                  Dinas Kebudayaan, Pemuda, dan Olahraga — Pemerintah Kabupaten Bekasi
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="Tutup Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Surat Resmi & Kompensasi */}
        <div className="p-6 space-y-5 text-xs leading-relaxed max-h-[70vh] overflow-y-auto">
          {/* Salam & Pembuka */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <p className="text-slate-300">
              Kepada Yth. <strong className="text-amber-300 font-bold">{recipientName}</strong>,
            </p>
            <p className="mt-2 text-slate-300">
              Pemerintah Kabupaten Bekasi melalui DISBUDPORA menyampaikan salam hangat dan permohonan maaf sebesar-besarnya atas ketidaknyamanan yang terjadi. Sehubungan dengan adanya agenda kedinasan daerah yang bersifat penting dan mendesak:
            </p>
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-amber-200">
              <div className="flex items-start gap-2.5">
                <Building2 className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-amber-300 text-xs uppercase tracking-wide">
                    Agenda Kedinasan Daerah:
                  </div>
                  <div className="font-bold text-white text-sm mt-0.5">{reason}</div>
                  <div className="text-[11px] text-amber-200/80 mt-1">
                    Lokasi: <span className="font-semibold text-white">{booking.venueName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rincian Jadwal Semula */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-emerald-400" />
              <span>Jadwal Semula yang Terdampak</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-slate-900/80 border border-slate-700/80 p-3">
                <span className="text-[10px] text-slate-400 block font-semibold">Tanggal Semula:</span>
                <span className="font-bold text-white text-xs">{originalDate}</span>
              </div>
              <div className="rounded-xl bg-slate-900/80 border border-slate-700/80 p-3">
                <span className="text-[10px] text-slate-400 block font-semibold">Jam Sewa Semula:</span>
                <span className="font-bold text-white text-xs">{originalTime}</span>
              </div>
            </div>
          </div>

          {/* Hak Istimewa Warga (Kompensasi Bebas Biaya) */}
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 to-slate-900 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
              <Award className="h-4 w-4 text-emerald-400" />
              <span>Hak Istimewa &amp; Jaminan Pelayanan DISBUDPORA:</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 pl-1">
              <li className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Bebas Geser Tanggal 100% Gratis:</strong> Anda berhak memilih tanggal dan jam bermain pengganti di lapangan yang sama tanpa dikenakan biaya tambahan sepeser pun.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Status Pembayaran Sah &amp; Aman:</strong> Pembayaran sebesar{' '}
                  <strong className="text-emerald-300">
                    Rp {booking.grandTotal.toLocaleString('id-ID')}
                  </strong>{' '}
                  tetap lunas dan tiket Anda otomatis diperbarui begitu Anda mengonfirmasi tanggal baru.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Opsi Refund Dana Penuh 100%:</strong> Jika Anda berhalangan di hari lain, Anda dapat mengajukan nomor rekening pengembalian dana resmi langsung melalui formulir di bawah ini.
                </span>
              </li>
            </ul>
          </div>

          {/* FORMULIR REKENING REFUND RESMI (POIN 11) */}
          {showRefundForm && (
            <form onSubmit={handleSubmitRefund} className="rounded-2xl border-2 border-amber-500/50 bg-slate-950/90 p-4.5 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 font-black text-amber-300 text-sm border-b border-slate-800 pb-2">
                <CreditCard className="h-5 w-5 text-amber-400" />
                <span>Formulir Pengajuan Rekening Pengembalian Dana (Refund 100%)</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Dana retribusi sebesar <strong className="text-emerald-300 font-mono">Rp {booking.grandTotal.toLocaleString('id-ID')}</strong> akan ditransfer langsung oleh Bendahara DISBUDPORA ke rekening resmi yang Anda daftarkan:
              </p>

              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Pilihan Bank Penerima *</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white font-semibold outline-none focus:border-amber-400"
                  >
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Nomor Rekening Bank *</label>
                    <input
                      type="text"
                      placeholder="Contoh: 0123456789"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs font-mono font-bold text-emerald-400 outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Nama Pemilik Rekening *</label>
                    <input
                      type="text"
                      placeholder="Sesuai buku tabungan"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white font-bold outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Alasan Penolakan / Catatan Tambahan</label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Contoh: Tim berhalangan di tanggal pengganti"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRefundForm(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefund}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 text-xs transition shadow-lg shadow-amber-950/40 disabled:opacity-50"
                >
                  {isSubmittingRefund ? 'Memproses Pengajuan...' : 'Kirim Pengajuan Refund Resmi'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="border-t border-slate-800 bg-slate-950/70 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href={waHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition py-1"
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp CS</span>
            </a>

            {!showRefundForm && (
              <button
                type="button"
                onClick={() => setShowRefundForm(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition underline underline-offset-4 py-1"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Ajukan Refund 100% (Form Rekening)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              Nanti Saja
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPicker(booking);
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 px-5 py-2.5 text-xs font-black text-slate-950 hover:from-amber-400 hover:to-emerald-500 shadow-lg shadow-emerald-900/40 transition"
            >
              <Calendar className="h-4 w-4" />
              <span>Pilih Tanggal Pengganti Sekarang</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
