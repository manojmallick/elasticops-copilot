import crypto from 'crypto';

const EMBED_DIMS = parseInt(process.env.EMBED_DIMS || '384', 10);

/**
 * Deterministic pseudo-embedding function using SHA-256.
 * Creates reproducible 384-dimensional vectors from text input.
 * This ensures demo consistency without requiring external embedding APIs.
 */
export function generateEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  const hash = crypto.createHash('sha256').update(normalized).digest();
  
  const embedding: number[] = [];
  
  // Generate 384 dimensions from hash using multiple rounds
  const rounds = Math.ceil(EMBED_DIMS / 32); // 32 bytes per hash = 32 float values
  
  for (let round = 0; round < rounds; round++) {
    const roundHash = crypto
      .createHash('sha256')
      .update(hash)
      .update(Buffer.from([round]))
      .digest();
    
    for (let i = 0; i < 32 && embedding.length < EMBED_DIMS; i++) {
      // Convert byte to float in range [-1, 1]
      const value = (roundHash[i] / 255.0) * 2 - 1;
      embedding.push(value);
    }
  }
  
  // Normalize to unit length for cosine similarity
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

/**
 * Batch generate embeddings for multiple texts
 */
export function generateEmbeddings(texts: string[]): number[][] {
  return texts.map(text => generateEmbedding(text));
}
