import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Guard with demo secret
    const demoSecret = request.headers.get('x-demo-secret');
    
    if (!process.env.DEMO_SECRET) {
      return NextResponse.json(
        { ok: false, error: 'DEMO_SECRET not configured' },
        { status: 500 }
      );
    }
    
    if (demoSecret !== process.env.DEMO_SECRET) {
      return NextResponse.json(
        { ok: false, error: 'Invalid demo secret' },
        { status: 401 }
      );
    }
    
    // Generate 60 error logs
    const errorCount = 60;
    const now = Date.now();
    const operations = [];
    
    const errorMessages = [
      'Payment gateway returned 502 Bad Gateway',
      'Webhook delivery failed - connection timeout',
      'Database connection pool exhausted',
      'Rate limit exceeded on payment processor',
      'Authentication service unavailable',
    ];
    
    for (let i = 0; i < errorCount; i++) {
      // Spread over last 2 minutes
      const timestamp = new Date(now - Math.random() * 2 * 60 * 1000);
      const message = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      
      const doc = {
        '@timestamp': timestamp.toISOString(),
        level: 'ERROR',
        service: 'api-gateway',
        env: 'production',
        endpoint: '/payments/webhook',
        status_code: 502,
        message,
        trace_id: `trace_${Math.random().toString(36).substr(2, 9)}`,
        user_id: `user_${Math.floor(Math.random() * 1000)}`,
        duration_ms: Math.floor(Math.random() * 5000) + 100,
      };
      
      operations.push({ index: { _index: 'logs-app' } });
      operations.push(doc);
    }
    
    // Bulk insert with refresh
    const bulkResponse = await esClient.bulk({
      refresh: true,
      operations,
    });
    
    if (bulkResponse.errors) {
      const erroredDocs = bulkResponse.items
        .filter((item: any) => item.index?.error)
        .map((item: any) => item.index?.error);
      
      return NextResponse.json(
        { 
          ok: false, 
          error: 'Some documents failed to index',
          details: erroredDocs.slice(0, 5),
        },
        { status: 500 }
      );
    }
    
    // Validate spike detection with ES|QL
    const esqlQuery = `
      FROM logs-app
      | WHERE @timestamp >= NOW() - 5 minutes
      | WHERE level == "ERROR"
      | STATS errors = COUNT(*) BY service, env
      | WHERE errors >= 40
      | SORT errors DESC
    `;
    
    const queryResponse = await esClient.transport.request({
      method: 'POST',
      path: '/_query',
      body: { query: esqlQuery },
    }) as { values?: any[] };
    
    const spikes = queryResponse.values || [];
    const spikeCheck = {
      detectable: spikes.length > 0,
      spikes: spikes.map(([errors, svc, environment]: any) => ({
        service: svc,
        env: environment,
        errors,
      })),
    };
    
    return NextResponse.json({
      ok: true,
      inserted: errorCount,
      spikeCheck,
      message: spikeCheck.detectable 
        ? `Spike inserted and validated! ${spikeCheck.spikes[0].errors} errors detected.`
        : 'Spike inserted but not yet detectable (may need a moment to index).',
    });
    
  } catch (error: any) {
    console.error('Error in demo spike route:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to simulate spike', details: error.message },
      { status: 500 }
    );
  }
}
