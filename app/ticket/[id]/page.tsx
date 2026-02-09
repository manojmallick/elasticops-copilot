'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function TicketDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (id) {
      loadTicket();
    }
  }, [id]);

  async function loadTicket() {
    setLoading(true);
    try {
      const response = await fetch(`/api/tickets/${id}`);
      const data = await response.json();
      setTicket(data);
    } catch (error) {
      console.error('Error loading ticket:', error);
    } finally {
      setLoading(false);
    }
  }

  async function runTriage() {
    setTriaging(true);
    setMessage('');
    try {
      const response = await fetch(`/api/run/ticket/${id}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Triage completed! Confidence: ${data.confidence}, Updated: ${data.updated}`);
        // Reload ticket to see updates
        setTimeout(loadTicket, 1000);
      } else {
        setMessage('❌ Triage failed: ' + data.error);
      }
    } catch (error: any) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setTriaging(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading ticket...</div>;
  }

  if (!ticket) {
    return <div className="error">Ticket not found</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{ticket.subject}</h1>
        <p className="page-subtitle">{ticket.ticket_id}</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span className={`badge badge-${ticket.status}`}>{ticket.status}</span>
          <span className={`badge badge-${ticket.severity}`}>{ticket.severity}</span>
          <span className="badge">{ticket.category}</span>
          <span className="badge">{ticket.priority}</span>
        </div>

        <div className="details-grid">
          <div className="detail-item">
            <div className="detail-label">Channel</div>
            <div className="detail-value">{ticket.channel}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Customer ID</div>
            <div className="detail-value">{ticket.customer_id}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Assigned To</div>
            <div className="detail-value">{ticket.assigned_to || 'Unassigned'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Created</div>
            <div className="detail-value">
              {new Date(ticket.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Description</h3>
          <p>{ticket.description}</p>
        </div>

        {ticket.customer_message && (
          <div className="section">
            <h3 className="section-title">Customer Message</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.customer_message}</p>
          </div>
        )}

        {ticket.internal_notes && (
          <div className="section">
            <h3 className="section-title">Internal Notes</h3>
            <p style={{ whiteSpace: 'pre-wrap', color: '#666', fontStyle: 'italic' }}>
              {ticket.internal_notes}
            </p>
          </div>
        )}

        {ticket.incident_ref && (
          <div className="section">
            <h3 className="section-title">Related Incident</h3>
            <a href={`/incident/${ticket.incident_ref}`} className="btn btn-secondary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
              View Incident
            </a>
          </div>
        )}

        <div className="section">
          <h3 className="section-title">Actions</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={runTriage}
              disabled={triaging}
            >
              {triaging ? 'Running Triage...' : '🤖 Run Triage'}
            </button>
            <a href={`/timeline/${id}`} className="btn btn-secondary">
              📊 View Timeline
            </a>
          </div>
          {message && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
