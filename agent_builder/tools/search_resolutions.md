# Tool: Search Resolution Notes

## Overview
Retrieve past resolution notes using **semantic kNN search** to find how similar issues were solved.

## Configuration

```json
{
  "name": "search_resolutions",
  "description": "Find past resolution notes for similar issues to guide response drafting",
  "type": "elasticsearch",
  "index": "resolutions",
  "query_type": "knn"
}
```

## Query Template

```json
{
  "size": 3,
  "knn": {
    "field": "embedding",
    "query_vector": "{{query_embedding}}",
    "k": 3,
    "num_candidates": 50
  },
  "_source": ["id", "ticket_id", "resolution_text", "resolved_by", "resolved_at", "category"]
}
```

## Parameters

- `query_embedding`: 384-dimensional vector of the ticket description or error

## Response Format

```json
{
  "hits": [
    {
      "_id": "res-1023",
      "_score": 14.827,
      "_source": {
        "id": "res-1023",
        "ticket_id": "ticket-1023",
        "resolution_text": "Updated rate limit config in api.yaml from 10 to 100 req/sec. Customer confirmed issue resolved after service restart.",
        "resolved_by": "jane@company.com",
        "resolved_at": "2024-01-10T15:30:00Z",
        "category": "configuration"
      }
    }
  ]
}
```

## Usage in Workflow

Step 4 of ticket triage workflow:

```typescript
const resolutions = await searchResolutions(
  ticketEmbedding,
  3 // top 3 past resolutions
);

// Include in LLM prompt for context
const prompt = buildTriagePrompt({
  ticket,
  kbArticles,
  similarTickets,
  resolutions // <-- Past resolutions
});
```

Implementation: [`lib/searchTemplates.ts`](../../lib/searchTemplates.ts)

## Why Resolution Notes?

Resolution notes provide:
1. **Proven Solutions**: What actually worked in production
2. **Context**: Edge cases and gotchas encountered
3. **Templates**: Language and structure for customer responses
4. **Confidence**: If similar issues were resolved before, confidence is higher

## Example Query

**Input**: "Database connection timeout after migration"

**Returns**:
1. res-842: "Increased connection pool size in database.yml. Customer needed to set max_connections=200 due to microservice architecture."
2. res-765: "Found network firewall blocking port 5432 after datacenter migration. Opened firewall rule."
3. res-591: "Updated connection string to use SSL after migration. Added sslmode=require parameter."

**Value**: LLM can reference these proven solutions when drafting response
