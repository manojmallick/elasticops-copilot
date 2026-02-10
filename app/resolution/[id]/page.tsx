'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ResolutionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [resolution, setResolution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadResolution();
    }
  }, [id]);

  async function loadResolution() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/resolutions/${id}`);
      const data = await response.json();
      
      if (data.ok) {
        setResolution(data.doc);
      } else {
        setError(data.error === 'not_found' ? 'Resolution not found' : 'Failed to load resolution');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load resolution');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-header">
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    );
  }

  if (error || !resolution) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Resolution</h1>
          <p className="page-subtitle" style={{ color: '#e74c3c' }}>{error || 'Resolution not found'}</p>
        </div>
        <div className="card">
          <p>The requested resolution could not be found.</p>
          <a href="/" className="btn" style={{ marginTop: '1rem', display: 'inline-block' }}>
            ← Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Resolution</h1>
        <p className="page-subtitle">{resolution.id}</p>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1.5rem' }}>
          <button className="btn" onClick={() => window.history.length > 1 ? router.back() : router.push('/')} style={{ marginRight: '0.5rem' }}>
            ← Back
          </button>
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
          {resolution.title || resolution.name || 'Untitled'}
        </h2>

        {resolution.tags && resolution.tags.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {resolution.tags.map((tag: string, idx: number) => (
              <span key={idx} className="badge">{tag}</span>
            ))}
          </div>
        ) : null}

        <div className="details-grid" style={{ marginBottom: '1.5rem' }}>
          {resolution.resolution_id ? (
            <div className="detail-item">
              <div className="detail-label">Resolution ID</div>
              <div className="detail-value">{resolution.resolution_id}</div>
            </div>
          ) : null}
          {resolution.applicability ? (
            <div className="detail-item">
              <div className="detail-label">Applicability</div>
              <div className="detail-value">{resolution.applicability}</div>
            </div>
          ) : null}
          {resolution.created_at ? (
            <div className="detail-item">
              <div className="detail-label">Created</div>
              <div className="detail-value">
                {new Date(resolution.created_at).toLocaleString()}
              </div>
            </div>
          ) : null}
          {resolution.updated_at ? (
            <div className="detail-item">
              <div className="detail-label">Updated</div>
              <div className="detail-value">
                {new Date(resolution.updated_at).toLocaleString()}
              </div>
            </div>
          ) : null}
        </div>

        {resolution.content ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Description</div>
            <div style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {resolution.content}
            </div>
          </div>
        ) : null}

        {resolution.steps && Array.isArray(resolution.steps) ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Steps</div>
            <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
              {resolution.steps.map((step: string, idx: number) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}

        {resolution.commands && Array.isArray(resolution.commands) ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Commands</div>
            <div style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '1rem', 
              borderRadius: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              lineHeight: '1.6'
            }}>
              {resolution.commands.map((cmd: string, idx: number) => (
                <div key={idx} style={{ marginBottom: '0.5rem' }}>{cmd}</div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
