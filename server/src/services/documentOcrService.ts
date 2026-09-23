import { createWorker } from 'tesseract.js';
import path from 'path';

export type DetectedDocumentType = 'AADHAAR' | 'COMPANY_PAN' | 'UNKNOWN';

export interface ExtractedAadhaarData {
  aadhaarNumber: string; // Cleaned 12 digits
  rawNumberMatch: string;
  personName: string;
  formatValid: boolean;
  confidence: number;
}

export interface ExtractedPanData {
  panNumber: string; // Cleaned 10 chars (e.g. ABCDE1234F)
  rawNumberMatch: string;
  companyName: string;
  isCompanyPan: boolean; // 4th char is 'C', 'F', 'A', 'T', 'G', 'L', 'J' etc.
  formatValid: boolean;
  confidence: number;
}

export interface OcrProcessingResult {
  text: string;
  confidence: number; // 0 to 100
  detectedType: DetectedDocumentType;
  aadhaarData?: ExtractedAadhaarData;
  panData?: ExtractedPanData;
  rawLines: string[];
}

function isLikelyImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
  // BMP
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true;
  // WEBP
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
  return false;
}

/**
 * Preprocess image buffer & run OCR text extraction using Tesseract.js worker
 */
export async function performOcrOnBuffer(
  buffer: Buffer,
  filename?: string
): Promise<OcrProcessingResult> {
  let text = '';
  let confidence = 0;

  if (isLikelyImageBuffer(buffer)) {
    try {
      const worker = await createWorker('eng');
      const ret = await worker.recognize(buffer);
      text = ret.data.text || '';
      confidence = Math.round(ret.data.confidence || 0);
      await worker.terminate();
    } catch (err) {
      console.warn('[documentOcrService] Tesseract worker warning, using fallback buffer extraction:', err);
      text = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
      confidence = 70;
    }
  } else {
    // Non-image format (e.g. plain text stream or PDF mock buffer)
    text = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
    confidence = 85;
  }

  const rawLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const detectedType = detectDocumentType(text);

  let aadhaarData: ExtractedAadhaarData | undefined;
  let panData: ExtractedPanData | undefined;

  if (detectedType === 'AADHAAR' || containsAadhaarPattern(text)) {
    aadhaarData = extractAadhaarFields(text, rawLines, confidence);
  }

  if (detectedType === 'COMPANY_PAN' || containsPanPattern(text)) {
    panData = extractPanFields(text, rawLines, confidence);
  }

  // If detected type was unknown but one pattern extracted cleanly, update type
  let finalDetectedType = detectedType;
  if (finalDetectedType === 'UNKNOWN') {
    if (aadhaarData?.formatValid) finalDetectedType = 'AADHAAR';
    else if (panData?.formatValid) finalDetectedType = 'COMPANY_PAN';
  }

  return {
    text,
    confidence,
    detectedType: finalDetectedType,
    aadhaarData,
    panData,
    rawLines,
  };
}

/**
 * Identifies whether document is Aadhaar Card, Company PAN, or Unknown based on keywords
 */
export function detectDocumentType(text: string): DetectedDocumentType {
  const upperText = text.toUpperCase();

  const aadhaarKeywords = [
    'AADHAAR',
    'AADHAR',
    'UNIQUE IDENTIFICATION',
    'GOVERNMENT OF INDIA',
    'GOVT OF INDIA',
    'UIDAI',
    'MALE',
    'FEMALE',
    'DOB:',
    'YOB:',
  ];

  const panKeywords = [
    'INCOME TAX DEPARTMENT',
    'PERMANENT ACCOUNT NUMBER',
    'GOVT. OF INDIA',
    'TAX DEPARTMENT',
    'INCOME TAX',
  ];

  let aadhaarScore = 0;
  let panScore = 0;

  for (const kw of aadhaarKeywords) {
    if (upperText.includes(kw)) aadhaarScore++;
  }

  for (const kw of panKeywords) {
    if (upperText.includes(kw)) panScore++;
  }

  if (containsAadhaarPattern(text)) aadhaarScore += 3;
  if (containsPanPattern(text)) panScore += 3;

  if (aadhaarScore > panScore && aadhaarScore >= 2) return 'AADHAAR';
  if (panScore > aadhaarScore && panScore >= 2) return 'COMPANY_PAN';
  if (aadhaarScore >= 2) return 'AADHAAR';
  if (panScore >= 2) return 'COMPANY_PAN';

  return 'UNKNOWN';
}

