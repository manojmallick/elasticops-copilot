'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

function MessageWithLinks({ text }: { text: string }) {
  // Convert URLs in text to clickable links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, idx) => {
        if (part.match(urlRegex)) {
          return (
            <a 
              key={idx}
              href={part}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#1a73e8', textDecoration: 'underline' }}
            >
              {part}
            </a>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}

function FormattedInternalNotes({ text }: { text: string }) {
  // Parse internal notes format: "AUTO-TRIAGE: Category=billing, Severity=critical. Found 4 relevant sources. Confidence=high."
  const parts = text.split('. ');
  
  return (
    <div style={{ color: '#666', fontStyle: 'italic', lineHeight: '1.8' }}>
      {parts.map((part, idx) => {
        // Check if this part contains key=value pairs
        if (part.includes('=')) {
          const items = part.split(/,\s*/);
          return (
            <div key={idx} style={{ marginBottom: '0.5rem' }}>
              {items.map((item, i) => {
                const [key, value] = item.split('=');
                if (key && value) {
                  return (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, minWidth: '120px' }}>{key.trim()}:</span>
                      <span>{value.trim()}</span>
                    </div>
                  );
                }
                return <div key={i}>{item}</div>;
              })}
            </div>
          );
        }
        return (
          <div key={idx} style={{ marginBottom: '0.5rem' }}>
            {part.trim()}{idx < parts.length - 1 ? '.' : ''}
          </div>
        );
      })}
    </div>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState(false);
  const [message, setMessage] = useState('');
  const [confidenceBreakdown, setConfidenceBreakdown] = useState<any>(null);

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
    setConfidenceBreakdown(null);
    try {
      const response = await fetch(`/api/run/ticket/${id}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.ok) {
        setMessage(`✅ ${data.summary} • Confidence: ${data.confidence} • Citations: ${data.citations?.length || 0}`);
        if (data.outputs?.confidence_breakdown) {
          setConfidenceBreakdown(data.outputs.confidence_breakdown);
        }
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
            <MessageWithLinks text={ticket.customer_message} />
          </div>
        )}

        {ticket.internal_notes && (
          <div className="section">
            <h3 className="section-title">Internal Notes</h3>
            <FormattedInternalNotes text={ticket.internal_notes} />
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
              
              {confidenceBreakdown && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Confidence Breakdown
                  </div>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: '#666' }}>📚 KB Articles</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          width: '100px', 
                          height: '8px', 
                          background: '#e0e0e0', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${confidenceBreakdown.kb_score * 100}%`, 
                            height: '100%', 
                            background: '#1a73e8'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                          {(confidenceBreakdown.kb_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: '#666' }}>🔧 Resolutions</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          width: '100px', 
                          height: '8px', 
                          background: '#e0e0e0', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${confidenceBreakdown.resolution_score * 100}%`, 
                            height: '100%', 
                            background: '#34a853'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                          {(confidenceBreakdown.resolution_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: '#666' }}>🎫 Similar Tickets</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          width: '100px', 
                          height: '8px', 
                          background: '#e0e0e0', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${confidenceBreakdown.similar_tickets_score * 100}%`, 
                            height: '100%', 
                            background: '#fbbc04'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                          {(confidenceBreakdown.similar_tickets_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ 
                      marginTop: '0.5rem', 
                      paddingTop: '0.5rem', 
                      borderTop: '1px solid #ddd',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Overall</span>
                      <span style={{ 
                        fontSize: '1rem', 
                        fontWeight: 700,
                        color: confidenceBreakdown.overall >= 0.7 ? '#34a853' : confidenceBreakdown.overall >= 0.4 ? '#fbbc04' : '#ea4335'
                      }}>
                        {(confidenceBreakdown.overall * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
