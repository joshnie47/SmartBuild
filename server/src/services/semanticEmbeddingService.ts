/**
 * Semantic Embedding Service
 * Generates dense vector representations for text (project titles, client reviews)
 * and calculates cosine similarity to measure semantic relevance.
 */

const VECTOR_DIM = 128;

// Domain concept dictionary mapping semantically related construction concepts
const DOMAIN_CONCEPTS: { [concept: string]: string[] } = {
  commercial_building: [
    'commercial', 'multiplex', 'shopping', 'complex', 'mall', 'office', 'store',
    'showroom', 'building', 'structure', 'plaza', 'tower', 'commercial construction',
    'retail', 'business', 'hall', 'auditorium'
  ],
  residential_home: [
    'residential', 'house', 'home', 'apartment', 'villa', 'flat', 'bungalow',
    'duplex', 'living', 'bedroom', 'kitchen', 'interior', 'modular'
  ],
  civil_structural: [
    'civil', 'foundation', 'structural', 'construction', 'brickwork', 'concrete',
    'column', 'beam', 'slab', 'masonry', 'mason', 'wall', 'reinforcement', 'cement'
  ],
  road_infrastructure: [
    'road', 'highway', 'infrastructure', 'asphalt', 'pavement', 'bridge',
    'earthwork', 'drainage', 'pathway', 'tarring', 'lane'
  ],
  plumbing_water: [
    'plumbing', 'pipe', 'plumber', 'water', 'tank', 'leak', 'leakage', 'fitting',
    'drainage', 'bathroom', 'sanitary', 'faucet', 'pipeline', 'pump'
  ],
  electrical_power: [
    'electrical', 'electrician', 'wiring', 'cable', 'panel', 'lighting', 'power',
    'switch', 'fixture', 'circuit', 'inverter', 'voltage'
  ],
  painting_decor: [
    'painting', 'painter', 'paint', 'wall', 'color', 'coating', 'primer', 'grill',
    'gate', 'putty', 'finish', 'exterior', 'emulsion'
  ],
  carpentry_woodwork: [
    'carpentry', 'carpenter', 'woodwork', 'wood', 'door', 'window', 'furniture',
    'cabinet', 'wardrobe', 'kitchen woodwork', 'pooja room', 'plywood'
  ],
  roofing_waterproofing: [
    'roofing', 'roofer', 'roof', 'waterproofing', 'waterproof', 'terrace',
    'sealing', 'dampness', 'slab waterproofing', 'sheet'
  ],
  timely_execution: [
    'schedule', 'timeline', 'time', 'on time', 'punctual', 'fast', 'speed',
    'ahead of schedule', 'deadline', 'prompt', 'quick', 'completed on schedule'
  ],
  quality_craftsmanship: [
    'quality', 'excellent', 'craftsmanship', 'perfect', 'neat', 'durable',
    'professional', 'high quality', 'satisfaction', 'superior', 'flawless'
  ],
  budget_pricing: [
    'budget', 'cost', 'price', 'fair', 'reasonable', 'affordable', 'value',
    'economical', 'quote', 'transparent'
  ]
};

// Stop words to filter out during normalization
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'our', 'my', 'your', 'this', 'work', 'done', 'job', 'contractor', 'project'
]);

/**
 * Simple string hash function for vector projection
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Preprocess and tokenize text into normalized tokens
 */
export function preprocessText(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');
  return words.filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Generate a 128-dimensional dense semantic vector for a given text
 */
export function generateEmbedding(text: string): number[] {
  const vector = new Array(VECTOR_DIM).fill(0);
  const tokens = preprocessText(text);

  if (tokens.length === 0) {
    return vector;
  }

  const textLower = text.toLowerCase();

  // 1. Concept Domain Vector Mapping (Explicit semantic feature weights)
  let conceptIdx = 0;
  for (const [conceptKey, keywords] of Object.entries(DOMAIN_CONCEPTS)) {
    let matchCount = 0;
    for (const kw of keywords) {
      if (textLower.includes(kw)) {
        matchCount += 1.5;
      }
    }

    if (matchCount > 0) {
      // Allocate 6 dimensions per domain concept cluster
      const baseDim = (conceptIdx * 6) % VECTOR_DIM;
      for (let offset = 0; offset < 6; offset++) {
        vector[(baseDim + offset) % VECTOR_DIM] += matchCount;
      }
    }
    conceptIdx++;
  }

  // 2. Token & N-Gram Feature Hashing for out-of-vocabulary semantic subwords
  for (const token of tokens) {
    // Word hash
    const dim1 = hashString(token) % VECTOR_DIM;
    vector[dim1] += 1.0;

    // Character 3-grams
    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i++) {
        const trigram = token.substring(i, i + 3);
        const dim2 = hashString(trigram) % VECTOR_DIM;
        vector[dim2] += 0.4;
      }
    }
  }

  // 3. L2 Normalization
  let sumSq = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    sumSq += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

/**
 * Calculate Cosine Similarity between two embedding vectors.
 * Returns float in [0.0, 1.0].
 */
export function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (!vectorA || !vectorB || vectorA.length === 0 || vectorB.length === 0) {
    return 0;
  }

  if (vectorA.length !== vectorB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  const magA = Math.sqrt(normA);
  const magB = Math.sqrt(normB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  const similarity = dotProduct / (magA * magB);
  // Clip to [0.0, 1.0] range
  return Math.min(1.0, Math.max(0.0, similarity));
}
