import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const response = await esClient.get({
      index: 'resolutions',
      id,
    });

    if (!response.found) {
      return NextResponse.json(
        { ok: false, error: 'not_found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      doc: {
        id: response._id,
        ...(response._source as any),
      },
    });
  } catch (error: any) {
    console.error('Error fetching resolution:', error);

    if (error.statusCode === 404 || error.meta?.statusCode === 404) {
      return NextResponse.json(
        { ok: false, error: 'not_found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'internal_error', details: error.message },
      { status: 500 }
    );
  }
}
