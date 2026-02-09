import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status')?.split(',').filter(Boolean) || ['open', 'investigating'];
    const from = parseInt(searchParams.get('from') || '0', 10);
    const size = parseInt(searchParams.get('size') || '50', 10);
    
    const response = await esClient.search({
      index: 'incidents',
      query: {
        bool: {
          filter: [
            { terms: { status } },
          ],
        },
      },
      sort: [{ detected_at: { order: 'desc' } }],
      from,
      size,
    });
    
    const incidents = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
    }));
    
    return NextResponse.json({
      incidents,
      total: response.hits.total,
      from,
      size,
    });
    
  } catch (error: any) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents', details: error.message },
      { status: 500 }
    );
  }
}
