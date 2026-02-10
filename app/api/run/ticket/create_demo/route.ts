import { NextResponse } from "next/server";
import { esClient } from "@/lib/elastic";

type Citation = { index: string; id: string; highlight?: string };

async function topHit(index: string, query: string): Promise<Citation | null> {
  const r = await esClient.search({
    index,
    size: 1,
    query: { match: { content: query } },
    highlight: { fields: { "*": {} } },
  });
  const hit = r.hits.hits?.[0];
  if (!hit || !hit._id) return null;
  const hl = hit.highlight ? Object.values(hit.highlight).flat().slice(0, 1)[0] : undefined;
  return { index, id: hit._id, highlight: hl };
}

// tickets search should match subject/description
async function topTicket(query: string): Promise<Citation | null> {
  const r = await esClient.search({
    index: "tickets",
    size: 1,
    query: {
      multi_match: {
        query,
        fields: ["subject^2", "description"],
      },
    },
    highlight: { fields: { subject: {}, description: {} } },
  });
  const hit = r.hits.hits?.[0];
  if (!hit || !hit._id) return null;
  const hl = hit.highlight ? Object.values(hit.highlight).flat().slice(0, 1)[0] : undefined;
  return { index: "tickets", id: hit._id, highlight: hl };
}

export async function POST(req: Request) {
  const body = await req.json();
  const subject = String(body.subject || "").trim();
  const description = String(body.description || "").trim();

  if (!subject || !description) {
    return NextResponse.json({ ok: false, error: "subject and description required" }, { status: 400 });
  }

  // 1) Evidence FIRST (keep it light to reduce tokens)
  const q = `${subject} ${description}`.slice(0, 200);

  const kb = await esClient.search({
    index: "kb-articles",
    size: 1,
    query: { multi_match: { query: q, fields: ["title^2", "content"] } },
    highlight: { fields: { title: {}, content: {} } },
  });

  const kbHit = kb.hits.hits?.[0];
  const kbCitation = kbHit && kbHit._id
    ? {
        index: "kb-articles",
        id: kbHit._id,
        highlight: kbHit.highlight ? Object.values(kbHit.highlight).flat().slice(0, 1)[0] : undefined,
      }
    : null;

  const ticketCitation = await topTicket(q);

  const citations: Citation[] = [];
  if (kbCitation) citations.push(kbCitation);
  if (ticketCitation) citations.push(ticketCitation);

  // 2) Enforce your rule: >=2 citations before write
  if (citations.length < 2) {
    return NextResponse.json({
      ok: false,
      summary: "Not enough evidence to create ticket.",
      recommended_action: "Provide more details or broaden search terms.",
      citations,
      confidence: "low",
    });
  }

  // 3) REAL WRITE into Elasticsearch
  const ticketId = `TKT-${Date.now()}`;
  const doc = {
    ticket_id: ticketId,
    subject,
    description,
    status: "open",
    priority: "normal",
    category: "general",
    severity: "medium",
    channel: "copilot-ui",
    customer_id: "DEMO",
    citations: citations.map((c) => `${c.index}:${c.id}`),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ["copilot-created", "evidence-gated"],
  };

  const result = await esClient.index({
    index: "tickets",
    id: ticketId,
    body: doc,
    refresh: "wait_for", // makes it immediately visible in Kibana + UI
  });

  const runId = `run-${Date.now()}`;
  return NextResponse.json({
    ok: true,
    run_id: runId,
    timeline_url: `/timeline/${runId}`,
    summary: `Created ticket ${ticketId} in Elasticsearch with evidence gating.`,
    recommended_action: `Open the ticket and run triage.`,
    entities: { ticket_id: ticketId },
    citations,
    confidence: "high",
  });
}
