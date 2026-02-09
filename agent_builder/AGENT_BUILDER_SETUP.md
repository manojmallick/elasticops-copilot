# Agent Builder Quick Setup

Quick reference for configuring Agent Builder to use ElasticOps Copilot webhook.

---

## Prerequisites

✅ App deployed to Vercel: `https://YOUR_VERCEL_DOMAIN.vercel.app`  
✅ Elastic Cloud cluster running  
✅ Webhook secret generated (e.g., `openssl rand -hex 32`)

---

## 1. Create Webhook Connector (2 min)

**Path**: Kibana → Stack Management → Connectors → Create connector → Webhook

| Field | Value |
|-------|-------|
| **Name** | `ElasticOps Ticket Webhook` |
| **URL** | `https://YOUR_VERCEL_DOMAIN.vercel.app/api/tools/create_or_update_ticket` |
| **Method** | `POST` |
| **Headers** | See below ⬇️ |

**Headers**:
```json
{
  "Content-Type": "application/json",
  "x-elasticops-secret": "YOUR_WEBHOOK_SECRET"
}
```

**Test Payload**:
```json
{
  "subject": "Test from connector",
  "description": "Verifying webhook works",
  "category": "application",
  "severity": "low",
  "priority": "low",
  "status": "new"
}
```

✅ Click **"Save"** → Then **"Test"** → Should succeed!

---

## 2. Create Workflow (3 min)

**Path**: Kibana → Stack Management → Workflows → Create workflow

| Field | Value |
|-------|-------|
| **Name** | `ticket_upsert_workflow` |
| **Description** | `Create or update tickets via ElasticOps webhook` |

**Add Step**:
- **Type**: Run connector
- **Connector**: `ElasticOps Ticket Webhook`
- **Body**:
  ```json
  {
    "id": "{{id}}",
    "subject": "{{subject}}",
    "description": "{{description}}",
    "category": "{{category}}",
    "severity": "{{severity}}",
    "priority": "{{priority}}",
    "status": "{{status}}",
    "incident_ref": "{{incident_ref}}",
    "channel": "agent-builder"
  }
  ```

**Define Parameters** (optional, make dynamic):
- `id` (string, optional) - Update existing ticket
- `subject` (string, required)
- `description` (string, required)
- `category` (string, optional) - `application`, `network`, `database`, `authentication`, `performance`, `other`
- `severity` (string, optional) - `low`, `medium`, `high`, `critical`
- `priority` (string, optional) - `low`, `medium`, `high`, `critical`
- `status` (string, optional) - `new`, `in_progress`, `resolved`, `closed`
- `incident_ref` (string, optional) - Link to incident ID

✅ Click **"Save"**

---

## 3. Add Tool to Agent Builder (2 min)

**Path**: Kibana → Agent Builder → Your Agent → Add Tool

| Field | Value |
|-------|-------|
| **Tool Type** | Workflow |
| **Tool Name** | `create_or_update_ticket` |
| **Description** | `Create or update support tickets. Use when user reports an issue or you detect a problem that needs tracking.` |
| **Workflow** | Select `ticket_upsert_workflow` |

**Parameter Mapping**:
```
subject: The ticket title/subject (required)
description: Detailed description of the issue (required)
category: Type of issue - application, network, database, authentication, performance, other (optional)
severity: Low, medium, high, or critical (optional)
priority: Low, medium, high, or critical (optional)
status: new, in_progress, resolved, closed (optional, defaults to 'new')
incident_ref: Link to related incident ID if applicable (optional)
```

✅ Click **"Save"**

---

## 4. Test Agent Tool (1 min)

In Agent Builder chat, try:

**Example 1 - Create Ticket**:
```
I'm seeing a database connection timeout. Create a high priority ticket for this.
```

Expected: Agent uses `create_or_update_ticket` tool → Ticket created ✅

**Example 2 - With Incident**:
```
Incident INC-2024-001 shows API rate limiting errors. Create a ticket with critical severity.
```

Expected: Ticket created with `incident_ref: "INC-2024-001"` ✅

**Example 3 - Update Ticket**:
```
Update ticket ticket-123 to resolved status with a note that we applied the fix.
```

Expected: Existing ticket updated ✅

---

## 5. Verify in App

Open: `https://YOUR_VERCEL_DOMAIN.vercel.app/inbox`

You should see tickets created by Agent Builder with:
- ✅ `channel: "agent-builder"`
- ✅ Proper category, severity, priority
- ✅ Linked to incident (if provided)

---

## Common Test Prompts

### Basic Creation
```
Create a ticket for a login authentication failure with medium severity.
```

### With Context
```
Users are reporting slow page loads. This looks like a performance issue. Create a high priority ticket.
```

### Incident Linking
```
For incident INC-2024-042, create a critical ticket to track the resolution.
```

### Status Update
```
Mark ticket ticket-456 as resolved and add a note that the database connection pool was increased.
```

---

## Troubleshooting

### ❌ Agent says "tool failed"

**Check**:
1. Vercel deployment is running
2. Webhook secret matches in:
   - Vercel env var: `ELASTICOPS_WEBHOOK_SECRET`
   - Kibana connector headers: `x-elasticops-secret`
3. Vercel logs for errors (Vercel dashboard → Functions → Logs)

### ❌ Test connector returns 401

**Fix**: Webhook secret mismatch. Update connector headers or Vercel env var.

### ❌ Test connector returns 500

**Fix**: 
1. Check Elastic Cloud is accessible from Vercel
2. Verify `ELASTIC_CLOUD_ID` and `ELASTIC_API_KEY` in Vercel env vars
3. Check Vercel function logs for error details

### ❌ Ticket not appearing in app

**Fix**:
1. Verify index exists: Kibana Dev Tools → `GET tickets/_search`
2. Check Vercel app refresh (might be cached)
3. Verify ticket ID in response matches what you're looking for

---

## Architecture Flow

```
┌──────────────────┐
│  Agent Builder   │
│  (Kibana)        │
└─────────┬────────┘
          │
          │ Uses tool:
          │ create_or_update_ticket
          ▼
┌──────────────────┐
│  Workflow        │
│  ticket_upsert   │
└─────────┬────────┘
          │
          │ Invokes connector
          ▼
┌──────────────────┐
│ Webhook Conn     │
│ (w/ secret)      │
└─────────┬────────┘
          │
          │ POST with x-elasticops-secret
          ▼
┌──────────────────┐
│  Vercel App      │
│  /api/tools/...  │
└─────────┬────────┘
          │
          │ Verifies secret
          │ Writes to Elastic
          ▼
┌──────────────────┐
│ Elastic Cloud    │
│ tickets index    │
└──────────────────┘
```

---

## Security Checklist

- [ ] Webhook secret is random and strong (32+ chars)
- [ ] Secret stored in Vercel env vars (not in code)
- [ ] Connector headers include secret
- [ ] Webhook route verifies secret (already implemented ✅)
- [ ] Elastic API key has appropriate permissions

---

## Validation Steps

Before demo:

1. [ ] Connector test succeeds
2. [ ] Workflow runs without errors
3. [ ] Agent tool creates a ticket
4. [ ] Ticket appears in app inbox
5. [ ] Ticket has correct data (subject, category, severity)
6. [ ] Screenshot saved for submission

---

**Setup Time**: ~10 minutes  
**Complexity**: Low (point-and-click in Kibana)  
**Result**: Agent can create tickets from natural language!

---

**Full Guide**: See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
