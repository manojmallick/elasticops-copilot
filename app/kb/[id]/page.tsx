'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function KBArticlePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadArticle();
    }
  }, [id]);

  async function loadArticle() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/kb/${id}`);
      const data = await response.json();
      
      if (data.ok) {
        setArticle(data.doc);
      } else {
        setError(data.error === 'not_found' ? 'Article not found' : 'Failed to load article');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load article');
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

  if (error || !article) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Knowledge Base Article</h1>
          <p className="page-subtitle" style={{ color: '#e74c3c' }}>{error || 'Article not found'}</p>
        </div>
        <div className="card">
          <p>The requested knowledge base article could not be found.</p>
          <button className="btn" onClick={() => router.back()} style={{ marginTop: '1rem' }}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Knowledge Base Article</h1>
        <p className="page-subtitle">{article.id}</p>
      </div>

      <div className="card">
        <button className="btn" onClick={() => router.back()} style={{ marginBottom: '1.5rem' }}>
          ← Back
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
          {article.title || 'Untitled'}
        </h2>

        {article.tags && article.tags.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {article.tags.map((tag: string, idx: number) => (
              <span key={idx} className="badge">{tag}</span>
            ))}
          </div>
        ) : null}

        <div className="details-grid" style={{ marginBottom: '1.5rem' }}>
          {article.case_id ? (
            <div className="detail-item">
              <div className="detail-label">Case ID</div>
              <div className="detail-value">{article.case_id}</div>
            </div>
          ) : null}
          {article.created_at ? (
            <div className="detail-item">
              <div className="detail-label">Created</div>
              <div className="detail-value">
                {new Date(article.created_at).toLocaleString()}
              </div>
            </div>
          ) : null}
          {article.updated_at ? (
            <div className="detail-item">
              <div className="detail-label">Updated</div>
              <div className="detail-value">
                {new Date(article.updated_at).toLocaleString()}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Content</div>
          <div style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {article.content || article.excerpt || 'No content available'}
          </div>
        </div>

        {article.solution ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Solution</div>
            <div style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {article.solution}
            </div>
          </div>
        ) : null}

        {article.steps && Array.isArray(article.steps) ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Steps</div>
            <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
              {article.steps.map((step: string, idx: number) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}
