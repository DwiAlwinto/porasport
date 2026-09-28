import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sport Bekasi - Wibawa Mukti Stadium",
  description: "Platform booking venue olahraga terlengkap di Kabupaten Bekasi.",
};

/**
 * Paksa render dinamis.
 *
 * Content-Security-Policy memakai nonce yang dibuat di `src/proxy.ts`. Nonce
 * hanya bisa disisipkan Next.js saat server rendering, sehingga halaman yang
 * diprerender sebagai statis tidak akan pernah mendapat nonce dan script-nya
 * akan diblokir CSP. Aplikasi ini memang berbasis sesi pengguna, jadi render
 * dinamis memang yang tepat.
 */
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
