# Workflow: Ticket Triage & Auto-Update

## Overview

This workflow orchestrates the complete ticket triage process using Agent Builder tools, LLM reasoning, and confidence-gated actions.

## Workflow ID
`ticket_upsert_workflow`

## Trigger
**API POST**: `/api/run/ticket/{id}`

When a new ticket is created or needs triage, this endpoint triggers the workflow.

## Steps

### Step 1: Fetch Ticket
**Action**: Retrieve full ticket details from Elasticsearch

```typescript
const ticket = await client.get({
  index: 'tickets',
  id: ticketId
});
```

**Output**: Ticket object with title, description, priority, status

---

### Step 2: Search KB Articles
**Tool**: `search_kb_articles` (hybrid search)

**Input**: 
- Ticket description text
- Generated 384-dim embedding

**Query**:
```json
{
  "query": {
    "bool": {
      "should": [
        {"multi_match": {"query": "{{description}}", "fields": ["title^3", "content^2"]}},
        {"knn": {"field": "embedding", "query_vector": [...]}}
      ]
    }
  }
}
```

**Output**: Top 5 relevant KB articles

---

### Step 3: Detect Duplicates
**Tool**: `search_tickets` (kNN similarity)

**Input**: Ticket embedding

**Query**:
```json
{
  "knn": {
    "field": "embedding",
    "query_vector": [...],
    "k": 5,
    "filter": {"must_not": {"term": {"id": "{{current_ticket_id}}"}}}
  }
}
```

**Logic**:
- If similarity score ≥ 0.95 → Mark as duplicate
- If 0.80 ≤ score < 0.95 → Include as related context

**Output**: Similar tickets list + duplicate flag

---

### Step 4: Retrieve Resolutions
**Tool**: `search_resolutions` (kNN semantic)

**Input**: Ticket embedding

**Query**:
```json
{
  "knn": {
    "field": "embedding",
    "query_vector": [...],
    "k": 3
  }
}
```

**Output**: Top 3 past resolution notes

---

### Step 5: Detect Error Spikes (Optional)
**Tool**: `detect_error_spikes.esql`

**Query**:
```sql
FROM logs-app
| WHERE log_level == "error"
| EVAL error_time = DATE_TRUNC(5 minutes, @timestamp)
| STATS error_count = COUNT(*) BY error_time, service
| WHERE error_count >= 40
| SORT error_time DESC
| LIMIT 100
```

**Output**: Recent error spikes (if any)

---

### Step 6: Draft Response (Deterministic Logic)
**Method**: Rule-based drafting based on classification and citations

> **Note**: This step is designed to support LLM-powered drafting in the future via a Gemini connector. The current implementation uses deterministic logic that reliably generates responses based on gathered context.

**Current Implementation**:
```typescript
// Deterministic drafting based on classifications and citations
if (isDuplicate) {
  customerMessage = "Thank you for reaching out. We've identified that this issue is similar to a previously reported case...";
  internalNotes = `DUPLICATE: Similar to ticket ${similarTickets[0].id}`;
} else if (confidence === 'high') {
  customerMessage = `Thank you for contacting support regarding "${ticket.subject}". Based on our knowledge base...`;
  // Include KB articles and resolutions
  internalNotes = `AUTO-TRIAGE: Category=${classification.category}, Severity=${classification.severity}`;
} else {
  customerMessage = "Thank you for reaching out. We've received your request...";
  internalNotes = `NEEDS_HUMAN: Insufficient automated context (${citations.length} sources)`;
}
```

**Output**: Draft with customerMessage, internalNotes, confidence score

**Future Enhancement (Planned)**:
- LLM connector (Gemini) for intelligent, context-aware drafting
- JSON schema validation with structured output
- Dynamic confidence scoring

---

### Step 7: Act Based on Confidence
**Decision Tree**:

```
┌─────────────────────┐
│  Check Duplicate    │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │ Duplicate?  │
    └──────┬──────┘
           │
     ┌─────┴─────┐
     │ Yes       │ No
     ▼           ▼
┌──────────┐  ┌──────────────┐
│ Tag as   │  │ Check Score  │
│ Duplicate│  │ & Citations  │
└──────────┘  └──────┬───────┘
                     │
              ┌──────┴──────────────┐
              │ Confidence ≥ 0.85   │
              │ AND                 │
              │ Citations ≥ 2?      │
              └──────┬──────────────┘
                     │
              ┌──────┴──────┐
              │ Yes         │ No
              ▼             ▼
        ┌──────────┐   ┌──────────────┐
        │ Auto     │   │ Flag for     │
        │ Update   │   │ Human Review │
        └──────────┘   └──────────────┘
```

#### Action 1: Tag Duplicate
**Condition**: Similarity ≥ 0.95

**Webhook**:
```json
PUT /api/tickets/{id}
{
  "status": "duplicate",
  "duplicate_of": "ticket-1023",
  "internal_notes": "Auto-tagged (similarity 0.96)"
}
```

#### Action 2: Auto-Update Ticket
**Condition**: 
- `confidence ≥ 0.85`
- `citations.length ≥ 2`

**Webhook**:
```json
PUT /api/tickets/{id}
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

#### Action 3: Flag for Review
**Condition**: 
- `confidence < 0.85`
- OR `citations.length < 2`

**Webhook**:
```json
PUT /api/tickets/{id}
{
  "needs_human_review": true,
  "ai_draft_notes": "<incomplete draft>",
  "confidence_score": 0.45
}
```

---

## Workflow Diagram

```
┌──────────────┐
│   Ticket     │
│   Created    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Step 1:      │
│ Fetch Ticket │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Step 2:      │
│ Search KB    │
│ (Hybrid)     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Step 3:      │
│ Find Similar │
│ Tickets (kNN)│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Step 4:      │
│ Get Past     │
│ Resolutions  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Step 5:      │
│ Check Errors │
│ (ES|QL)      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Step 6:      │
│ Call Gemini  │
│ (Draft)      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Parse JSON   │
│ Validate     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Step 7:      │
│ Confidence   │
│ Gate         │
└──────┬───────┘
       │
   ┌───┴───┐
   │ Gate? │
   └───┬───┘
       │
  ┌────┴─────────────┐
  │ Pass   │  Fail   │
  ▼        ▼         ▼
┌────┐  ┌────┐  ┌────────┐
│Auto│  │Dup │  │ Flag   │
│Updt│  │Tag │  │ Review │
└────┘  └────┘  └────────┘
```

## Implementation

**File**: [`app/api/run/ticket/[id]/route.ts`](../../app/api/run/ticket/[id]/route.ts)

## Metrics

The workflow tracks:
- Time per step
- LLM success rate
- Citation count distribution
- Confidence score distribution
- Auto-update rate vs. human review rate

## Example Execution

**Input**: Ticket #1534 - "API returning 429 errors"

**Step Results**:
1. ✅ Fetched ticket (50ms)
2. ✅ Found 5 KB articles (245ms)
3. ✅ Found 1 duplicate (similarity 0.96) (180ms)
4. ✅ Retrieved 3 resolutions (120ms)
5. ⚠️ No error spikes detected (95ms)
6. ✅ Gemini draft (confidence 0.92, 3 citations) (1200ms)
7. ✅ Auto-tagged as duplicate of ticket-1023

**Total Time**: 1.89s
**Action**: Tagged duplicate (no LLM update needed)
