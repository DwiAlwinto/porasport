import * as XLSX from 'xlsx';

export interface ExportFilterMeta {
  periodLabel: string;
  statusLabel: string;
  venueLabel: string;
  adminName?: string;
}

export function formatRupiahNumber(num: number | null | undefined): number {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Number(num);
}

export function getStatusText(status: string, rescheduleStatus?: string | null): string {
  if (rescheduleStatus === 'PENDING_CUSTOMER') return 'GESER PEMDA (MENUNGGU WARGA)';
  if (rescheduleStatus === 'RESOLVED') return 'RESCHEDULE RESMI';
  if (rescheduleStatus === 'REJECTED_REFUND') return 'REFUND PEMDA DIAJUKAN';

  switch (status) {
    case 'PAID_SUCCESS':
      return 'LUNAS (SAH)';
    case 'COMPLETED':
      return 'SELESAI BERMAIN';
    case 'MENUNGGU_VALIDASI':
      return 'MENUNGGU VALIDASI STRUK';
    case 'PENDING_PAYMENT':
      return 'MENUNGGU PEMBAYARAN';
    case 'CANCELLED':
      return 'DIBATALKAN / DITOLAK';
    default:
      return status;
  }
}

export function formatDateTimeWib(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' WIB';
  } catch {
    return String(dateStr);
  }
}

