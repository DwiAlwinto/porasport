/**
 * Utilitas penanganan otomatis error versi Server Action Next.js
 * (failed-to-find-server-action) saat server produksi baru selesai di-deploy.
 *
 * Mencegah pesan teknis Next.js muncul di layar pengguna dan melakukan
 * soft-reload aman di latar belakang untuk menyinkronkan aset JavaScript terbaru.
 */

export function isServerActionMismatchError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error);

  return (
    msg.includes('failed-to-find-server-action') ||
    msg.includes('was not found on the server') ||
    msg.includes('could not find server action') ||
    msg.includes('Failed to find Server Action')
  );
}

/**
 * Melakukan soft reload halaman secara aman di latar belakang untuk
 * mengunduh bundle JavaScript terbaru dari server, dengan pencegahan infinite loop.
 */
export function handleServerActionMismatch(onReloading?: () => void): void {
  if (typeof window === 'undefined') return;

  const RELOAD_KEY = 'porasport_last_version_reload';
  const now = Date.now();
  const lastReload = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);

  // Jika baru saja direload dalam 8 detik terakhir, jangan reload berulang kali
  if (now - lastReload < 8000) {
    console.warn('[ActionHandler] Versi server action tidak cocok, reload sudah dilakukan baru-baru ini.');
    return;
  }

  sessionStorage.setItem(RELOAD_KEY, now.toString());
  console.info('[ActionHandler] Terdeteksi build server baru. Melakukan auto-reload untuk memperbarui cache...');

  if (onReloading) {
    onReloading();
  }

  // Soft reload halaman setelah jeda singkat
  setTimeout(() => {
    window.location.reload();
  }, 300);
}
