/**
 * Central Configuration for AI Image Authenticity Detection & Portfolio Constraints
 *
 * All thresholds and limits are centrally managed here so that no values are hardcoded
 * across multiple files.
 */

export const AI_DETECTION_CONFIG = {
  // Classification Thresholds (AI Generation Probability score from 0.00 to 1.00)
  // Confidence <= AI_IMAGE_REAL_THRESHOLD  --> LIKELY_REAL
  // Confidence >= AI_IMAGE_GENERATED_THRESHOLD --> LIKELY_AI_GENERATED
  // Otherwise (between 0.35 and 0.65) --> UNCERTAIN
  AI_IMAGE_REAL_THRESHOLD: 0.35,
  AI_IMAGE_GENERATED_THRESHOLD: 0.65,

  // Portfolio Image Limits
  MAX_PORTFOLIO_IMAGES_PER_CONTRACTOR: 10,
  MAX_IMAGE_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB per image
  ALLOWED_IMAGE_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  ALLOWED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],

  // AI Vision Provider Configuration
  PROVIDER_NAME: 'Groq Vision Forensic Engine',
  MODEL_NAME: 'qwen/qwen3.8-27b',
  FALLBACK_MODEL_NAME: 'qwen/qwen3.6-27b',
  API_TIMEOUT_MS: 20000, // 20 second timeout for vision analysis

  // Weight of portfolio authenticity in recommendation algorithm (0 to 15 points)
  RECOMMENDATION_MAX_AUTHENTICITY_POINTS: 10,
} as const;

export type AiClassificationType =
  | 'LIKELY_REAL'
  | 'LIKELY_AI_GENERATED'
  | 'UNCERTAIN';
