# Tool: Search Similar Tickets

## Overview
Find duplicate or related tickets using **kNN vector similarity** on ticket descriptions.

## Configuration

```json
{
  "name": "search_tickets",
  "description": "Find similar tickets based on vector similarity to detect duplicates",
  "type": "elasticsearch",
  "index": "tickets",
  "query_type": "knn"
}
```

## Query Template

```json
{
  "size": 5,
  "knn": {
    "field": "embedding",
    "query_vector": "{{ticket_embedding}}",
    "k": 5,
    "num_candidates": 100,
    "filter": {
      "bool": {
        "must_not": {
          "term": {
            "id": "{{exclude_ticket_id}}"
          }
        }
      }
    }
  },
  "_source": ["id", "title", "description", "status", "priority", "created_at", "resolved_at"]
}
```

## Parameters

- `ticket_embedding`: 384-dimensional vector of the current ticket
- `exclude_ticket_id`: Exclude the current ticket from results

## Similarity Threshold

- **Score ≥ 0.95**: High confidence duplicate (auto-tag)
- **Score 0.80-0.94**: Related ticket (include in context)
- **Score < 0.80**: Not similar enough

## Response Format

```json
{
  "hits": [
    {
      "_id": "ticket-1023",
      "_score": 0.96,
      "_source": {
        "id": "ticket-1023",
        "title": "API returning 429 errors",
        "description": "Our API is throwing 429 rate limit errors...",
        "status": "resolved",
        "priority": "medium",
        "resolved_at": "2024-01-10T15:30:00Z"
      }
    }
  ]
}
```

## Usage in Workflow

Step 3 of ticket triage workflow:

```typescript
const similarTickets = await searchSimilarTickets(
  ticketEmbedding,
  currentTicketId,
  5
);

// Check for duplicates
const highSimilarity = similarTickets.find(t => t._score >= 0.95);
if (highSimilarity) {
  // Tag as duplicate
  isDuplicate = true;
  duplicateOf = highSimilarity._id;
}
```

Implementation: [`lib/searchTemplates.ts`](../../lib/searchTemplates.ts)

## Deduplication Logic

```typescript
function checkDuplicate(score: number): boolean {
  return score >= 0.95;
}

function isRelated(score: number): boolean {
  return score >= 0.80 && score < 0.95;
}
```

## Example Query

**Input Ticket**: "Getting 429 rate limit errors from API endpoint /users"

**Returns**:
1. ticket-1023 (score: 0.96) - "API returning 429 errors" [DUPLICATE]
2. ticket-1056 (score: 0.89) - "Rate limiting issues with API" [RELATED]
3. ticket-987 (score: 0.84) - "API performance degradation" [RELATED]
4. ticket-742 (score: 0.78) - "Connection timeout to API" [NOT RELATED]

**Action**: Auto-tag as duplicate of ticket-1023
