import { ImageAnnotatorClient } from '@google-cloud/vision'
import { downloadProof, MAX_PROOF_BYTES } from './storage'

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

const DEFAULT_KEYWORDS = ['DISBUDPORA', 'BJB', 'PAN']

function extractAmounts(text: string): number[] {
  const matches = text.match(/(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g)
  if (!matches) return []
  
  return matches
    .map(m => m.replace(/[^\d]/g, ''))
    .map(n => parseInt(n, 10))
    .filter(n => !isNaN(n) && n > 0)
}

function checkDateMatch(text: string): { match: boolean; detected?: string } {
  const today = new Date()
  const patterns = [
    today.toISOString().split('T')[0].replace(/-/g, ''),     // YYYYMMDD
    today.toISOString().split('T')[0],                         // YYYY-MM-DD
    today.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }), // DD/MM/YYYY
    today.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),    // DD Month YYYY
    today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),   // D MMM YYYY
    `${today.getDate()}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`, // DD/MM/YYYY
  ]

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
    throw new Error('Layanan OCR belum dikonfigurasi. Hubungi admin sistem.');
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