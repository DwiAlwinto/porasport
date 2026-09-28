/**
 * Konstanta key untuk system_settings di database.
 * File ini bukan "use server" sehingga bisa di-import dari mana saja.
 */
export const SETTING_KEYS = {
  QRIS_IMAGE_URL: 'qris_image_url',
  PAYMENT_NOTES: 'payment_notes',
  QRIS_LABEL: 'qris_label',
  BANK_NAME: 'bank_name',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
