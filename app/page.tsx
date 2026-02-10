export default function HomePage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Welcome to ElasticOps Copilot</h1>
        <p className="page-subtitle">
          Multi-Agent Support Automation + Incident Awareness
        </p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          🚀 Getting Started
        </h2>
        <p style={{ marginBottom: '1rem' }}>
          ElasticOps Copilot is an intelligent support automation platform powered by Elasticsearch.
          It automatically detects incidents, triages tickets, and provides AI-assisted resolutions.
        </p>
        
        <div className="grid" style={{ marginTop: '2rem' }}>
          <a href="/inbox" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📥</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Inbox</h3>
              <p style={{ color: '#666' }}>
                View active incidents and open tickets. Detect error spikes automatically.
              </p>
            </div>
          </a>

          <a href="/search" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔍</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Search</h3>
              <p style={{ color: '#666' }}>
                Hybrid search across KB articles and tickets with BM25 + vector similarity.
              </p>
            </div>
          </a>

          <a href="/copilot" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🤖</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Copilot</h3>
              <p style={{ color: '#666' }}>
                Evidence-gated actions with real-time citations. Test incident detection and ticket triage.
              </p>
            </div>
          </a>

          <a href="/dashboard" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Dashboard</h3>
              <p style={{ color: '#666' }}>
                View operational metrics, KPIs, and efficiency gains across all workflows.
              </p>
            </div>
          </a>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          ⚡ Key Features
        </h2>
        <ul style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li><strong>ES|QL Spike Detection:</strong> Automatically detect error spikes in application logs using Elasticsearch Query Language</li>
          <li><strong>Citation-Gated Actions:</strong> Enforce evidence-based automation - requires ≥2 citations before writing to prevent hallucinations</li>
          <li><strong>Intelligent Triage:</strong> Auto-classify tickets with semantic understanding using BM25 text search and kNN vector similarity</li>
          <li><strong>Deduplication:</strong> Prevent duplicate tickets using vector similarity scoring (threshold: 0.95) across ticket embeddings</li>
          <li><strong>Hybrid Search:</strong> Combine BM25 keyword matching and kNN vector search for best retrieval results</li>
          <li><strong>Resolution Retrieval:</strong> Match problems to proven solutions from knowledge base and historical resolutions</li>
          <li><strong>MCP Server Integration:</strong> Model Context Protocol endpoint for Elastic Agent Builder with JSON-RPC 2.0</li>
          <li><strong>Complete Audit Trail:</strong> Full workflow observability with ops-runs timeline and confidence scores</li>
        </ul>
      </div>
    </div>
  );
}
