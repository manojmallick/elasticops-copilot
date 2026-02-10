'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function TimelinePage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTimeline();
    }
  }, [id]);

  async function loadTimeline() {
    setLoading(true);
    try {
      const response = await fetch(`/api/timeline/${id}`);
      if (!response.ok) {
        setTimeline(null);
        return;
      }
      const data = await response.json();
      // Check if data has error field
      if (data.error) {
        setTimeline(null);
      } else {
        setTimeline(data);
      }
    } catch (error) {
      console.error('Error loading timeline:', error);
      setTimeline(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading timeline...</div>;
  }

  if (!timeline) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Timeline</h1>
        </div>
        <div className="card">
          <p style={{ color: '#666', marginBottom: '1rem' }}>No timeline found for this ID. Run a workflow first.</p>
          <a href="/" className="btn">
            ← Back to Home
          </a>
        </div>
      </div>
    );
  }

  const steps = timeline.steps || {};
  const stepNames = Object.keys(steps);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Workflow Timeline</h1>
        <p className="page-subtitle">
          {timeline.workflow} • Run ID: {timeline.run_id}
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span className={`badge badge-${timeline.status}`}>{timeline.status}</span>
          <span className="badge">{timeline.workflow}</span>
          <span className="badge">{timeline.duration_ms}ms</span>
        </div>

        <div className="details-grid">
          <div className="detail-item">
            <div className="detail-label">Workflow</div>
            <div className="detail-value">{timeline.workflow}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Reference ID</div>
            <div className="detail-value">{timeline.ref_id || 'N/A'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Started At</div>
            <div className="detail-value">
              {new Date(timeline.started_at).toLocaleString()}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Duration</div>
            <div className="detail-value">{timeline.duration_ms}ms</div>
          </div>
        </div>

        {timeline.error && (
          <div className="error" style={{ marginTop: '1rem' }}>
            <strong>Error:</strong> {timeline.error}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 className="section-title">Execution Steps</h2>
        
        <div className="timeline">
          {stepNames.map((stepName) => {
            const step = steps[stepName];
            return (
              <div key={stepName} className="timeline-step">
                <h3 className="timeline-step-title">
                  {formatStepName(stepName)}
                </h3>
                <div className="timeline-step-content">
                  {renderStepContent(stepName, step)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {timeline.ref_type && timeline.ref_id ? (
        <div style={{ marginTop: '2rem' }}>
          <a href={`/${timeline.ref_type}/${timeline.ref_id}`} className="btn btn-secondary">
            ← Back to {timeline.ref_type}
          </a>
        </div>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          <a href="/" className="btn btn-secondary">
            ← Back to Home
          </a>
        </div>
      )}
    </div>
  );
}

function formatStepName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function renderStepContent(stepName: string, step: any): JSX.Element {
  if (!step) return <></>;

  const exclude = ['started_at', 'completed_at'];
  const keys = Object.keys(step).filter(k => !exclude.includes(k));

  return (
    <div>
      {step.started_at && (
        <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
          {new Date(step.started_at).toLocaleTimeString()} - {step.completed_at ? new Date(step.completed_at).toLocaleTimeString() : 'In progress'}
        </p>
      )}
      
      {keys.map((key) => {
        const value = step[key];
        
        // Special rendering for specific fields
        if (key === 'citations' && Array.isArray(value)) {
          return (
            <div key={key} style={{ marginTop: '0.5rem' }}>
              <strong>Citations:</strong>
              <div style={{ marginTop: '0.25rem' }}>
                {value.map((citation: string, idx: number) => (
                  <span key={idx} className="citation">{citation}</span>
                ))}
              </div>
            </div>
          );
        }
        
        if (key === 'similarTickets' || key === 'top_articles' || key === 'top_resolutions') {
          if (!Array.isArray(value) || value.length === 0) return null;
          return (
            <div key={key} style={{ marginTop: '0.5rem' }}>
              <strong>{formatStepName(key)}:</strong>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                {value.slice(0, 3).map((item: any, idx: number) => (
                  <li key={idx}>
                    {item.title || item.subject || item.id} 
                    {item.score && <span style={{ color: '#999' }}> (score: {item.score.toFixed(3)})</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        
        if (key === 'customerMessage' || key === 'internalNotes') {
          return (
            <div key={key} style={{ marginTop: '0.5rem' }}>
              <strong>{formatStepName(key)}:</strong>
              <p style={{ 
                marginTop: '0.25rem', 
                padding: '0.5rem', 
                background: '#f9f9f9', 
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
                fontSize: '0.875rem'
              }}>
                {value}
              </p>
            </div>
          );
        }
        
        // Default rendering
        if (typeof value === 'object') {
          return (
            <div key={key} style={{ marginTop: '0.5rem' }}>
              <strong>{formatStepName(key)}:</strong>
              <pre style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          );
        }
        
        return (
          <div key={key} style={{ marginTop: '0.25rem' }}>
            <strong>{formatStepName(key)}:</strong> {String(value)}
          </div>
        );
      })}
    </div>
  );
}
