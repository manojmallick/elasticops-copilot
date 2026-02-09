# Connectors Configuration

This document describes the **connectors** designed for the Elastic Agent Builder agent.

> **Note**: The LLM connector (Gemini) is documented as a planned future enhancement to show Agent Builder design capabilities. The current implementation uses deterministic drafting logic. The webhook connector for ticket updates is fully implemented.

## Overview

Agent Builder can use connectors to:
1. Call external LLMs (Google Gemini) for intelligent drafting *(planned future work)*
2. Execute actions (create/update tickets via webhooks) *(implemented)*

## 1. Gemini Connector (Planned Future Enhancement)

### Type
**Gemini Connector** (Google AI generative API)

> **Status**: Designed but not implemented. This section documents how the connector would be configured when added in the future.

### Configuration

```json
{
  "name": "Gemini (gemini-1.5-flash)",
  "connector_type_id": ".gemini",
  "config": {
    "apiUrl": "https://generativelanguage.googleapis.com/v1beta/models",
    "defaultModel": "gemini-1.5-flash"
  },
  "secrets": {
    "apiKey": "<GEMINI_API_KEY>"
  }
}
```

### Environment Setup

In `.env.local`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

### Usage in Workflow

The Gemini connector is called in step 6 of the ticket triage workflow:

```typescript
// Step 6: Draft response using LLM (if available)
if (isGeminiAvailable()) {
  const prompt = buildTriagePrompt({
    ticket,
    kbArticles,
    similarTickets,
    resolutions,
    errorLogs
  });

  const llmResponse = await geminiGenerate([
    { role: 'user', content: prompt }
  ]);

  if (llmResponse.success && llmResponse.content) {
    const parsed = safeJsonParse(llmResponse.content);
    const validated = validateAgentDraft(parsed);
    
    if (validated) {
      draft = validated;
    }
  }
}
```

### Request Format

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "<full prompt with context>"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 1024
  }
}
```

### Response Format

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "{\"customerMessage\": \"...\", \"internalNotes\": \"...\", \"confidence\": 0.85, \"citations\": [...]}"
          }
        ]
      }
    }
  ]
}
```

## 2. Webhook Connector

### Type
**Webhook Connector** (HTTP POST)

### Configuration

```json
{
  "name": "Ticket API Webhook",
  "connector_type_id": ".webhook",
  "config": {
    "url": "{{ticket_api_url}}",
    "method": "post",
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
```

### Usage in Workflow

The webhook connector is called in step 7 of the ticket triage workflow to update tickets:

```typescript
// Step 7: Act based on confidence and citations
if (draft.confidence >= 0.85 && draft.citations.length >= 2) {
  // High confidence + sufficient citations = auto-update
  const updatePayload = {
    status: 'resolved',
    resolution: draft.customerMessage,
    internal_notes: draft.internalNotes,
    confidence_score: draft.confidence,
    citations: draft.citations,
    resolved_at: new Date().toISOString(),
    resolved_by: 'ai-agent'
  };

  await fetch(`/api/tickets/${ticketId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload)
  });
}
```

### Request Payloads

#### Update Ticket (High Confidence)
```json
{
  "status": "resolved",
  "resolution": "<customer message>",
  "internal_notes": "<agent notes>",
  "confidence_score": 0.92,
  "citations": [...],
  "resolved_at": "2024-01-15T10:30:00Z",
  "resolved_by": "ai-agent"
}
```

#### Tag Duplicate (High Similarity)
```json
{
  "status": "duplicate",
  "duplicate_of": "ticket-1023",
  "internal_notes": "Auto-tagged as duplicate (similarity 0.96)"
}
```

#### Flag for Review (Low Confidence)
```json
{
  "needs_human_review": true,
  "ai_draft_notes": "<agent's incomplete draft>",
  "confidence_score": 0.45
}
```

## Connector Flow Diagram

```
┌─────────────────────┐
│  Ticket Created     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Gather Context     │
│  (ES|QL + kNN)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Gemini Connector   │◄── Call LLM with prompt
│  (Draft Response)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Parse + Validate   │
│  (Check citations)  │
└──────────┬──────────┘
           │
           ▼
    ┌──────┴──────┐
    │ Confidence? │
    └──────┬──────┘
           │
    ┌──────┴──────────────┐
    │                     │
    ▼                     ▼
┌───────┐            ┌──────────┐
│ ≥0.85 │            │  <0.85   │
│ &     │            │    OR    │
│ 2+    │            │ <2 cites │
│ cites │            └─────┬────┘
└───┬───┘                  │
    │                      ▼
    │            ┌──────────────────┐
    │            │ Webhook: Flag    │
    │            │ for Human Review │
    │            └──────────────────┘
    │
    ▼
┌──────────────────┐
│ Webhook: Update  │
│ Ticket           │
└──────────────────┘
```

## Implementation Files

- Gemini Integration: [`lib/llm_gemini.ts`](../lib/llm_gemini.ts)
- Webhook Calls: [`app/api/tickets/[id]/route.ts`](../app/api/tickets/[id]/route.ts)
- Workflow Logic: [`app/api/run/ticket/[id]/route.ts`](../app/api/run/ticket/[id]/route.ts)

## Testing Connectors

### Test Gemini
```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{"text": "Say hello"}]
    }]
  }'
```

### Test Webhook
```bash
curl -X PUT "http://localhost:3000/api/tickets/ticket-1" \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "resolved",
    "resolution": "Test resolution"
  }'
```