export function formatDateWib(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

export function exportBookingsToExcel(bookings: any[], meta: ExportFilterMeta) {
  // 1. Hitung Ringkasan Finansial Eksekutif
  const totalCount = bookings.length;
  const paidBookings = bookings.filter((b) => b.status === 'PAID_SUCCESS' || b.status === 'COMPLETED');
  const paidCount = paidBookings.length;
  const paidRevenue = paidBookings.reduce((sum, b) => sum + (b.grandTotal || b.totalPrice || 0), 0);

  const pendingValidationBookings = bookings.filter((b) => b.status === 'MENUNGGU_VALIDASI');
  const pendingValidationAmount = pendingValidationBookings.reduce((sum, b) => sum + (b.grandTotal || b.totalPrice || 0), 0);

  const pendingPaymentBookings = bookings.filter((b) => b.status === 'PENDING_PAYMENT');
  const pendingPaymentAmount = pendingPaymentBookings.reduce((sum, b) => sum + (b.grandTotal || b.totalPrice || 0), 0);

  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED');
  const cancelledAmount = cancelledBookings.reduce((sum, b) => sum + (b.grandTotal || b.totalPrice || 0), 0);

  const downloadTimeWib = formatDateTimeWib(new Date());

  // 2. Susun Baris-Baris Lembar Kerja (Worksheet Rows)
  const rows: any[][] = [];

  // Kop Instansi Resmi
  rows.push(['PEMERINTAH KABUPATEN BEKASI']);
  rows.push(['DINAS KEBUDAYAAN, PEMUDA DAN OLAHRAGA (DISBUDPORA)']);
  rows.push(['LAPORAN REKAPITULASI TRANSAKSI RETRIBUSI & PENDAPATAN DAERAH (SPORT BEKASI)']);
  rows.push([`Periode: ${meta.periodLabel}  |  Status: ${meta.statusLabel}  |  Venue: ${meta.venueLabel}`]);
  rows.push([`Waktu Unduh: ${downloadTimeWib}  |  Petugas / Operator: ${meta.adminName || 'Admin DISBUDPORA'}`]);
  rows.push([]); // Baris Kosong

  // Kotak Ringkasan Finansial
  rows.push(['RINGKASAN EKSEKUTIF PENDAPATAN & TRANSAKSI']);
  rows.push([
    'Total Transaksi',
    'Total Transaksi Lunas',
    'Total Pendapatan Bersih (PAD Lunas)',
    'Menunggu Validasi Struk',
    'Menunggu Pembayaran',
    'Dibatalkan / Kadaluwarsa'
  ]);
  rows.push([
    `${totalCount} Pesanan`,
    `${paidCount} Pesanan`,
    paidRevenue,
    pendingValidationAmount,
    pendingPaymentAmount,
    cancelledAmount
  ]);
  rows.push([]); // Baris Kosong

  // Header Tabel Rincian Data
  rows.push(['TABEL RINCIAN TRANSAKSI RETRIBUSI & JADWAL SEWA']);
  const tableHeaders = [
    'No',
    'ID Pesanan (No. Registrasi)',
    'Waktu Transaksi (WIB)',
    'Nama Pemesan / Wajib Retribusi',
    'Identitas (NIK / NISN)',
    'NPWP',
    'No. WhatsApp / HP',
    'Email',
    'Nama Venue / Sarana',
    'Lapangan & Cabor',
    'Jadwal Pemakaian (Tanggal & Jam)',
    'Kuantitas / Sesi',
    'Tarif Sewa (Rp)',
    'Biaya Layanan (Rp)',
    'Total Retribusi Daerah (Rp)',
    'Metode Bayar',
    'Status Pembayaran',
    'Status Reschedule Pemda',
    'Catatan Admin / Ref OCR'
  ];
  rows.push(tableHeaders);

  // Isi Data Transaksi
  bookings.forEach((b, index) => {
    // Ambil rincian lapangan dan jadwal dari items
    const fieldNames = b.items && b.items.length > 0
      ? b.items.map((it: any) => `${it.field?.name || 'Lapangan'} (${it.field?.sportType || b.sportCategory || ''})`).join('; ')
      : b.sportCategory || '-';

    const scheduleDetails = b.items && b.items.length > 0
      ? b.items.map((it: any) => `${formatDateWib(it.date)} [${it.timeStart}-${it.timeEnd}]`).join('; ')
      : '-';

    const totalQuantity = b.items && b.items.length > 0
      ? b.items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0)
      : 1;

    const row = [
      index + 1,
      b.id,
      formatDateTimeWib(b.createdAt),
      b.senderName || b.user?.name || 'Umum',
      b.nik ? `'${b.nik}` : '-', // Kutip agar Excel tidak mengubah NIK 16 digit jadi notasi ilmiah
      b.npwp ? `'${b.npwp}` : '-',
      b.senderPhone || b.user?.phone ? `'${b.senderPhone || b.user?.phone}` : '-',
      b.user?.email || '-',
      b.venue?.name || 'Venue Kab. Bekasi',
      fieldNames,
      scheduleDetails,
      `${totalQuantity} Sesi / Tiket`,
      formatRupiahNumber(b.totalPrice),
      formatRupiahNumber(b.serviceFee),
      formatRupiahNumber(b.grandTotal || b.totalPrice),
      b.paymentMethod || 'QRIS',
      getStatusText(b.status, b.rescheduleStatus),
      b.rescheduleStatus ? getStatusText(b.status, b.rescheduleStatus) : 'Normal',
      b.adminNotes || (b.ocrValidationResult?.passed ? 'OCR Lolos' : '-')
    ];

    rows.push(row);
  });

  // Baris Total di bagian akhir tabel
  rows.push([]);
  rows.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTAL RETRIBUSI LUNAS (PAD):',
    paidRevenue,
    '',
    `${paidCount} dari ${totalCount} Lunas`,
    '',
    ''
  ]);

  // 3. Konversi array ke Worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 4. Auto-fit Lebar Kolom
  const colWidths = [
    { wch: 6 },  // No
    { wch: 22 }, // ID Pesanan
    { wch: 24 }, // Waktu Transaksi
    { wch: 28 }, // Nama Pemesan
    { wch: 20 }, // NIK
    { wch: 18 }, // NPWP
    { wch: 18 }, // No HP
    { wch: 26 }, // Email
    { wch: 30 }, // Venue
    { wch: 32 }, // Lapangan & Cabor
    { wch: 34 }, // Jadwal Pemakaian
    { wch: 16 }, // Kuantitas
    { wch: 16 }, // Tarif Sewa
    { wch: 16 }, // Biaya Layanan
    { wch: 24 }, // Total Retribusi Daerah
    { wch: 16 }, // Metode Bayar
    { wch: 24 }, // Status Pembayaran
    { wch: 24 }, // Status Reschedule
    { wch: 35 }, // Catatan
  ];
  ws['!cols'] = colWidths;

  // 5. Buat Workbook dan download file
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Retribusi');

  const todayStr = new Date().toISOString().slice(0, 10);
  const fileName = `Laporan_Retribusi_SPORT_BEKASI_${todayStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

export function exportBookingsToCSV(bookings: any[], meta: ExportFilterMeta) {
  const headers = [
    'No',
    'ID Pesanan',
    'Waktu Transaksi',
    'Nama Pemesan',
    'NIK',
    'NPWP',
    'No Telepon',
    'Email',
    'Venue',
    'Lapangan & Cabor',
    'Jadwal Pemakaian',
    'Kuantitas',
    'Tarif Sewa (Rp)',
    'Biaya Layanan (Rp)',
    'Total Retribusi (Rp)',
    'Metode Pembayaran',
    'Status',
    'Catatan'
  ];

  const csvRows = [headers.join(',')];

  bookings.forEach((b, index) => {
    const fieldNames = b.items && b.items.length > 0
      ? b.items.map((it: any) => `${it.field?.name || 'Lapangan'} (${it.field?.sportType || ''})`).join('; ')
      : b.sportCategory || '-';

    const scheduleDetails = b.items && b.items.length > 0
      ? b.items.map((it: any) => `${formatDateWib(it.date)} ${it.timeStart}-${it.timeEnd}`).join('; ')
      : '-';

    const totalQuantity = b.items && b.items.length > 0
      ? b.items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0)
      : 1;

    const sanitize = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const row = [
      index + 1,
      sanitize(b.id),
      sanitize(formatDateTimeWib(b.createdAt)),
      sanitize(b.senderName || b.user?.name || 'Umum'),
      sanitize(b.nik || '-'),
      sanitize(b.npwp || '-'),
      sanitize(b.senderPhone || b.user?.phone || '-'),
      sanitize(b.user?.email || '-'),
      sanitize(b.venue?.name || '-'),
      sanitize(fieldNames),
      sanitize(scheduleDetails),
      sanitize(totalQuantity),
      formatRupiahNumber(b.totalPrice),
      formatRupiahNumber(b.serviceFee),
      formatRupiahNumber(b.grandTotal || b.totalPrice),
      sanitize(b.paymentMethod || 'QRIS'),
      sanitize(getStatusText(b.status, b.rescheduleStatus)),
      sanitize(b.adminNotes || '-')
    ];

    csvRows.push(row.join(','));
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRows.join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  const todayStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `Laporan_Retribusi_SPORT_BEKASI_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
