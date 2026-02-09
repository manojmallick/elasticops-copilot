'use client';

import { useState } from 'react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'kb' | 'tickets'>('kb');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setSearching(true);
    setSearched(true);
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, mode, k: 10 }),
      });
      
      const data = await response.json();
      setResults(data.hits || []);
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function toggleExplanation(id: string) {
    const newExpanded = new Set(expandedExplanations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedExplanations(newExpanded);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Search Explorer</h1>
        <p className="page-subtitle">Hybrid search with BM25 + vector similarity</p>
      </div>

      <div className="card">
        <form onSubmit={handleSearch}>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Enter your search query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            
            <div className="search-controls">
              <div className="toggle">
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="kb"
                    checked={mode === 'kb'}
                    onChange={() => setMode('kb')}
                  />
                  KB Articles
                </label>
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="tickets"
                    checked={mode === 'tickets'}
                    onChange={() => setMode('tickets')}
                  />
                  Tickets
                </label>
              </div>
              
              <button type="submit" className="btn" disabled={searching || !query.trim()}>
                {searching ? 'Searching...' : '🔍 Search'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {searched && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            Results ({results.length})
          </h2>
          
          {results.length === 0 ? (
            <div className="empty">No results found</div>
          ) : (
            results.map((hit) => (
              <div key={hit.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 className="card-title">
                      {hit.source?.title || hit.source?.subject || 'Untitled'}
                    </h3>
                    <p style={{ color: '#666', fontSize: '0.875rem' }}>
                      Score: {hit.score?.toFixed(4)} • ID: {hit.id}
                    </p>
                  </div>
                  {hit.source?.category && (
                    <span className="badge">{hit.source.category}</span>
                  )}
                </div>

                {/* Highlights */}
                {hit.highlight && Object.keys(hit.highlight).length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ fontSize: '0.875rem', color: '#666' }}>Highlights:</strong>
                    {Object.entries(hit.highlight).map(([field, snippets]: [string, any]) => (
                      <div key={field} style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>
                          {field}
                        </div>
                        {Array.isArray(snippets) && snippets.map((snippet: string, idx: number) => (
                          <p 
                            key={idx} 
                            style={{ 
                              fontSize: '0.9rem', 
                              marginTop: '0.25rem',
                              padding: '0.5rem',
                              background: '#f9f9f9',
                              borderRadius: '4px'
                            }}
                            dangerouslySetInnerHTML={{ __html: snippet }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Explanation (collapsible) */}
                {hit.explanation && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #e0e0e0', paddingTop: '1rem' }}>
                    <button
                      onClick={() => toggleExplanation(hit.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1a73e8',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        padding: 0,
                      }}
                    >
                      {expandedExplanations.has(hit.id) ? '▼' : '▶'} Why ranked here?
                    </button>
                    
                    {expandedExplanations.has(hit.id) && (
                      <pre style={{ 
                        marginTop: '0.5rem', 
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        background: '#f5f5f5',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        maxHeight: '300px',
                        overflow: 'auto'
                      }}>
                        {hit.explanation}
                      </pre>
                    )}
                  </div>
                )}

                {/* View link */}
                <div style={{ marginTop: '1rem' }}>
                  {mode === 'kb' ? (
                    <span style={{ fontSize: '0.875rem', color: '#666' }}>KB Article</span>
                  ) : (
                    <a 
                      href={`/ticket/${hit.id}`} 
                      className="btn" 
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      View Ticket
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