function containsAadhaarPattern(text: string): boolean {
  const aadhaarRegex = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/;
  return aadhaarRegex.test(text);
}

function containsPanPattern(text: string): boolean {
  const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/i;
  return panRegex.test(text);
}

/**
 * Validates 12-digit Indian Aadhaar Number format
 * Rule: 12 digits, cannot start with 0 or 1
 */
export function validateAadhaarFormat(aadhaarNumber: string): boolean {
  const cleaned = aadhaarNumber.replace(/[\s-]/g, '');
  if (!/^\d{12}$/.test(cleaned)) return false;
  // Aadhaar numbers do not start with 0 or 1
  if (cleaned.startsWith('0') || cleaned.startsWith('1')) return false;
  // Cannot be all identical digits (e.g. 999999999999)
  if (/^(\d)\1{11}$/.test(cleaned)) return false;
  return true;
}

/**
 * Validates 10-character Indian PAN Number format
 * Rule: 5 uppercase letters + 4 digits + 1 uppercase letter (e.g., ABCDE1234F)
 */
export function validatePanFormat(panNumber: string): boolean {
  const cleaned = panNumber.trim().toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned)) return false;
  return true;
}

/**
 * Extracts Aadhaar number and Person Name from raw OCR text
 */
export function extractAadhaarFields(
  text: string,
  rawLines: string[],
  ocrConfidence: number
): ExtractedAadhaarData {
  let aadhaarNumber = '';
  let rawNumberMatch = '';

  // 12-digit pattern with optional space/hyphen separation
  const match = text.match(/\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/);
  if (match) {
    rawNumberMatch = match[0];
    aadhaarNumber = match[0].replace(/[\s-]/g, '');
  } else {
    // Secondary fallback: find 12 contiguous or space-separated digits
    const digitMatch = text.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
    if (digitMatch) {
      rawNumberMatch = digitMatch[0];
      aadhaarNumber = digitMatch[0].replace(/[\s-]/g, '');
    }
  }

  const formatValid = validateAadhaarFormat(aadhaarNumber);

  // Extract Person Name heuristic
  let personName = '';
  const noiseKeywords = [
    'GOVERNMENT',
    'INDIA',
    'UNIQUE',
    'IDENTIFICATION',
    'AUTHORITY',
    'UIDAI',
    'ENROLLMENT',
    'DOB',
    'MALE',
    'FEMALE',
    'ADDRESS',
    'FATHER',
    'MOTHER',
    'HUSBAND',
    'WIFE',
    'S/O',
    'D/O',
    'W/O',
  ];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    const upperLine = line.toUpperCase();

    // Check lines containing NAME: or starting with TO:
    if (upperLine.includes('NAME:') || upperLine.includes('NAME :')) {
      const candidate = line.replace(/^.*NAME:?\s*/i, '').trim();
      if (candidate.length > 2 && !noiseKeywords.some((k) => candidate.toUpperCase().includes(k))) {
        personName = candidate;
        break;
      }
    }

    if (upperLine.startsWith('TO:') || upperLine.startsWith('TO ')) {
      const candidate = line.replace(/^TO:?\s*/i, '').trim();
      if (candidate.length > 2 && !noiseKeywords.some((k) => candidate.toUpperCase().includes(k))) {
        personName = candidate;
        break;
      }
    }

    if (upperLine.includes('DOB:') || upperLine.includes('YEAR OF BIRTH')) {
      // Name is often 1-2 lines above DOB
      if (i > 0) {
        const prevLine = rawLines[i - 1].trim();
        if (
          prevLine.length > 2 &&
          /^[A-Za-z\s.]+$/.test(prevLine) &&
          !noiseKeywords.some((k) => prevLine.toUpperCase().includes(k))
        ) {
          personName = prevLine;
          break;
        }
      }
    }
  }

  // Fallback: Pick first non-keyword alphabetic line
  if (!personName) {
    for (const line of rawLines) {
      const upper = line.toUpperCase();
      if (
        line.length >= 3 &&
        /^[A-Za-z\s.]+$/.test(line) &&
        !noiseKeywords.some((k) => upper.includes(k))
      ) {
        personName = line;
        break;
      }
    }
  }

  return {
    aadhaarNumber,
    rawNumberMatch,
    personName,
    formatValid,
    confidence: ocrConfidence,
  };
}

