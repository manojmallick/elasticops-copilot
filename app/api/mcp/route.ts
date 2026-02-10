// app/api/mcp/route.ts
import { NextRequest } from "next/server";
import { Client } from "@elastic/elasticsearch";
import { z } from "zod";

export const runtime = "nodejs"; // IMPORTANT on Vercel (not edge)
export const dynamic = "force-dynamic";

const ELASTIC_MODE = process.env.ELASTIC_MODE || 'local';
const ELASTIC_CLOUD_ID = process.env.ELASTIC_CLOUD_ID;
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;
const ELASTIC_URL = process.env.ELASTIC_URL || 'http://localhost:9200';

const config: any = {};

// Cloud mode: use Cloud ID + API key
if (ELASTIC_MODE === 'cloud' && ELASTIC_CLOUD_ID && ELASTIC_API_KEY) {
  config.cloud = {
    id: ELASTIC_CLOUD_ID,
  };
  config.auth = {
    apiKey: ELASTIC_API_KEY,
  };
} else {
  // Local mode or fallback: use URL
  config.node = ELASTIC_URL;
  
  if (ELASTIC_API_KEY && ELASTIC_URL.startsWith('https')) {
    config.auth = {
      apiKey: ELASTIC_API_KEY,
    };
  }
}

const client = new Client(config);

const AuthHeaderSchema = z
  .string()
  .regex(/^Bearer\s+.+$/i, "Missing Bearer token");

function assertAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  AuthHeaderSchema.parse(auth);
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!process.env.MCP_AUTH_TOKEN) throw new Error("MCP_AUTH_TOKEN not set");
  if (token !== process.env.MCP_AUTH_TOKEN) {
    throw new Error("Unauthorized");
  }
}

/**
 * MCP Tool input schema
 */
const CreateOrUpdateTicketInput = z.object({
  mode: z.enum(["create", "update"]),
  ticket_id: z.string().nullable().optional(),
  fields: z.object({
    subject: z.string().min(3),
    description: z.string().min(5),
    status: z.enum(["open", "resolved", "closed"]).optional(),
    priority: z.enum(["normal", "p1", "p2", "p3"]).optional(),
    citations: z.array(z.string().min(3)).default([]),
  }),
});

type JsonRpcReq =
  | { jsonrpc: "2.0"; id: string | number | null; method: "tools/list"; params?: any }
  | { jsonrpc: "2.0"; id: string | number | null; method: "tools/call"; params: any };

/**
 * Helper: write SSE event
 */
function sseEvent(event: string, data: any) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const TOOLS = [
  {
    name: "create_or_update_ticket",
    description:
      "Create or update a ticket in Elasticsearch. Requires >= 2 citations before writing.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["create", "update"] },
        ticket_id: { type: ["string", "null"] },
        fields: {
          type: "object",
          properties: {
            subject: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["open", "resolved", "closed"] },
            priority: { type: "string", enum: ["normal", "p1", "p2", "p3"] },
            citations: { type: "array", items: { type: "string" } },
          },
          required: ["subject", "description", "citations"],
        },
      },
      required: ["mode", "fields"],
    },
  },
];

async function createOrUpdateTicket(raw: unknown) {
  const parsed = CreateOrUpdateTicketInput.parse(raw);

  const citations = parsed.fields.citations || [];
  if (citations.length < 2) {
    return {
      ok: false,
      confidence: "low",
      error: "CITATION_RULE: need at least 2 citations before writing",
      recommended_action:
        "Run search tools to gather more evidence (prefer 2 different indices).",
    };
  }

  const now = new Date().toISOString();

  if (parsed.mode === "create") {
    const doc = {
      subject: parsed.fields.subject,
      description: parsed.fields.description,
      status: parsed.fields.status ?? "open",
      priority: parsed.fields.priority ?? "normal",
      citations,
      created_at: now,
      updated_at: now,
      source: "mcp",
    };

    const result = await client.index({
      index: "tickets",
      document: doc,
      refresh: "wait_for",
    });

    return {
      ok: true,
      mode: "create",
      ticket_id: result._id,
      index: result._index,
      confidence: "high",
    };
  }

  // update
  if (!parsed.ticket_id) {
    return {
      ok: false,
      confidence: "low",
      error: "ticket_id required for update",
    };
  }

  const partial = {
    ...parsed.fields,
    citations,
    updated_at: now,
    source: "mcp",
  };

  await client.update({
    index: "tickets",
    id: parsed.ticket_id,
    doc: partial,
    refresh: "wait_for",
  });

  return {
    ok: true,
    mode: "update",
    ticket_id: parsed.ticket_id,
    index: "tickets",
    confidence: "high",
  };
}

/**
 * GET: SSE endpoint (Elastic MCP client can connect and stream)
 * POST: JSON-RPC over HTTP and stream response as SSE
 */
export async function GET(req: NextRequest) {
  // Optional: allow GET for "health" or SSE handshake
  try {
    assertAuth(req);
  } catch (e: any) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Basic "hello" event
      controller.enqueue(
        new TextEncoder().encode(
          sseEvent("ready", { ok: true, server: "elasticops-mcp", tools: TOOLS.map(t => t.name) })
        )
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    assertAuth(req);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let msg: JsonRpcReq;
  try {
    msg = (await req.json()) as JsonRpcReq;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      // helper to send JSON-RPC response via SSE
      const send = (event: string, payload: any) => controller.enqueue(enc.encode(sseEvent(event, payload)));

      try {
        if (msg.method === "tools/list") {
          send("message", { jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } });
          controller.close();
          return;
        }

        if (msg.method === "tools/call") {
          const toolName = msg.params?.name;
          const args = msg.params?.arguments;

          if (toolName !== "create_or_update_ticket") {
            send("message", {
              jsonrpc: "2.0",
              id: msg.id,
              error: { code: -32601, message: `Unknown tool: ${toolName}` },
            });
            controller.close();
            return;
          }

          // Execute tool
          const result = await createOrUpdateTicket(args);

          send("message", { jsonrpc: "2.0", id: msg.id, result });
          controller.close();
          return;
        }

        send("message", {
          jsonrpc: "2.0",
          id: (msg as any).id ?? null,
          error: { code: -32601, message: `Unknown method: ${(msg as any).method}` },
        });
        controller.close();
      } catch (err: any) {
        send("message", {
          jsonrpc: "2.0",
          id: (msg as any)?.id ?? null,
          error: { code: -32000, message: err?.message ?? "Server error" },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
