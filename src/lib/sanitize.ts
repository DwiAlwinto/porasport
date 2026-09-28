/**
 * Pembersihan data sebelum disimpan di browser.
 *
 * NIK dan NPWP adalah identitas nasional. `localStorage` dapat dibaca skrip mana
 * pun pada origin yang sama, tidak memerlukan autentikasi, dan tidak terhapus
 * otomatis — sehingga data ini akan bertahan di komputer bersama даже setelah
 * pengguna logout.
 *
 * Data lengkap tetap disimpan di database; yang dipersist di browser hanya
 * ringkasan untuk tampilan.
 */

export const PII_FIELDS = ['nik', 'npwp', 'senderPhone', 'paymentProofUrl'] as const;

export function stripPII<T extends object>(items: T[]): T[] {
  return items.map((item) => {
    const clone = { ...item } as Record<string, unknown>;
    for (const field of PII_FIELDS) {
      if (field in clone) delete clone[field];
    }
    return clone as T;
  });
}
