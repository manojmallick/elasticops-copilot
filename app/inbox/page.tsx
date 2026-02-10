'use client';

import { useState, useEffect } from 'react';

export default function InboxPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [incidentsRes, ticketsRes] = await Promise.all([
        fetch('/api/incidents?status=open,investigating&size=10'),
        fetch('/api/tickets?status=open,in_progress&size=20'),
      ]);

      const incidentsData = await incidentsRes.json();
      const ticketsData = await ticketsRes.json();

      setIncidents(incidentsData.incidents || []);
      setTickets(ticketsData.tickets || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function detectSpike() {
    setDetecting(true);
    setMessage('');
    try {
      const response = await fetch('/api/run/incident/detect', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.ok && data.entities?.incident_id) {
        setMessage(`✅ Spike detected! Created incident ${data.entities.incident_id}${data.entities.ticket_id ? ' and ticket ' + data.entities.ticket_id : ''}`);
        // Reload data to show new incident/ticket
        setTimeout(loadData, 1000);
      } else if (data.metrics?.duplicate_prevented) {
        setMessage(`ℹ️ ${data.summary} (${data.debug?.existing_incident_id || 'already open'})`);
        // Still reload to show existing incident
        setTimeout(loadData, 500);
      } else {
        setMessage('ℹ️ ' + (data.summary || data.message || 'No spikes detected'));
      }
    } catch (error: any) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setDetecting(false);
    }
  }

  async function simulateSpike() {
    setSimulating(true);
    setMessage('');
    try {
      const response = await fetch('/api/demo/spike', {
        method: 'POST',
        headers: {
          'x-demo-secret': process.env.NEXT_PUBLIC_DEMO_SECRET || 'demo-secret-2026',
        },
      });

      const data = await response.json();

      if (data.ok) {
        setMessage(`✅ ${data.message} (${data.inserted} error logs inserted)`);
      } else {
        setMessage(`❌ ${data.error || 'Failed to simulate spike'}`);
      }
    } catch (error: any) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading inbox...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inbox</h1>
        <p className="page-subtitle">Active incidents and open tickets</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={simulateSpike}
            disabled={simulating}
          >
            {simulating ? 'Simulating...' : '🔥 Simulate Error Spike'}
          </button>
          <button
            className="btn"
            onClick={detectSpike}
            disabled={detecting}
          >
            {detecting ? 'Detecting...' : '🔍 Detect Error Spike'}
          </button>
        </div>
        {message && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
            {message}
          </div>
        )}
      </div>

      <div className="inbox-grid">
        {/* Incidents Column */}
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
            🚨 Incidents ({incidents.length})
          </h2>
          {incidents.length === 0 ? (
            <div className="empty">No active incidents</div>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{incident.title}</h3>
                    <p style={{ color: '#666', fontSize: '0.9rem' }}>
                      {incident.service} • {incident.env}
                    </p>
                  </div>
                  <div>
                    <span className={`badge badge-${incident.severity}`}>
                      {incident.severity}
                    </span>
                  </div>
                </div>
                <p style={{ marginBottom: '1rem' }}>{incident.summary}</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a href={`/incident/${incident.id}`} className="btn" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                    View Details
                  </a>
                  <a href={`/timeline/${incident.id}`} className="btn btn-secondary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                    Timeline
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tickets Column */}
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
            🎫 Open Tickets ({tickets.length})
          </h2>
          {tickets.length === 0 ? (
            <div className="empty">No open tickets</div>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{ticket.subject}</h3>
                    <p style={{ color: '#666', fontSize: '0.875rem' }}>
                      {ticket.ticket_id} • {ticket.category}
                    </p>
                  </div>
                  <div>
                    <span className={`badge badge-${ticket.status}`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>
                <p style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
                  {ticket.description?.substring(0, 150)}
                  {ticket.description?.length > 150 ? '...' : ''}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a href={`/ticket/${ticket.id}`} className="btn" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                    View Ticket
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
