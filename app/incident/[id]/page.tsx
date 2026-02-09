'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function IncidentDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadIncident();
    }
  }, [id]);

  async function loadIncident() {
    setLoading(true);
    try {
      const response = await fetch(`/api/incidents/${id}`);
      const data = await response.json();
      setIncident(data);
    } catch (error) {
      console.error('Error loading incident:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading incident...</div>;
  }

  if (!incident) {
    return <div className="error">Incident not found</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{incident.title}</h1>
        <p className="page-subtitle">{incident.incident_id}</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span className={`badge badge-${incident.status}`}>{incident.status}</span>
          <span className={`badge badge-${incident.severity}`}>{incident.severity}</span>
          <span className="badge">{incident.service}</span>
          <span className="badge">{incident.env}</span>
        </div>

        <div className="details-grid">
          <div className="detail-item">
            <div className="detail-label">Service</div>
            <div className="detail-value">{incident.service}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Environment</div>
            <div className="detail-value">{incident.env}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Error Count</div>
            <div className="detail-value">{incident.error_count || 'N/A'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Detected At</div>
            <div className="detail-value">
              {new Date(incident.detected_at).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Summary</h3>
          <p>{incident.summary}</p>
        </div>

        {incident.tags && incident.tags.length > 0 && (
          <div className="section">
            <h3 className="section-title">Tags</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {incident.tags.map((tag: string) => (
                <span key={tag} className="badge">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <h3 className="section-title">Actions</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <a href={`/timeline/${id}`} className="btn">
              📊 View Timeline
            </a>
            <a href="/inbox" className="btn btn-secondary">
              ← Back to Inbox
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
