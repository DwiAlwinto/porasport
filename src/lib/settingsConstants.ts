/**
 * Konstanta key untuk system_settings di database.
 * File ini bukan "use server" sehingga bisa di-import dari mana saja.
 */
export const SETTING_KEYS = {
  // QRIS & Pembayaran
  QRIS_IMAGE_URL: 'qris_image_url',
  PAYMENT_NOTES: 'payment_notes',
  QRIS_LABEL: 'qris_label',
  BANK_NAME: 'bank_name',

  // WhatsApp & Kontak
  WHATSAPP_NUMBER: 'whatsapp_number',
  WHATSAPP_MESSAGE: 'whatsapp_message',
  CONTACT_EMAIL: 'contact_email',
  OFFICE_ADDRESS: 'office_address',

  // Footer & Branding
  FOOTER_TAGLINE: 'footer_tagline',
  FOOTER_COPYRIGHT: 'footer_copyright',

  // FIND US (Hanya Instagram & YouTube sesuai permintaan user)
  SOCIAL_INSTAGRAM: 'social_instagram',
  SOCIAL_YOUTUBE: 'social_youtube',

  // Tautan Aplikasi
  PLAYSTORE_URL: 'playstore_url',
  APPSTORE_URL: 'appstore_url',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

