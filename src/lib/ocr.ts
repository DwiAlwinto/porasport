import { ImageAnnotatorClient } from '@google-cloud/vision'
import { downloadProof, MAX_PROOF_BYTES } from './storage'
import { UserFacingError } from './userFacingError'

const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON

let visionClient: ImageAnnotatorClient | null = null

if (credentialsJson) {
  try {
    const credentials = JSON.parse(credentialsJson)
    visionClient = new ImageAnnotatorClient({ credentials })
  } catch (e) {
    console.error('[OCR] Failed to parse Google Cloud credentials:', e)
  }
} else {
  console.warn('[OCR] GOOGLE_CLOUD_CREDENTIALS_JSON not set. OCR validation will be skipped.')
}

export interface OCRValidationResult {
  amountMatch: boolean
  dateMatch: boolean
  keywordMatch: boolean
  passed: boolean
  extractedText: string
  expectedAmount: number
  expectedKeywords: string[]
  detectedAmounts: number[]
  detectedDate?: string
  detectedKeywords: string[]
}

const DEFAULT_KEYWORDS = ['DISBUDPORA', 'BJB', 'PAN', 'QRIS']

function extractAmounts(text: string): number[] {
  // Dukung pola IDR 10.000,00 / Rp. 10.000 / 10,000.00 / 10.000 / 10000
  const matches = text.match(/(?:(?:Rp|IDR)\.?\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+)/gi)
  if (!matches) return []
  
  const amounts = new Set<number>()

  for (const m of matches) {
    const cleaned = m.replace(/^(?:Rp|IDR)\.?\s*/i, '').trim()
    if (!cleaned) continue

    // Jika berakhiran 2 digit desimal (,00 atau .00 untuk sen rupiah)
    if (/[.,]\d{2}$/.test(cleaned)) {
      const withoutCents = cleaned.slice(0, -3).replace(/[^\d]/g, '')
      const valWithoutCents = parseInt(withoutCents, 10)
      if (!isNaN(valWithoutCents) && valWithoutCents > 0) {
        amounts.add(valWithoutCents)
      }
    }

    // Ekstraksi nilai mentah jika berupa nominal utuh tanpa desimal
    const rawDigits = cleaned.replace(/[^\d]/g, '')
    const valRaw = parseInt(rawDigits, 10)
    if (!isNaN(valRaw) && valRaw > 0) {
      amounts.add(valRaw)
    }
  }

  return Array.from(amounts)
}

function checkDateMatch(text: string): { match: boolean; detected?: string } {
  const datesToCheck: Date[] = []
  const now = new Date()

  // Periksa toleransi H-1, Hari Ini, dan H+1 untuk mengakomodasi perbedaan zona waktu (UTC vs WIB / Asia/Jakarta)
  for (let offset = -1; offset <= 1; offset++) {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    datesToCheck.push(d)
  }

  const patterns = new Set<string>()

  for (const d of datesToCheck) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dNum = String(d.getDate())

    // 1. Numerik: YYYYMMDD, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    patterns.add(`${yyyy}${mm}${dd}`)
    patterns.add(`${yyyy}-${mm}-${dd}`)
    patterns.add(`${dd}/${mm}/${yyyy}`)
    patterns.add(`${dd}-${mm}-${yyyy}`)
    patterns.add(`${dNum}/${mm}/${yyyy}`)
    patterns.add(`${dNum}-${mm}-${yyyy}`)

    // 2. Format Indonesia (id-ID)
    patterns.add(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }))
    patterns.add(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }))
    patterns.add(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }))
    patterns.add(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }))

    // 3. Format Bahasa Inggris (en-GB / en-US): "22 October 2026", "22 Oct 2026", "October 22, 2026"
    patterns.add(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }))
    patterns.add(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
    patterns.add(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))
    patterns.add(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))
    patterns.add(d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }))
    patterns.add(d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }))
  }

  const upperText = text.toUpperCase()
  for (const pattern of patterns) {
    if (upperText.includes(pattern.toUpperCase())) {
      return { match: true, detected: pattern }
    }
  }
  return { match: false }
}

