import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const response = await esClient.get({
      index: 'incidents',
      id,
    });
    
    return NextResponse.json({
      id: response._id,
      ...(response._source || {}),
    });
    
  } catch (error: any) {
    if (error.meta?.statusCode === 404) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }
    
    console.error('Error fetching incident:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incident', details: error.message },
      { status: 500 }
    );
  }
}
