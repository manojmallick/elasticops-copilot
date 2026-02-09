# Tool: Search KB Articles

## Overview
Semantic search over knowledge base articles using **hybrid search** (BM25 + kNN vector similarity).

## Configuration

```json
{
  "name": "search_kb_articles",
  "description": "Search the knowledge base for articles related to a ticket description or error message",
  "type": "elasticsearch",
  "index": "kb-articles",
  "query_type": "hybrid"
}
```

## Query Template

```json
{
  "size": 5,
  "query": {
    "bool": {
      "should": [
        {
          "multi_match": {
            "query": "{{query_text}}",
            "fields": ["title^3", "content^2", "tags"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        },
        {
          "knn": {
            "field": "embedding",
            "query_vector": "{{query_embedding}}",
            "k": 10,
            "num_candidates": 50
          }
        }
      ]
    }
  },
  "_source": ["id", "title", "content", "tags", "category"]
}
```

## Parameters

- `query_text`: The search query (ticket description or error message)
- `query_embedding`: 384-dimensional vector generated from `query_text`

## Embedding Generation

Uses deterministic SHA-256 hashing for reproducibility:

```typescript
function deterministicEmbed(text: string): number[] {
  const hash = crypto.createHash('sha256').update(text.toLowerCase()).digest();
  const embedding: number[] = [];
  
  for (let i = 0; i < 384; i++) {
    const byte = hash[i % 32];
    embedding[i] = (byte / 255) * 2 - 1; // Normalize to [-1, 1]
  }
  
  return embedding;
}
```

## Scoring

1. **BM25 Score**: Text match on title, content, tags (boosted by field)
2. **kNN Score**: Cosine similarity between embeddings
3. **Combined**: `BM25 * 0.6 + kNN * 0.4`

## Response Format

```json
{
  "hits": [
    {
      "_id": "kb-847",
      "_score": 18.532,
      "_source": {
        "id": "kb-847",
        "title": "API Rate Limiting - 429 Errors",
        "content": "If you're seeing 429 errors...",
        "tags": ["api", "rate-limit", "429"],
        "category": "API"
      }
    }
  ]
}
```

## Usage in Workflow

Step 2 of ticket triage workflow:

```typescript
const kbArticles = await searchKBArticles(
  ticketDescription,
  embedVector,
  5 // top 5 results
);
```

Implementation: [`lib/searchTemplates.ts`](../../lib/searchTemplates.ts)

## Example Query

**Input**: "Getting 429 errors from API"

**Returns**:
- KB-847: API Rate Limiting configuration
- KB-201: Common API error codes
- KB-903: Debugging API timeouts
- KB-542: Authentication best practices
- KB-789: Service limits and quotas