function checkKeywords(text: string, keywords: string[]): { match: boolean; detected: string[] } {
  const upperText = text.toUpperCase()
  const detected = keywords.filter(k => upperText.includes(k.toUpperCase()))
  return { match: detected.length > 0, detected }
}

/**
 * Jalankan OCR pada bukti pembayaran.
 *
 * `proofRef` boleh berupa path bucket (`payment-proofs/...`) maupun URL.
 * Berkas diunduh lewat service role, bukan `fetch()` tanpa autentikasi, sehingga
 * bucket bisa dibuat privat dan aplikasi ini tidak bisa dipaksa melakukan SSRF
 * ke URL arbitrer.
 */
export async function runOCRValidation(
  proofRef: string,
  expectedAmount: number,
  expectedKeywords: string[] = DEFAULT_KEYWORDS
): Promise<OCRValidationResult> {
  if (!visionClient) {
    throw new UserFacingError(
      'Layanan Google Cloud Vision OCR belum dikonfigurasi di server produksi (variabel GOOGLE_CLOUD_CREDENTIALS_JSON belum disetel). Silakan gunakan tombol hijau "Setujui Lunas & Terbitkan Tiket" untuk validasi manual kasir.'
    );
  }

  const imageBuffer = await downloadProof(proofRef);
  if (!imageBuffer) {
    throw new Error('Berkas bukti pembayaran tidak dapat diunduh untuk diverifikasi.');
  }
  if (imageBuffer.length > MAX_PROOF_BYTES) {
    throw new Error('Ukuran berkas bukti melebihi batas.');
  }

  try {
    const [result] = await visionClient.textDetection({ image: { content: imageBuffer } })
    const fullText = result.fullTextAnnotation?.text || ''

    if (!fullText.trim()) {
      return {
        amountMatch: false,
        dateMatch: false,
        keywordMatch: false,
        passed: false,
        extractedText: '',
        expectedAmount,
        expectedKeywords,
        detectedAmounts: [],
        detectedKeywords: [],
      }
    }

    const detectedAmounts = extractAmounts(fullText)
    const amountMatch = detectedAmounts.some(a => a === expectedAmount)

    const dateResult = checkDateMatch(fullText)
    const dateMatch = dateResult.match

    const keywordResult = checkKeywords(fullText, expectedKeywords)
    const keywordMatch = keywordResult.match

    return {
      amountMatch,
      dateMatch,
      keywordMatch,
      passed: amountMatch && dateMatch && keywordMatch,
      extractedText: fullText,
      expectedAmount,
      expectedKeywords,
      detectedAmounts,
      detectedDate: dateResult.detected,
      detectedKeywords: keywordResult.detected,
    }
  } catch (e) {
    console.error('[OCR] Vision API error:', e)
    throw new Error(`OCR gagal memproses gambar: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
}

export function getOCRStatusMessage(result: OCRValidationResult): string {
  if (result.passed) {
    return '✅ Validasi otomatis berhasil: Nominal, tanggal, dan kata kunci sesuai.'
  }
  
  const issues: string[] = []
  if (!result.amountMatch) {
    issues.push(`Nominal tidak sesuai (diharapkan: ${result.expectedAmount.toLocaleString('id-ID')}, terdeteksi: ${result.detectedAmounts.join(', ') || 'tidak terbaca'})`)
  }
  if (!result.dateMatch) {
    issues.push('Tanggal tidak sesuai dengan hari ini')
  }
  if (!result.keywordMatch) {
    issues.push(`Kata kunci tidak ditemukan (diharapkan: ${result.expectedKeywords.join(', ')})`)
  }
  
  return `⚠️ Validasi otomatis gagal: ${issues.join('; ')}. Akan diverifikasi manual oleh admin.`
}