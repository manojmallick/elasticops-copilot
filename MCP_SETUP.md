# MCP Server Setup Guide

This document explains how to set up and use the Model Context Protocol (MCP) server endpoint for Elastic Agent Builder integration.

## Overview

The MCP server provides a JSON-RPC over SSE (Server-Sent Events) API that allows Elastic Agent Builder (or other MCP clients) to create and update tickets in Elasticsearch with strict citation enforcement.

**Key Features:**
- 📋 `tools/list` - Discover available tools
- 🔧 `tools/call` - Execute create_or_update_ticket tool
- 🔒 Citation-gated writes (requires ≥2 citations)
- 🔑 Bearer token authentication
- ⚡ Immediate visibility with `refresh: "wait_for"`

## Environment Variables

### Required for Local Development

Add to `.env.local`:

```bash
ELASTIC_MODE=cloud
ELASTIC_CLOUD_ID=your-cloud-id
ELASTIC_API_KEY=your-api-key
MCP_AUTH_TOKEN=elasticops-mcp-secret-token-2026-v1-secure
```

### Required for Vercel Deployment

Add these to Vercel Environment Variables (Settings → Environment Variables):

| Variable | Value | Description |
|----------|-------|-------------|
| `ELASTIC_MODE` | `cloud` | Use Elasticsearch Cloud |
| `ELASTIC_CLOUD_ID` | `your-cloud-id` | Your Elasticsearch Cloud ID |
| `ELASTIC_API_KEY` | `your-api-key` | Your Elasticsearch API key |
| `MCP_AUTH_TOKEN` | `super-long-random-secret` | Generate a secure random token |

**Important:** Generate a strong random token for `MCP_AUTH_TOKEN`:
```bash
openssl rand -base64 32  # or use any secure random generator
```

## Endpoint

```
POST https://elasticops-copilot.vercel.app/api/mcp
GET  https://elasticops-copilot.vercel.app/api/mcp  # health check
```

## Authentication

All requests must include a Bearer token:

```bash
Authorization: Bearer <MCP_AUTH_TOKEN>
```

## Available Tools

### create_or_update_ticket

Create or update tickets in Elasticsearch with citation enforcement.

**Input Schema:**
```json
{
  "mode": "create" | "update",
  "ticket_id": "TKT-xxx" | null,
  "fields": {
    "subject": "string (min 3 chars)",
    "description": "string (min 5 chars)",
    "status": "open" | "resolved" | "closed",
    "priority": "normal" | "p1" | "p2" | "p3",
    "citations": ["index:id", "index:id", ...]
  }
}
```

**Citation Rules:**
- ✅ Requires **≥ 2 citations** before writing
- ✅ Citations format: `"index-name:document-id"` (e.g., `"kb-articles:KB001"`)
- ❌ Blocks with `ok: false` if citations < 2
- 💡 Recommends gathering more evidence when blocked

## Testing Locally

### 1. List Available Tools

```bash
export MCP_AUTH_TOKEN="elasticops-mcp-secret-token-2026-v1-secure"

curl -N \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://localhost:3000/api/mcp
```

**Expected Response:**
```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"create_or_update_ticket",...}]}}
```

### 2. Create Ticket (with sufficient citations)

```bash
curl -N \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params":{
      "name":"create_or_update_ticket",
      "arguments":{
        "mode":"create",
        "ticket_id":null,
        "fields":{
          "subject":"payment webhook 502 test",
          "description":"Testing MCP ticket creation with evidence gating.",
          "status":"open",
          "priority":"normal",
          "citations":["kb-articles:KB001","tickets:TKT-001"]
        }
      }
    }
  }' \
  http://localhost:3000/api/mcp
```

**Expected Response:**
```
event: message
data: {"jsonrpc":"2.0","id":2,"result":{"ok":true,"mode":"create","ticket_id":"abc123","index":"tickets","confidence":"high"}}
```

### 3. Test Citation Enforcement (should fail)

```bash
curl -N \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"create_or_update_ticket",
      "arguments":{
        "mode":"create",
        "ticket_id":null,
        "fields":{
          "subject":"test single citation",
          "description":"Should fail with only 1 citation.",
          "status":"open",
          "priority":"normal",
          "citations":["kb-articles:KB001"]
        }
      }
    }
  }' \
  http://localhost:3000/api/mcp
```

