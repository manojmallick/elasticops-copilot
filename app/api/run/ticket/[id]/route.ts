import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';
import { generateEmbedding } from '@/lib/embed';
import { buildTicketDedupeSearch, buildHybridSearch, buildResolutionSearch } from '@/lib/searchTemplates';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const runId = `run_${Date.now()}`;
  const startedAt = new Date();
  const steps: any = {};
  
  try {
    // Fetch the ticket
    const ticketResponse = await esClient.get({
      index: 'tickets',
      id,
    });
    
    const ticket = ticketResponse._source as any;
    
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }
    
    // Step 1: Embed
    steps.embed = {
      started_at: new Date().toISOString(),
    };
    
    const textForEmbedding = `${ticket.subject || ''} ${ticket.description || ''}`.trim();
    const embedding = generateEmbedding(textForEmbedding);
    
    steps.embed.completed_at = new Date().toISOString();
    steps.embed.dims = embedding.length;
    
    // Step 2: Classify
    steps.classify = {
      started_at: new Date().toISOString(),
    };
    
    const classification = classifyTicket(ticket);
    
    steps.classify.completed_at = new Date().toISOString();
    steps.classify.category = classification.category;
    steps.classify.severity = classification.severity;
    steps.classify.priority = classification.priority;
    
    // Step 3: Dedupe - find similar tickets
    steps.dedupe = {
      started_at: new Date().toISOString(),
    };
    
    const dedupeQuery = buildTicketDedupeSearch(
      embedding,
      classification.category,
      id,
      5
    );
    
    const dedupeResponse = await esClient.search({
      index: 'tickets',
      ...dedupeQuery,
    });
    
    const similarTickets = dedupeResponse.hits.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      subject: hit._source?.subject,
      status: hit._source?.status,
    }));
    
    // Check for duplicates (score > 0.95 indicates very similar)
    const isDuplicate = similarTickets.some(t => t.score && t.score > 0.95);
    
    steps.dedupe.completed_at = new Date().toISOString();
    steps.dedupe.isDuplicate = isDuplicate;
    steps.dedupe.similarTickets = similarTickets;
    
    // Step 4: Retrieve KB articles
    steps.retrieve_kb = {
      started_at: new Date().toISOString(),
    };
    
    const kbQuery = buildHybridSearch(
      textForEmbedding,
      embedding,
      ['title', 'content'],
      'embedding',
      5
    );
    
    const kbResponse = await esClient.search({
      index: 'kb-articles',
      ...kbQuery,
    });
    
    const kbArticles = kbResponse.hits.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      title: hit._source?.title,
      highlight: hit.highlight?.content?.[0] || hit.highlight?.title?.[0] || '',
    }));
    
    steps.retrieve_kb.completed_at = new Date().toISOString();
    steps.retrieve_kb.articles_found = kbArticles.length;
    steps.retrieve_kb.top_articles = kbArticles;
    
    // Step 5: Retrieve resolutions
    steps.retrieve_resolutions = {
      started_at: new Date().toISOString(),
    };
    
    const resolutionQuery = buildResolutionSearch(
      embedding,
      classification.category,
      classification.severity,
      5
    );
    
    const resolutionResponse = await esClient.search({
      index: 'resolutions',
      ...resolutionQuery,
    });
    
    const resolutions = resolutionResponse.hits.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      title: hit._source?.title,
      summary: hit._source?.summary,
    }));
    
    steps.retrieve_resolutions.completed_at = new Date().toISOString();
    steps.retrieve_resolutions.resolutions_found = resolutions.length;
    steps.retrieve_resolutions.top_resolutions = resolutions;
    
    // Step 6: Draft response
    steps.draft = {
      started_at: new Date().toISOString(),
    };
    
    // Collect citations
    const citations: string[] = [];
    kbArticles.slice(0, 2).forEach(article => {
      citations.push(`kb-articles:${article.id}`);
    });
    resolutions.slice(0, 2).forEach(resolution => {
      citations.push(`resolutions:${resolution.id}`);
    });
    if (isDuplicate && similarTickets.length > 0) {
      citations.push(`tickets:${similarTickets[0].id}`);
    }
    
    const confidence = citations.length >= 2 ? 'high' : 'low';
    
    let customerMessage = '';
    let internalNotes = '';
    
    // Deterministic drafting based on classifications and citations
    if (isDuplicate) {
      customerMessage = `Thank you for reaching out. We've identified that this issue is similar to a previously reported case. Our team is actively working on a resolution.`;
      internalNotes = `DUPLICATE: Similar to ticket ${similarTickets[0].id}. Consider merging or linking.`;
    } else if (confidence === 'high') {
      customerMessage = `Thank you for contacting support regarding "${ticket.subject}". Based on our knowledge base and previous resolutions, we've identified potential solutions to your issue.\n\n`;
      
      if (kbArticles.length > 0) {
        customerMessage += `Recommended articles:\n`;
        kbArticles.slice(0, 2).forEach((article, idx) => {
          customerMessage += `${idx + 1}. ${article.title}\n`;
        });
      }
      
      if (resolutions.length > 0) {
        customerMessage += `\nRecommended resolution: ${resolutions[0].title}\n`;
      }
      
      customerMessage += `\nPlease try these steps and let us know if you need further assistance.`;
      
      internalNotes = `AUTO-TRIAGE: Category=${classification.category}, Severity=${classification.severity}. Found ${citations.length} relevant sources. Confidence=${confidence}.`;
    } else {
      customerMessage = `Thank you for reaching out. We've received your request and our support team will review it shortly.`;
      internalNotes = `NEEDS_HUMAN: Insufficient automated context (${citations.length} sources). Manual review required.`;
    }
    
    steps.draft.completed_at = new Date().toISOString();
    steps.draft.customerMessage = customerMessage;
    steps.draft.internalNotes = internalNotes;
    steps.draft.citations = citations;
    steps.draft.confidence = confidence;
    
    // Step 7: Act - update ticket
    steps.act = {
      started_at: new Date().toISOString(),
    };
    
    // Citation gate: require 2+ citations AND high confidence
    const shouldUpdate = confidence === 'high' && citations.length >= 2 && !isDuplicate;
    
    if (shouldUpdate) {
      const updateDoc: any = {
        category: classification.category,
        severity: classification.severity,
        priority: classification.priority,
        customer_message: customerMessage,
        internal_notes: internalNotes,
        updated_at: new Date().toISOString(),
        embedding,
      };
      
      await esClient.update({
        index: 'tickets',
        id,
        body: {
          doc: updateDoc,
        },
        refresh: true,
      });
      
      steps.act.completed_at = new Date().toISOString();
      steps.act.updatedTicket = id;
      steps.act.action = 'updated';
    } else if (isDuplicate) {
      // For duplicates, just tag them
      await esClient.update({
        index: 'tickets',
        id,
        body: {
          doc: {
            internal_notes: internalNotes,
            tags: [...(ticket.tags || []), 'potential_duplicate'],
            updated_at: new Date().toISOString(),
          },
        },
        refresh: true,
      });
      
      steps.act.completed_at = new Date().toISOString();
      steps.act.updatedTicket = id;
      steps.act.action = 'tagged_duplicate';
    } else {
      // Low confidence or insufficient citations - flag for human review
      await esClient.update({
        index: 'tickets',
        id,
        body: {
          doc: {
            internal_notes: internalNotes,
            tags: [...(ticket.tags || []), 'needs_human_review'],
            updated_at: new Date().toISOString(),
          },
        },
        refresh: true,
      });
      
      steps.act.completed_at = new Date().toISOString();
      steps.act.action = 'flagged_for_review';
      steps.act.reason = `Low confidence (${confidence}) or insufficient citations (${citations.length})`;
    }
    
    // Step 8: Write metrics
    if (isDuplicate) {
      await writeMetric({
        metric_name: 'duplicates_prevented',
        value: 1,
        category: classification.category,
        ref_id: id,
        ref_type: 'ticket',
      });
      
      await writeMetric({
        metric_name: 'time_saved_minutes',
        value: 15,
        category: classification.category,
        ref_id: id,
        ref_type: 'ticket',
      });
    }
    
    if (shouldUpdate) {
      await writeMetric({
        metric_name: 'tickets_auto_triaged',
        value: 1,
        category: classification.category,
        ref_id: id,
        ref_type: 'ticket',
      });
    }
    
    // Record ops-run timeline
    await recordOpsRun({
      run_id: runId,
      workflow: 'ticket_triage',
      ref_id: id,
      ref_type: 'ticket',
      status: 'completed',
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      steps,
    });
    
    return NextResponse.json({
      success: true,
      ticket_id: id,
      run_id: runId,
      classification,
      isDuplicate,
      confidence: finalConfidence,
      citations,
      updated: shouldUpdate,
      usedLLM: usedLLM && !!llmDraft,
    });
    
  } catch (error: any) {
    console.error('Error in ticket triage workflow:', error);
    
    // Record failed run
    await recordOpsRun({
      run_id: runId,
      workflow: 'ticket_triage',
      ref_id: id,
      ref_type: 'ticket',
      status: 'failed',
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      steps,
      error: error.message,
    });
    
    return NextResponse.json(
      { error: 'Ticket triage workflow failed', details: error.message, run_id: runId },
      { status: 500 }
    );
  }
}

