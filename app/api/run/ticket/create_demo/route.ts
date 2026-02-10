import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';
import { generateEmbedding } from '@/lib/embed';
import { buildHybridSearch, buildTicketDedupeSearch } from '@/lib/searchTemplates';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}`;
  
  try {
    const body = await request.json();
    const { subject, description } = body;
    
    if (!subject || !description) {
      return NextResponse.json(
        { error: 'Subject and description are required' },
        { status: 400 }
      );
    }
    
    // Step 1: Generate embedding
    const textForEmbedding = `${subject} ${description}`;
    const embedding = generateEmbedding(textForEmbedding);
    
    // Step 2: Search KB articles (hybrid: BM25 + kNN)
    const kbQuery = buildHybridSearch(textForEmbedding, embedding);
    const kbResponse = await esClient.search({
      index: 'kb-articles',
      ...kbQuery,
      size: 2,
    });
    
    // Step 3: Search for duplicate tickets (kNN)
    const ticketQuery = buildTicketDedupeSearch(embedding);
    const ticketResponse = await esClient.search({
      index: 'tickets',
      ...ticketQuery,
      size: 2,
    });
    
    // Step 4: Collect citations
    const citations: any[] = [];
    
    kbResponse.hits.hits.forEach((hit: any) => {
      citations.push({
        index: 'kb-articles',
        id: hit._id,
        highlight: hit._source?.title || '',
      });
    });
    
    ticketResponse.hits.hits.forEach((hit: any) => {
      citations.push({
        index: 'tickets',
        id: hit._id,
        highlight: hit._source?.subject || '',
      });
    });
    
    // Step 5: Check if we have enough citations
    if (citations.length < 2) {
      return NextResponse.json({
        ok: false,
        run_id: runId,
        timeline_url: `/timeline/${runId}`,
        summary: 'Insufficient evidence to create ticket',
        recommended_action: 'Manual review required - less than 2 citations found',
        citations,
        confidence: 'low',
        debug: { took_ms: Date.now() - startTime },
      });
    }
    
    // Step 6: Create the ticket via tool endpoint
    const ticketId = `TKT-${Date.now()}`;
    
    const createResponse = await esClient.index({
      index: 'tickets',
      id: ticketId,  // Use ticket_id as the document ID
      body: {
        ticket_id: ticketId,
        subject,
        description,
        category: 'general',
        severity: 'medium',
        priority: 'p3',
        status: 'open',
        channel: 'copilot-ui',
        customer_id: 'DEMO',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: ['copilot-created', 'evidence-gated'],
        embedding,
      },
      refresh: true,
    });
    
    // Step 7: Write metrics
    await esClient.index({
      index: 'ops-metrics',
      body: {
        metric_type: 'operations',
        metric_name: 'ticket_created_via_copilot',
        value: 1,
        unit: 'count',
        category: 'general',
        ref_id: createResponse._id,
        ref_type: 'ticket',
        timestamp: new Date().toISOString(),
        tags: ['copilot', 'evidence-gated'],
      },
    });
    
    // Step 8: Record ops-run timeline
    await esClient.index({
      index: 'ops-runs',
      body: {
        run_id: runId,
        workflow: 'copilot_create_ticket',
        ref_id: createResponse._id,
        ref_type: 'ticket',
        status: 'completed',
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        steps: {
          embed: { completed: true },
          search_kb: { hits: kbResponse.hits.hits.length },
          search_tickets: { hits: ticketResponse.hits.hits.length },
          collect_citations: { count: citations.length },
          create_ticket: { id: createResponse._id, ticket_id: ticketId },
        },
      },
    });
    
    // Return CopilotRunResponse format
    return NextResponse.json({
      ok: true,
      run_id: runId,
      timeline_url: `/timeline/${runId}`,
      summary: `Created ticket ${ticketId} with ${citations.length} citations from Elasticsearch`,
      recommended_action: 'Ticket created successfully with sufficient evidence',
      entities: {
        ticket_id: ticketId,
      },
      outputs: {
        category: 'general',
        severity: 'medium',
        priority: 'p3',
      },
      citations,
      confidence: citations.length >= 2 ? 'high' : 'low',
      metrics: {
        citations_count: citations.length,
        kb_results: kbResponse.hits.hits.length,
        ticket_results: ticketResponse.hits.hits.length,
      },
      debug: {
        took_ms: Date.now() - startTime,
      },
    });
    
  } catch (error: any) {
    console.error('Error in create_demo workflow:', error);
    return NextResponse.json(
      { 
        ok: false,
        error: 'Failed to create ticket',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
