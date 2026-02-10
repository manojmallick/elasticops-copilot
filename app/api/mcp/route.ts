// app/api/mcp/route.ts
import { NextRequest } from "next/server";
import { Client } from "@elastic/elasticsearch";
import { z } from "zod";

export const runtime = "nodejs";
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

// --- auth ---
function assertAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!process.env.MCP_AUTH_TOKEN) throw new Error("MCP_AUTH_TOKEN not set");
  if (!auth.toLowerCase().startsWith("bearer ") || token !== process.env.MCP_AUTH_TOKEN) {
    throw new Error("Unauthorized");
  }
}

// --- MCP tool registry ---
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
] as const;

// --- tool input schema ---
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

async function createOrUpdateTicket(args: unknown) {
  const parsed = CreateOrUpdateTicketInput.parse(args);

  const citations = parsed.fields.citations || [];
  if (citations.length < 2) {
    // MCP tool results should be returned in `content`
    return {
      content: [
        {
          type: "text",
          text:
            "CITATION_RULE: Not enough citations to create/update ticket. " +
            "Need >= 2 citations (preferably from 2 different indices).",
        },
      ],
      isError: true,
      meta: { confidence: "low", citations },
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
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ok: true, mode: "create", ticket_id: result._id, index: result._index, citations },
            null,
            2
          ),
        },
      ],
      isError: false,
      meta: { confidence: "high" },
    };
  }

  // update
  if (!parsed.ticket_id) {
    return {
      content: [{ type: "text", text: "ticket_id is required for update mode" }],
      isError: true,
      meta: { confidence: "low" },
    };
  }

  await client.update({
    index: "tickets",
    id: parsed.ticket_id,
    doc: {
      ...parsed.fields,
      citations,
      updated_at: now,
      source: "mcp",
    },
    refresh: "wait_for",
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { ok: true, mode: "update", ticket_id: parsed.ticket_id, index: "tickets", citations },
          null,
          2
        ),
      },
    ],
    isError: false,
    meta: { confidence: "high" },
  };
}

// --- JSON-RPC types ---
type JsonRpc = {
  jsonrpc: "2.0";
  id?: string | number | null; // notifications won't have id
  method: string;
  params?: any;
};

function ok(id: any, result: any) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function err(id: any, code: number, message: string, data?: any) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message, data } });
}

export async function POST(req: NextRequest) {
  try {
    assertAuth(req);
  } catch (e: any) {
    return new Response("Unauthorized", { status: 401 });
  }

  let msg: JsonRpc;
  try {
    msg = (await req.json()) as JsonRpc;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // 1) REQUIRED by Elastic MCP connector: initialize
  if (msg.method === "initialize") {
    const protocolVersion = msg.params?.protocolVersion ?? "2024-11-05";

    // Response shape matches MCP spec + Elastic example
    return ok(msg.id, {
      serverInfo: { name: "elasticops-mcp", version: "1.0.0" },
      capabilities: { tools: { listChanged: true } },
      protocolVersion,
    });
  }

  // 2) Notification (no response expected)
  if (msg.method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }

  // 3) Tool discovery
  if (msg.method === "tools/list") {
    return ok(msg.id, { tools: TOOLS });
  }

  // 4) Tool execution
  if (msg.method === "tools/call") {
    const toolName = msg.params?.name;
    const args = msg.params?.arguments;

    if (toolName !== "create_or_update_ticket") {
      return err(msg.id, -32601, `Unknown tool: ${toolName}`);
    }

    try {
      const result = await createOrUpdateTicket(args);
      return ok(msg.id, result);
    } catch (e: any) {
      return err(msg.id, -32000, e?.message ?? "Tool execution failed");
    }
  }

  // unknown method
  return err(msg.id ?? null, -32601, `Unknown method: ${msg.method}`);
}

export async function GET(req: NextRequest) {
  // optional health check
  try {
    assertAuth(req);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ ok: true, name: "elasticops-mcp", protocolVersion: "2024-11-05" });
}
