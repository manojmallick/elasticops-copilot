'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadMetrics();
  }, [days]);

  async function loadMetrics() {
    setLoading(true);
    try {
      const response = await fetch(`/api/metrics?days=${days}`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const metricsData = metrics?.metrics || {};
  const categories = metrics?.categories || {};

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Operations Dashboard</h1>
        <p className="page-subtitle">KPIs and metrics from the last {days} days</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Time period:</label>
        <select 
          value={days} 
          onChange={(e) => setDays(parseInt(e.target.value))}
          style={{
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ddd',
            fontSize: '1rem'
          }}
        >
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
        Key Metrics
      </h2>
      
      <div className="grid">
        <div className="metric-card">
          <div className="metric-value">
            {Math.round(metricsData.duplicates_prevented?.total || 0)}
          </div>
          <div className="metric-label">Duplicates Prevented</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {Math.round(metricsData.time_saved_minutes?.total || 0)}
          </div>
          <div className="metric-label">Time Saved (minutes)</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {metricsData.mtta_seconds?.avg ? Math.round(metricsData.mtta_seconds.avg) : 0}s
          </div>
          <div className="metric-label">Avg MTTA (seconds)</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {Math.round(metricsData.tickets_auto_triaged?.total || 0)}
          </div>
          <div className="metric-label">Tickets Auto-Triaged</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {Math.round(metricsData.ticket_created?.total || 0)}
          </div>
          <div className="metric-label">Tickets Created</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {Math.round(metricsData.ticket_updated?.total || 0)}
          </div>
          <div className="metric-label">Tickets Updated</div>
        </div>
      </div>

      {Object.keys(categories).length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
            Activity by Category
          </h2>
          
          <div className="card">
            <div style={{ display: 'grid', gap: '1rem' }}>
              {Object.entries(categories)
                .sort(([, a]: any, [, b]: any) => b - a)
                .map(([category, count]: any) => (
                  <div key={category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                      {category}
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1a73e8' }}>
                      {Math.round(count)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {Object.keys(metricsData).length === 0 && (
        <div className="empty" style={{ marginTop: '2rem' }}>
          No metrics data available for this time period.
          <br />
          Run some workflows to see metrics here.
        </div>
      )}
    </div>
  );
}