// Simple rule-based classification
function classifyTicket(ticket: any) {
  const text = `${ticket.subject || ''} ${ticket.description || ''}`.toLowerCase();
  
  let category = ticket.category || 'general';
  let severity = ticket.severity || 'medium';
  let priority = ticket.priority || 'p3';
  
  // Category classification
  if (text.includes('login') || text.includes('password') || text.includes('auth')) {
    category = 'authentication';
  } else if (text.includes('payment') || text.includes('billing') || text.includes('invoice')) {
    category = 'billing';
  } else if (text.includes('slow') || text.includes('timeout') || text.includes('performance')) {
    category = 'performance';
  } else if (text.includes('api') || text.includes('integration') || text.includes('webhook')) {
    category = 'integration';
  } else if (text.includes('data') || text.includes('sync') || text.includes('missing')) {
    category = 'data';
  } else if (text.includes('incident') || text.includes('outage') || text.includes('down')) {
    category = 'incident';
  }
  
  // Severity classification
  if (text.includes('urgent') || text.includes('critical') || text.includes('down') || text.includes('outage')) {
    severity = 'critical';
    priority = 'p1';
  } else if (text.includes('high') || text.includes('important') || text.includes('asap')) {
    severity = 'high';
    priority = 'p2';
  } else if (text.includes('low') || text.includes('minor') || text.includes('question')) {
    severity = 'low';
    priority = 'p4';
  } else {
    severity = 'medium';
    priority = 'p3';
  }
  
  return { category, severity, priority };
}

// Helper to write metrics
async function writeMetric(metric: {
  metric_name: string;
  value: number;
  category: string;
  ref_id: string;
  ref_type: string;
}) {
  try {
    await esClient.index({
      index: 'ops-metrics',
      body: {
        metric_type: 'efficiency',
        metric_name: metric.metric_name,
        value: metric.value,
        unit: metric.metric_name.includes('minutes') ? 'minutes' : 'count',
        category: metric.category,
        ref_id: metric.ref_id,
        ref_type: metric.ref_type,
        timestamp: new Date().toISOString(),
        tags: ['automated', 'triage'],
      },
    });
  } catch (error) {
    console.error('Error writing metric:', error);
  }
}

// Helper to record ops-run timeline
async function recordOpsRun(run: any) {
  try {
    await esClient.index({
      index: 'ops-runs',
      body: run,
      refresh: true,
    });
  } catch (error) {
    console.error('Error recording ops-run:', error);
  }
}
