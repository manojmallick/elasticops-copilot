import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';
import { generateEmbedding } from '@/lib/embed';

export async function POST(request: NextRequest) {
  // Verify webhook secret for Agent Builder security
  const webhookSecret = process.env.ELASTICOPS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret = request.headers.get('x-elasticops-secret');
    if (providedSecret !== webhookSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid webhook secret' },
        { status: 401 }
      );
    }
  }
  
  try {
    const body = await request.json();
    const {
      id,
      ticket_id,
      subject,
      description,
      category,
      severity,
      priority,
      status,
      channel,
      customer_id,
      assigned_to,
      customer_message,
      internal_notes,
      incident_ref,
      tags,
      citations,
    } = body;
    
    // Enforce citation requirement (backup safety gate)
    if (!citations || citations.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 citations required before auto-updating tickets' },
        { status: 400 }
      );
    }
    
    const now = new Date().toISOString();
    
    // Generate embedding from subject + description
    const textForEmbedding = `${subject || ''} ${description || ''}`.trim();
    const embedding = textForEmbedding ? generateEmbedding(textForEmbedding) : undefined;
    
    let result;
    
    if (id) {
      // Update existing ticket
      const updateDoc: any = {
        updated_at: now,
      };
      
      if (subject !== undefined) updateDoc.subject = subject;
      if (description !== undefined) updateDoc.description = description;
      if (category !== undefined) updateDoc.category = category;
      if (severity !== undefined) updateDoc.severity = severity;
      if (priority !== undefined) updateDoc.priority = priority;
      if (status !== undefined) updateDoc.status = status;
      if (channel !== undefined) updateDoc.channel = channel;
      if (customer_id !== undefined) updateDoc.customer_id = customer_id;
      if (assigned_to !== undefined) updateDoc.assigned_to = assigned_to;
      if (customer_message !== undefined) updateDoc.customer_message = customer_message;
      if (internal_notes !== undefined) updateDoc.internal_notes = internal_notes;
      if (incident_ref !== undefined) updateDoc.incident_ref = incident_ref;
      if (tags !== undefined) updateDoc.tags = tags;
      if (embedding !== undefined) updateDoc.embedding = embedding;
      
      if (status === 'resolved' || status === 'closed') {
        updateDoc.resolved_at = now;
      }
      
      result = await esClient.update({
        index: 'tickets',
        id,
        body: {
          doc: updateDoc,
        },
        refresh: true,
      });
      
      // Write metric for ticket update
      await writeMetric({
        metric_name: 'ticket_updated',
        value: 1,
        category: category || 'unknown',
        ref_id: id,
        ref_type: 'ticket',
      });
      
      return NextResponse.json({
        success: true,
        action: 'updated',
        id: result._id,
      });
      
    } else {
      // Create new ticket
      const newTicket: any = {
        ticket_id: ticket_id || `TKT-${Date.now()}`,
        subject: subject || 'Untitled Ticket',
        description: description || '',
        category: category || 'general',
        severity: severity || 'medium',
        priority: priority || 'p3',
        status: status || 'open',
        channel: channel || 'system',
        customer_id: customer_id || 'SYSTEM',
        assigned_to: assigned_to || null,
        created_at: now,
        updated_at: now,
        tags: tags || [],
      };
      
      if (customer_message) newTicket.customer_message = customer_message;
      if (internal_notes) newTicket.internal_notes = internal_notes;
      if (incident_ref) newTicket.incident_ref = incident_ref;
      if (embedding) newTicket.embedding = embedding;
      
      result = await esClient.index({
        index: 'tickets',
        body: newTicket,
        refresh: true,
      });
      
      // Write metric for ticket creation
      await writeMetric({
        metric_name: 'ticket_created',
        value: 1,
        category: category || 'unknown',
        ref_id: result._id,
        ref_type: 'ticket',
      });
      
      return NextResponse.json({
        success: true,
        action: 'created',
        id: result._id,
        ticket_id: newTicket.ticket_id,
      });
    }
    
  } catch (error: any) {
    console.error('Error creating/updating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create/update ticket', details: error.message },
      { status: 500 }
    );
  }
}

// Helper to write metrics
async function writeMetric(metric: {
  metric_name: string;
  value: number;
  category?: string;
  ref_id?: string;
  ref_type?: string;
}) {
  try {
    await esClient.index({
      index: 'ops-metrics',
      body: {
        metric_type: 'operations',
        metric_name: metric.metric_name,
        value: metric.value,
        unit: 'count',
        category: metric.category || 'general',
        ref_id: metric.ref_id || null,
        ref_type: metric.ref_type || null,
        timestamp: new Date().toISOString(),
        tags: ['automated'],
      },
    });
  } catch (error) {
    console.error('Error writing metric:', error);
  }
}