**Expected Response:**
```
event: message
data: {"jsonrpc":"2.0","id":3,"result":{"ok":false,"confidence":"low","error":"CITATION_RULE: need at least 2 citations before writing","recommended_action":"Run search tools to gather more evidence (prefer 2 different indices)."}}
```

### 4. Verify in Kibana

Go to Kibana Discover and search:
```
subject:"payment webhook 502 test"
```

You should see the newly created ticket with:
- `citations` field containing the 2+ references
- `source: "mcp"` tag
- `created_at` timestamp

## Update Ticket

```bash
curl -N \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":4,
    "method":"tools/call",
    "params":{
      "name":"create_or_update_ticket",
      "arguments":{
        "mode":"update",
        "ticket_id":"abc123",
        "fields":{
          "subject":"payment webhook 502 - updated",
          "description":"Updated description with new evidence.",
          "status":"resolved",
          "priority":"p2",
          "citations":["kb-articles:KB001","kb-articles:KB002","resolutions:RES001"]
        }
      }
    }
  }' \
  http://localhost:3000/api/mcp
```

## Integration with Elastic Agent Builder

### Configuration

Add this MCP server to your Agent Builder configuration:

```yaml
mcp_servers:
  elasticops:
    endpoint: https://elasticops-copilot.vercel.app/api/mcp
    auth:
      type: bearer
      token: ${MCP_AUTH_TOKEN}
    tools:
      - create_or_update_ticket
```

### Workflow Example

1. **User reports issue** → Agent Builder receives the ticket
2. **Agent searches** → Queries `kb-articles` and `tickets` indices
3. **Agent gathers citations** → Collects relevant document IDs
4. **Agent calls MCP tool** → `create_or_update_ticket` with 2+ citations
5. **Ticket created** → Immediately visible in Kibana + ElasticOps UI
6. **Audit trail** → Full transparency with citations and confidence scores

## Error Handling

### 401 Unauthorized
```json
{"error": "Unauthorized"}
```
→ Check `MCP_AUTH_TOKEN` matches in request and server

### Citation Rule Violation
```json
{
  "ok": false,
  "confidence": "low",
  "error": "CITATION_RULE: need at least 2 citations before writing",
  "recommended_action": "Run search tools to gather more evidence (prefer 2 different indices)."
}
```
→ Agent should search more indices to find additional evidence

### Tool Not Found
```json
{
  "jsonrpc": "2.0",
  "error": {"code": -32601, "message": "Unknown tool: invalid_tool_name"}
}
```

### Zod Validation Error
```json
{
  "jsonrpc": "2.0",
  "error": {"code": -32000, "message": "Validation error: ..."}
}
```
→ Check input schema matches the required format

## Production Checklist

- [ ] Set `MCP_AUTH_TOKEN` in Vercel Environment Variables
- [ ] Use a strong random token (min 32 characters)
- [ ] Verify `ELASTIC_CLOUD_ID` and `ELASTIC_API_KEY` are set
- [ ] Test endpoint from Agent Builder with Bearer token
- [ ] Monitor Kibana for tickets with `source: "mcp"`
- [ ] Verify citations are being enforced (test with 1 citation)
- [ ] Check audit logs in `ops-runs` index (if implemented)

## Troubleshooting

### Tickets not appearing in Kibana
- Check that `refresh: "wait_for"` is used (already set)
- Verify Elasticsearch connection with `curl GET /api/tickets`

### Authentication failing
- Ensure `Authorization: Bearer <token>` header is sent
- Token must match `MCP_AUTH_TOKEN` environment variable exactly

### Citations not enforcing
- Check that `citations` array has ≥ 2 items
- Verify each citation is a non-empty string

## Next Steps

1. **Deploy to Vercel** - Push changes and verify deployment
2. **Configure Agent Builder** - Add MCP server endpoint
3. **Test end-to-end** - Create tickets from Agent Builder
4. **Monitor usage** - Track tickets with `source: "mcp"` tag
5. **Add search tools** - Implement MCP tools for KB/ticket search (optional)

## Related Files

- `app/api/mcp/route.ts` - MCP server implementation
- `.env.local` - Local environment variables
- `lib/elastic.ts` - Elasticsearch client configuration
- `app/api/run/ticket/create_demo/route.ts` - UI-based ticket creation

---

**Ready for production!** 🚀
