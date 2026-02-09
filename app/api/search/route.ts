import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';
import { generateEmbedding } from '@/lib/embed';
import { buildHybridSearch, buildTicketDedupeSearch } from '@/lib/searchTemplates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, mode = 'kb', k = 10 } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    const queryVector = generateEmbedding(query);
    
    let response;
    
    if (mode === 'kb') {
      // Hybrid search on KB articles
      const searchQuery = buildHybridSearch(
        query,
        queryVector,
        ['title', 'content'],
        'embedding',
        k
      );
      
      response = await esClient.search({
        index: 'kb-articles',
        ...searchQuery,
        explain: true,
      });
      
    } else if (mode === 'tickets') {
      // Ticket deduplication search
      const searchQuery = buildTicketDedupeSearch(queryVector, undefined, undefined, k);
      
      response = await esClient.search({
        index: 'tickets',
        ...searchQuery,
        explain: true,
      });
      
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use "kb" or "tickets"' },
        { status: 400 }
      );
    }
    
    const hits = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      source: hit._source,
      highlight: hit.highlight || {},
      explanation: hit._explanation ? formatExplanation(hit._explanation) : null,
    }));
    
    return NextResponse.json({
      query,
      mode,
      hits,
      total: response.hits.total,
    });
    
  } catch (error: any) {
    console.error('Error executing search:', error);
    return NextResponse.json(
      { error: 'Failed to execute search', details: error.message },
      { status: 500 }
    );
  }
}

// Format Elasticsearch explanation for readability
function formatExplanation(explanation: any): string {
  if (!explanation) return '';
  
  let result = `${explanation.description} (value: ${explanation.value?.toFixed(4) || 0})`;
  
  if (explanation.details && explanation.details.length > 0) {
    result += '\n' + explanation.details
      .map((d: any) => `  • ${d.description} (${d.value?.toFixed(4) || 0})`)
      .join('\n');
  }
  
  return result;
}
