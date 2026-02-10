"use client";

import React, { useState } from "react";
import { citationUrl, citationLabel } from "@/lib/citationLinks";

type CopilotCitation = {
  index: "kb-articles" | "tickets" | "resolutions" | "incidents" | "logs-app";
  id: string;
  highlight?: string;
};

type CopilotRunResponse = {
  ok: boolean;
  run_id: string;
  timeline_url: string;
  summary: string;
  recommended_action?: string;
  entities?: {
    incident_id?: string;
    ticket_id?: string;
    duplicate_of_ticket_id?: string;
  };
  outputs?: {
    category?: string;
    severity?: string;
    priority?: string;
    draft_customer_message?: string;
    internal_notes?: string;
  };
  citations: CopilotCitation[];
  confidence: "low" | "medium" | "high";
  metrics?: Record<string, number>;
  debug?: { took_ms?: number };
};

function ResultPanel({ result }: { result: CopilotRunResponse | null }) {
  if (!result) {
    return (
      <div className="card">
        <p style={{ color: '#666' }}>Run an action to see evidence, audit trail, and outputs.</p>
      </div>
    );
  }

  const hasCrossIndex = new Set(result.citations?.map((c) => c.index)).size >= 2;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span className="badge">confidence: {result.confidence}</span>
          <span className="badge">citations: {result.citations?.length ?? 0}</span>
          <span className="badge">cross-index: {hasCrossIndex ? "yes" : "no"}</span>
          {result.debug?.took_ms ? <span className="badge">took: {result.debug.took_ms}ms</span> : null}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Summary</div>
          <div>{result.summary}</div>
        </div>

        {result.recommended_action ? (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Recommended action</div>
            <div>{result.recommended_action}</div>
          </div>
        ) : null}

        {result.entities ? (
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {result.entities.incident_id ? (
              <div>
                <span style={{ fontWeight: 600 }}>Incident:</span>{" "}
                <span style={{ fontFamily: 'monospace' }}>{result.entities.incident_id}</span>
              </div>
            ) : null}
            {result.entities.ticket_id ? (
              <div>
                <span style={{ fontWeight: 600 }}>Ticket:</span>{" "}
                <span style={{ fontFamily: 'monospace' }}>{result.entities.ticket_id}</span>
              </div>
            ) : null}
            {result.entities.duplicate_of_ticket_id ? (
              <div>
                <span style={{ fontWeight: 600 }}>Duplicate of:</span>{" "}
                <span style={{ fontFamily: 'monospace' }}>{result.entities.duplicate_of_ticket_id}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <a
            style={{ fontWeight: 600, color: '#1a73e8', textDecoration: 'underline' }}
            href={result.timeline_url}
          >
            View audit timeline →
          </a>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Evidence (citations)</div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {result.citations?.length ? (
            result.citations.map((c, i) => (
              <div key={i} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>{c.index}</span>
                  <a 
                    href={citationUrl(c.index, c.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.85rem', 
                      color: '#1a73e8',
                      textDecoration: 'underline'
                    }}
                  >
                    {c.id} →
                  </a>
                </div>
                {c.highlight ? (
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{c.highlight}</div>
                ) : null}
              </div>
            ))
          ) : (
            <div style={{ color: '#666' }}>
              No citations returned. (This should block actions in production.)
            </div>
          )}
        </div>

        <div style={{ marginTop: '1rem', background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Governance</div>
          <div>Actions are allowed only when citations ≥ 2 (preferably cross-index).</div>
        </div>
      </div>

      {result.outputs ? (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Copilot outputs</div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {result.outputs.category ? (
              <div><span style={{ fontWeight: 600 }}>Category:</span> {result.outputs.category}</div>
            ) : null}
            {result.outputs.severity ? (
              <div><span style={{ fontWeight: 600 }}>Severity:</span> {result.outputs.severity}</div>
            ) : null}
            {result.outputs.priority ? (
              <div><span style={{ fontWeight: 600 }}>Priority:</span> {result.outputs.priority}</div>
            ) : null}

            {result.outputs.draft_customer_message ? (
              <div style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '0.75rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Draft customer message</div>
                <MessageWithLinks text={result.outputs.draft_customer_message} />
              </div>
            ) : null}

            {result.outputs.internal_notes ? (
              <div style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '0.75rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Internal notes</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{result.outputs.internal_notes}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function postJSON<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(json?.error || `Request failed: ${res.status} ${res.statusText}`);
  }
  return json as T;
}

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

export default function CopilotPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [last, setLast] = useState<CopilotRunResponse | null>(null);

  const [ticketId, setTicketId] = useState("");
  const [subject, setSubject] = useState("demo failure from /copilot");
  const [description, setDescription] = useState("Placeholder ticket created during demo via Copilot UI.");

  async function runDetect() {
    setLoading("detect");
    try {
      const r = await postJSON<CopilotRunResponse>("/api/run/incident/detect", {
        window_minutes: 5,
        threshold: 40,
      });
      setLast(r);
      if (r.entities?.ticket_id) setTicketId(r.entities.ticket_id);
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(null);
    }
  }

  async function runTriage() {
    if (!ticketId.trim()) return;
    setLoading("triage");
    try {
      const r = await postJSON<CopilotRunResponse>(`/api/run/ticket/${ticketId}`, {
        mode: "triage",
      });
      setLast(r);
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(null);
    }
  }

  async function runCreate() {
    setLoading("create");
    try {
      const r = await postJSON<CopilotRunResponse>("/api/run/ticket/create_demo", {
        subject,
        description,
      });
      setLast(r);
      if (r.entities?.ticket_id) setTicketId(r.entities.ticket_id);
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">ElasticOps Copilot</h1>
        <p className="page-subtitle">
          Evidence-gated actions powered by Elasticsearch (ES|QL + vectors + hybrid search).
        </p>
        {last?.timeline_url ? (
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
            Last timeline: <span style={{ fontFamily: 'monospace' }}>{last.timeline_url}</span>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* LEFT COLUMN */}
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Incident Awareness
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              Detect spikes (ES|QL) → create incident → open a ticket → record audit timeline.
            </div>
            <button
              className="btn"
              onClick={runDetect}
              disabled={!!loading}
              style={{ width: '100%' }}
            >
              {loading === "detect" ? "Running…" : "Detect Error Spike → Create Ticket"}
            </button>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Ticket Triage
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              Dedupe (kNN) + hybrid KB retrieval (BM25 + vectors) + draft response + citations.
            </div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Ticket ID
            </label>
            <input
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                marginBottom: '1rem'
              }}
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="paste ticket id"
            />
            <button
              className="btn"
              onClick={runTriage}
              disabled={!!loading || !ticketId.trim()}
              style={{ width: '100%' }}
            >
              {loading === "triage" ? "Running…" : "Triage Ticket"}
            </button>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Create Test Ticket
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              UI-driven creation (evidence-gated). Uses retrieval + citations before acting.
            </div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Subject
            </label>
            <input
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
                marginBottom: '1rem'
              }}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              className="btn"
              onClick={runCreate}
              disabled={!!loading}
              style={{ width: '100%' }}
            >
              {loading === "create" ? "Running…" : "Create Ticket (evidence-gated)"}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <ResultPanel result={last} />
        </div>
      </div>
    </div>
  );
}
