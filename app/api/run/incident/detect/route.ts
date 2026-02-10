import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';
import { generateEmbedding } from '@/lib/embed';
import { detectLogSpikes } from '@/lib/esql';
import { buildResolutionSearch } from '@/lib/searchTemplates';

export async function POST(request: NextRequest) {
  const runId = `run_${Date.now()}`;
  const startedAt = new Date();
  const steps: any = {};
  
  try {
    // Step 1: Detect spike using ES|QL
    steps.detect_spike = {
      started_at: new Date().toISOString(),
    };
    
    const spikeResponse = await detectLogSpikes() as any;
    const spikes = spikeResponse.values || [];
    
    steps.detect_spike.completed_at = new Date().toISOString();
    steps.detect_spike.spikes_found = spikes.length;
    
    if (spikes.length === 0) {
      // No spikes detected
      await recordOpsRun({
        run_id: runId,
        workflow: 'incident_detection',
        ref_id: null,
        ref_type: 'incident',
        status: 'completed',
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt.getTime(),
        steps,
      });
      
      return NextResponse.json({
        found: false,
        message: 'No error spikes detected in the last 5 minutes',
        run_id: runId,
      });
    }
    
    // Process the first spike (columns: errors, service, env)
    const [errorCount, service, env] = spikes[0];
    
    // Step 2: Create incident
    steps.create_incident = {
      started_at: new Date().toISOString(),
      service,
      env,
      error_count: errorCount,
    };
    
    const incidentSummary = `High error rate detected: ${errorCount} errors in ${service} (${env})`;
    const incidentTitle = `Error spike in ${service}`;
    const incidentEmbedding = generateEmbedding(incidentTitle + ' ' + incidentSummary);
    
    const incident = {
      incident_id: `INC-${Date.now()}`,
      title: incidentTitle,
      summary: incidentSummary,
      service,
      env,
      severity: errorCount >= 500 ? 'critical' : 'high',
      status: 'open',
      detected_at: new Date().toISOString(),
      error_count: errorCount,
      error_rate: null,
      affected_users: null,
      tags: ['auto-detected', service, env],
      embedding: incidentEmbedding,
    };
    
    const incidentResult = await esClient.index({
      index: 'incidents',
      body: incident,
      refresh: true,
    });
    
    const incidentId = incidentResult._id;
    
    steps.create_incident.completed_at = new Date().toISOString();
    steps.create_incident.incident_id = incidentId;
    
    // Step 3: Retrieve relevant resolutions
    steps.retrieve_resolutions = {
      started_at: new Date().toISOString(),
    };
    
    const resolutionSearchQuery = buildResolutionSearch(
      incidentEmbedding,
      'incident',
      incident.severity,
      5
    );
    
    const resolutionResponse = await esClient.search({
      index: 'resolutions',
      ...resolutionSearchQuery,
    });
    
    const resolutions = resolutionResponse.hits.hits.map((hit: any) => ({
      id: hit._id,
      title: hit._source?.title,
      score: hit._score,
    }));
    
    steps.retrieve_resolutions.completed_at = new Date().toISOString();
    steps.retrieve_resolutions.resolutions_found = resolutions.length;
    steps.retrieve_resolutions.top_resolutions = resolutions;
    
    // Step 4: Create ticket
    steps.create_ticket = {
      started_at: new Date().toISOString(),
    };
    
    const ticketSubject = `Incident: ${incidentTitle}`;
    const ticketDescription = `${incidentSummary}\n\nDetected at: ${incident.detected_at}\nService: ${service}\nEnvironment: ${env}\nError count: ${errorCount}`;
    
    const ticket = {
      ticket_id: `TKT-INC-${Date.now()}`,
      subject: ticketSubject,
      description: ticketDescription,
      category: 'incident',
      severity: incident.severity,
      priority: incident.severity === 'critical' ? 'p1' : 'p2',
      status: 'open',
      channel: 'system',
      customer_id: 'SYSTEM',
      assigned_to: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ['incident', 'auto-created', service],
      incident_ref: incidentId,
      embedding: generateEmbedding(ticketSubject + ' ' + ticketDescription),
    };
    
    const ticketResult = await esClient.index({
      index: 'tickets',
      body: ticket,
      refresh: true,
    });
    
    const ticketId = ticketResult._id;
    
    steps.create_ticket.completed_at = new Date().toISOString();
    steps.create_ticket.ticket_id = ticketId;
    
    // Step 5: Write metrics
    steps.write_metrics = {
      started_at: new Date().toISOString(),
    };
    
    // MTTA (Mean Time to Acknowledge) - 30 seconds for auto-detection
    await writeMetric({
      metric_name: 'mtta_seconds',
      value: 30,
      category: 'incident',
      ref_id: incidentId,
      ref_type: 'incident',
    });
    
    steps.write_metrics.completed_at = new Date().toISOString();
    steps.write_metrics.metrics_written = ['mtta_seconds'];
    
    // Record ops-run timeline
    await recordOpsRun({
      run_id: runId,
      workflow: 'incident_detection',
      ref_id: incidentId,
      ref_type: 'incident',
      status: 'completed',
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      steps,
    });
    
    return NextResponse.json({
      success: true,
      found: true,
      incident_id: incidentId,
      ticket_id: ticketId,
      run_id: runId,
      summary: {
        service,
        env,
        error_count: errorCount,
        severity: incident.severity,
      },
    });
    
  } catch (error: any) {
    console.error('Error in incident detection workflow:', error);
    
    // Record failed run
    await recordOpsRun({
      run_id: runId,
      workflow: 'incident_detection',
      ref_id: null,
      ref_type: 'incident',
      status: 'failed',
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      steps,
      error: error.message,
    });
    
    return NextResponse.json(
      { error: 'Incident detection workflow failed', details: error.message, run_id: runId },
      { status: 500 }
    );
  }
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
        metric_type: 'performance',
        metric_name: metric.metric_name,
        value: metric.value,
        unit: metric.metric_name.includes('seconds') ? 'seconds' : metric.metric_name.includes('minutes') ? 'minutes' : 'count',
        category: metric.category,
        ref_id: metric.ref_id,
        ref_type: metric.ref_type,
        timestamp: new Date().toISOString(),
        tags: ['automated'],
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