/**
 * Extracts PAN number and Company/Business Name from raw OCR text
 */
export function extractPanFields(
  text: string,
  rawLines: string[],
  ocrConfidence: number
): ExtractedPanData {
  let panNumber = '';
  let rawNumberMatch = '';

  const panMatch = text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/i);
  if (panMatch) {
    rawNumberMatch = panMatch[0];
    panNumber = panMatch[0].toUpperCase();
  }

  const formatValid = validatePanFormat(panNumber);

  // Check 4th character entity type
  // C = Company, F = Firm, A = Association, T = Trust, P = Person, G = Government, L = Local Auth, J = Artificial Juridical Person
  const fourthChar = panNumber.length === 10 ? panNumber[3] : '';
  const isCompanyPan = ['C', 'F', 'A', 'T', 'G', 'L', 'J'].includes(fourthChar);

  // Extract Company Name heuristic
  let companyName = '';
  const panNoiseKeywords = [
    'INCOME TAX',
    'DEPARTMENT',
    'GOVT',
    'INDIA',
    'PERMANENT',
    'ACCOUNT',
    'NUMBER',
    'CARD',
    'SIGNATURE',
    'DATE OF INCORPORATION',
    'DATE OF BIRTH',
  ];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    const upperLine = line.toUpperCase();

    if (upperLine.startsWith('NAME') || upperLine.includes('NAME OF')) {
      const candidate = line.replace(/^(NAME|NAME OF THE COMPANY):?\s*/i, '').trim();
      if (candidate.length > 2 && !panNoiseKeywords.some((k) => candidate.toUpperCase().includes(k))) {
        companyName = candidate;
        break;
      }
      if (i + 1 < rawLines.length) {
        const nextLine = rawLines[i + 1].trim();
        if (
          nextLine.length > 2 &&
          !panNoiseKeywords.some((k) => nextLine.toUpperCase().includes(k))
        ) {
          companyName = nextLine;
          break;
        }
      }
    }
  }

  if (!companyName) {
    for (const line of rawLines) {
      const upper = line.toUpperCase();
      if (
        line.length >= 3 &&
        /^[A-Za-z0-9\s.,&'()-]+$/.test(line) &&
        !panNoiseKeywords.some((k) => upper.includes(k))
      ) {
        companyName = line;
        break;
      }
    }
  }

  return {
    panNumber,
    rawNumberMatch,
    companyName,
    isCompanyPan,
    formatValid,
    confidence: ocrConfidence,
  };
}

/**
 * Compares two strings using string normalization and token-based similarity (0.0 to 1.0)
 */
export function calculateStringMatchScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\b(pvt|ltd|limited|llp|inc|co|company|services|works|constructions|construction|builders|builder)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const norm1 = normalize(str1);
  const norm2 = normalize(str2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0;

  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  const tokens1 = new Set(norm1.split(' ').filter((t) => t.length > 1));
  const tokens2 = new Set(norm2.split(' ').filter((t) => t.length > 1));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  return Number((intersection / union).toFixed(2));
}
