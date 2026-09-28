# Sport Bekasi — DISBUDPORA Kabupaten Bekasi

Platform pemesanan facility olahraga dan sistem manajemen konten (CMS) untuk
DISBUDPORA Kabupaten Bekasi. Menyediakanatalog facility, pemesanan slot jadwal,
pembayaran QRIS dengan verifikasi bukti transfer otomatis, dan portal admin.

## Teknologi

- **Next.js 16** (App Router, Turbopack) + React 19
- **TypeScript**, **Tailwind CSS 4**
- **Prisma 5** + PostgreSQL (Supabase)
- **Supabase** — Postgres, Auth, dan Storage
- **Google Cloud Vision** — OCR verifikasi bukti pembayaran QRIS
- **Google OAuth** — login opsional (email/password tetap tersedia)

## Menjalankan secara lokal

**Prasyarat:** Node.js 20.9 atau lebih baru, dan sebuah proyek Supabase.

```bash
# 1. Pasang dependensi
npm install

# 2. Siapkan environment
cp .env.example .env
#    lalu isi .env mengikuti komentar di tiap kunci

# 3. Siapkan skema database
npm run db:push

# 4. Jalankan
npm run dev
```

Aplikasi berjalan di <http://localhost:3000>.

### Membuat akun admin pertama

Admin tidak lagi dibuat otomatis oleh aplikasi. Buat lewat CLI:

```bash
npm run db:create-admin -- --email admin@sportbekasi.id --password "KataSandiKuat123!"
```

Kata sandi minimal 12 karakter dan harus memuat minimal tiga dari: huruf
kecil, huruf besar, angka, dan simbol.

### Mengisi tarif facility

```bash
npm run db:seed-rates
```

Script ini mengisi lapangan dan tarifategori untuk Stadion Wibawa Mukti.
Aman dijalankan berulang — hasilnya identik setiap kali dijalankan.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm start` | Menjalankan hasil build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Pemeriksaan tipe TypeScript |
| `npm test` | Menjalankan seluruh test |
| `npm run db:push` | Menerapkan skema Prisma ke database |
| `npm run db:create-admin` | Membuat atau mereset akun admin |
| `npm run db:seed-rates` | Mengisi tarif facility Wibawa Mukti |

## Struktur direktori

```
prisma/
  schema.prisma                 Model database
  create-admin.ts                CLI pembuatan admin
  seed-wibawa-mukti-rates.ts     Seed tarif facility
src/
  actions/                       Server actions (semua titik masuk HTTP)
  components/                    Komponen UI
  lib/
    auth.ts                      Penandatangan & verifikasi cookie sesi
    userAuth.ts                  Sesi pengguna
    pricing.ts                   Sumber kebenaran tunggal perhitungan harga
    rateLimit.ts                 Pembatas laju (in-memory)
    safeUrl.ts                   Sanitasi tujuan navigasi
    sanitize.ts                  Pembersihan PII
    filterUrl.ts                 Serialisasi filter ke query string
    dateKeys.ts                  Kunci tanggal UTC untuk slot jadwal
  proxy.ts                       Penjaga /admin + Content-Security-Policy
  app/
    admin/                       Portal admin (butuh sesi ADMIN/SUPERADMIN)
    api/                         Route handler (webhook, OAuth, cron)
```

## Catatan keamanan

Beberapa hal yang perlu diketahui sebelum mengubah kode:

- **Harga tidak pernah dipercaya dari client.** `createBooking` menghitung
  ulang setiap item dari tabel `field_rates`. Ubahan harga harus lewat
  portal admin atau seed.

- **Setiap server action wajib memverifikasi pemanggil.** Tambahkan cek sesi
  di awal setiap fungsi `"use server"` yang mengubah data. Lihat
  `requireCmsAccess()` di `src/actions/cmsActions.ts` sebagai contoh.

- **Aturan harga hanya boleh di ubah di `src/lib/pricing.ts`.** Fungsi ini
  dipakai bersama oleh server dan client agar tampilan dan tagihan selalu
  sama.

- **`SESSION_SECRET` wajib ada.** Kalau kosong, aplikasi berhenti start
  dengan sengaja. Mengganti nilainya membatalkan seluruh sesi yang sedang
  berjalan.

- **Rate limiter berbasis memori.** Datanya hilang saat restart dan tidak
  dibagi antar instance. Untuk deployment multi-instance, ganti dengan
  Redis/Upstash.

- **Kunci tanggal slot harus lewat `src/lib/dateKeys`.** Kolom
  `FieldSlot.date` bertipe `@db.Date`. Menghitung kunci tanggal dengan cara
  lain (mis. `toISOString()` pada tengah malam waktu lokal) menggeser satu
  hari di wilayah UTC+ dan membuat slot terduplikasi.

- **Bukti pembayaran disimpan sebagai PATH, bukan URL.** Kolom
  `Booking.paymentProofUrl` berisi `payment-proofs/<bookingId>/<file>`, bukan
  URL Supabase. Aksesnya lewat signed URL berumur 600 detik yang dibuatkan
  server. Jangan menggantinya dengan `getPublicUrl()`.

- **Pesan error tidak boleh dikirim mentah ke browser.** Server action harus
  memakai `toPublicMessage(error, "pesan generik")` dari
  `src/lib/userFacingError.ts`, dan pesan yang memang untuk pengguna
  dilempar sebagai `UserFacingError`. `console.error` tetap dipakai supaya
  detailnya tidak hilang untuk debugging server.

## Langkah manual: privatkan bucket bukti pembayaran

Kode sudah siap memakai bucket privat, tetapi menandainya privat harus
dilakukan dari sisi Supabase. **Urutannya penting** — jangan diubah sebelum
kode versi ini ter-deploy, atau OCR dan thumbnail admin akan langsung rusak.

1. Deploy aplikasi versi ini lebih dulu.
2. Buka Supabase → **Storage** → bucket `booking-files`.
3. Klik ikon **⋯** di bucket → **Make private / Make bucket private**.

Selesai. Untuk memastikan, jalankan query ini di SQL Editor Supabase:

```sql
select id, public from storage.buckets where id = 'booking-files';
-- kolom public harus bernilai false
```

Efeknya: setiap URL bukti pembayaran lama yang pernah dibagikan (mis. lewat
WhatsApp atau email) menjadi tidak bisa diakses — dan itulah tujuannya. Admin
tetap bisa melihatnya lewat portal.

## Deployment

- `vercel.json` menjadwalkan `/api/cron/expire-bookings` setiap 5 menit.
  Endpoint itu memerlukan header `Authorization: Bearer $CRON_SECRET`.

- Aplikasi memakai **dynamic rendering** (`force-dynamic` di root layout)
  karena Content-Security-Policy berbasis nonce memerlukan header pada
  setiap request.
