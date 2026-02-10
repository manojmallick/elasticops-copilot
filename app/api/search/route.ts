import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';
import { generateEmbedding } from '@/lib/embed';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, mode = 'kb', k = 10, rrfK = 60 } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    const queryVector = generateEmbedding(query);
    
    let index: string;
    let textFields: string[];
    let vectorField: string;
    
    if (mode === 'kb') {
      index = 'kb-articles';
      textFields = ['title^2', 'content'];
      vectorField = 'embedding';
    } else if (mode === 'tickets') {
      index = 'tickets';
      textFields = ['subject^2', 'description', 'customer_message'];
      vectorField = 'embedding';
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use "kb" or "tickets"' },
        { status: 400 }
      );
    }
    
    // Run BM25 text search
    const bm25Response = await esClient.search({
      index,
      size: k * 2, // Get more candidates for RRF
      query: {
        multi_match: {
          query,
          fields: textFields,
          fuzziness: 'AUTO',
        },
      },
      _source: true,
    });
    
    // Run kNN vector search
    const knnResponse = await esClient.search({
      index,
      size: k * 2,
      knn: {
        field: vectorField,
        query_vector: queryVector,
        k: k * 2,
        num_candidates: 100,
      },
      _source: true,
    });
    
    // Build ranking maps
    const bm25Ranks = new Map<string, { score: number; rank: number }>();
    bm25Response.hits.hits.forEach((hit: any, idx: number) => {
      bm25Ranks.set(hit._id, { score: hit._score || 0, rank: idx + 1 });
    });
    
    const knnRanks = new Map<string, { score: number; rank: number }>();
    knnResponse.hits.hits.forEach((hit: any, idx: number) => {
      knnRanks.set(hit._id, { score: hit._score || 0, rank: idx + 1 });
    });
    
    // Combine all unique doc IDs
    const allDocIds = new Set([
      ...Array.from(bm25Ranks.keys()),
      ...Array.from(knnRanks.keys()),
    ]);
    
    // Compute RRF scores
    const rrfScores = new Map<string, any>();
    const docsById = new Map<string, any>();
    
    // Store documents
    bm25Response.hits.hits.forEach((hit: any) => {
      docsById.set(hit._id, hit._source);
    });
    knnResponse.hits.hits.forEach((hit: any) => {
      docsById.set(hit._id, hit._source);
    });
    
    for (const docId of allDocIds) {
      const bm25 = bm25Ranks.get(docId);
      const knn = knnRanks.get(docId);
      
      // RRF formula: score = sum(1 / (k + rank))
      let rrfScore = 0;
      if (bm25) {
        rrfScore += 1 / (rrfK + bm25.rank);
      }
      if (knn) {
        rrfScore += 1 / (rrfK + knn.rank);
      }
      
      rrfScores.set(docId, {
        docId,
        finalScore: rrfScore,
        bm25: bm25 ? { score: bm25.score, rank: bm25.rank } : null,
        vector: knn ? { score: knn.score, rank: knn.rank } : null,
        source: docsById.get(docId),
      });
    }
    
    // Sort by RRF score and take top k
    const rankedDocs = Array.from(rrfScores.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, k);
    
    // Format response
    const hits = rankedDocs.map((doc) => ({
      id: doc.docId,
      score: doc.finalScore,
      source: doc.source,
      explain: {
        bm25: doc.bm25,
        vector: doc.vector,
        rrf: { k: rrfK },
      },
    }));
    
    return NextResponse.json({
      query,
      mode,
      hits,
      total: { value: allDocIds.size, relation: 'eq' },
      algorithm: 'rrf',
      rrfK,
    });
    
  } catch (error: any) {
    console.error('Error executing search:', error);
    return NextResponse.json(
      { error: 'Failed to execute search', details: error.message },
      { status: 500 }
    );
  }
}
