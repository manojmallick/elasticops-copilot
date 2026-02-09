import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Fetch the latest ops-run for this ref_id
    const response = await esClient.search({
      index: 'ops-runs',
      query: {
        term: {
          ref_id: id,
        },
      },
      sort: [{ started_at: { order: 'desc' } }],
      size: 1,
    });
    
    if (response.hits.hits.length === 0) {
      return NextResponse.json(
        { error: 'Timeline not found for this ID' },
        { status: 404 }
      );
    }
    
    const run = response.hits.hits[0];
    
    return NextResponse.json({
      id: run._id,
      ...run._source,
    });
    
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline', details: error.message },
      { status: 500 }
    );
  }
}
