import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';
import { buildTicketSearch } from '@/lib/searchTemplates';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse filters from query params
    const status = searchParams.get('status')?.split(',').filter(Boolean);
    const category = searchParams.get('category')?.split(',').filter(Boolean);
    const severity = searchParams.get('severity')?.split(',').filter(Boolean);
    const priority = searchParams.get('priority')?.split(',').filter(Boolean);
    const from = parseInt(searchParams.get('from') || '0', 10);
    const size = parseInt(searchParams.get('size') || '50', 10);
    
    const searchQuery = buildTicketSearch({
      status,
      category,
      severity,
      priority,
      from,
      size,
    });
    
    const response = await esClient.search({
      index: 'tickets',
      ...searchQuery,
    });
    
    const tickets = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
    }));
    
    return NextResponse.json({
      tickets,
      total: response.hits.total,
      from,
      size,
    });
    
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets', details: error.message },
      { status: 500 }
    );
  }
}
