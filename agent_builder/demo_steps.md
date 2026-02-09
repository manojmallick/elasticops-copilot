# Demo Steps for Judges

This guide walks through a **5-minute demo** showing all Agent Builder features in action.

## Prerequisites

✅ Elastic Cloud or local Elasticsearch running  
✅ Indices created (`./infra/create-indices.sh`)  
✅ Synthetic data loaded (`node data/generator/generate_synthetic.js`)  
✅ Next.js app running (`npm run dev`)  

---

## Part 1: Setup Verification (30 seconds)

### 1.1 Check Environment
```bash
cat .env.local
```

**Expected**:
```bash
ELASTIC_MODE=cloud              # or "local"
ELASTIC_CLOUD_ID=elasticops:... # if cloud mode
ELASTIC_API_KEY=...             # API key for auth
GEMINI_API_KEY=...              # Optional: for LLM
```

### 1.2 Verify Indices
Open browser to Kibana or Cloud console:
- ✅ `kb-articles` - ~200 documents
- ✅ `tickets` - ~2000 documents
- ✅ `resolutions` - ~300 documents
- ✅ `logs-app` - ~10000 documents

---

## Part 2: Agent Builder Tools in Action (2 minutes)

### 2.1 ES|QL Tool: Error Spike Detection

**Navigate to**: http://localhost:3000/dashboard

**What You'll See**:
- Live metrics showing error spike alerts
- Graph of errors over time (5-minute buckets)
- Threshold indicator (≥40 errors = spike)

**Behind the Scenes**:
```sql
FROM logs-app
| WHERE log_level == "error"
| EVAL error_time = DATE_TRUNC(5 minutes, @timestamp)
| STATS error_count = COUNT(*) BY error_time, service
| WHERE error_count >= 40
| SORT error_time DESC
```

**Proof**: This ES|QL query is an Agent Builder tool ([`detect_error_spikes.esql`](./tools/detect_error_spikes.esql))

---

### 2.2 kNN Tool: Semantic Search

**Navigate to**: http://localhost:3000/search

**Try These Queries**:
1. **"database timeout"**  
   Expected: KB articles about connection pooling, timeouts, performance
   
2. **"API rate limit 429"**  
   Expected: KB articles about rate limiting, API quotas, configuration

**Behind the Scenes**:
```json
{
  "query": {
    "bool": {
      "should": [
        {"multi_match": {"query": "...", "fields": ["title^3", "content^2"]}},
        {"knn": {"field": "embedding", "query_vector": [...]}}
      ]
    }
  }
}
```

**Proof**: This is the `search_kb_articles` tool ([docs](./tools/search_kb_articles.md))

---

## Part 3: Ticket Triage Workflow (2 minutes)

### 3.1 View Inbox

**Navigate to**: http://localhost:3000/inbox

**What You'll See**:
- List of ~50 tickets needing triage
- Status badges: `new`, `in_progress`, `resolved`, `duplicate`
- Priority indicators: `low`, `medium`, `high`, `critical`

**Pick Any Ticket**: Click on one with status = `new`

---

### 3.2 Trigger Agent Workflow

**Click**: "Run Agent Triage" button

**What Happens** (watch the UI):

1. ⏳ **Searching KB articles...** (Step 2)
2. ⏳ **Checking for duplicates...** (Step 3)
3. ⏳ **Retrieving past resolutions...** (Step 4)
4. ⏳ **Detecting error spikes...** (Step 5)
5. ⏳ **Drafting response with LLM...** (Step 6)
6. ✅ **Complete!** (Step 7)

**Result Panel Shows**:
```
✅ Agent Triage Complete

Customer Message:
"Hi! This is a known issue with the API rate limiter. 
The fix is to update your config..."

Internal Notes:
"Found exact KB article KB-847 with this solution.
Also matched 3 past tickets with same error.
High confidence."

Confidence: 0.92
Citations: 3
- KB-847 (API Rate Limiting)
- ticket-1023 (Past resolution)
- res-1023 (Resolution notes)

Action: ✅ Auto-updated ticket
```

---

### 3.3 Verify Ticket Update

**Check Ticket Details**:
- ✅ Status changed to `resolved`
- ✅ Resolution text populated with customer message
- ✅ Internal notes added
- ✅ Confidence score recorded (0.92)
- ✅ Citations listed
- ✅ `resolved_by: ai-agent`

**Proof**: The workflow auto-updated because:
- Confidence ≥ 0.85 ✓
- Citations ≥ 2 ✓

---

### 3.4 Low Confidence Example

**Find a ticket** with status = `new` and description mentioning novel/unusual error

**Run Agent Triage**

**Result**:
```
⚠️ Needs Human Review

AI Draft Notes:
"Could not find exact match. Some related articles 
about network issues, but error code doesn't match 
any past tickets. Recommend escalation."

Confidence: 0.45
Citations: 1 (not enough)

Action: 🚩 Flagged for human review
```

**Proof**: Ticket was NOT auto-updated because citation gate failed

---

## Part 4: Agent Builder Artifacts (1 minute)

### 4.1 View Proof Documents

**Navigate to**: `agent_builder/` folder in the repository

**Files to Show Judges**:

1. **[`tools/detect_error_spikes.esql`](./tools/detect_error_spikes.esql)**  
   → Actual ES|QL query used as Agent Builder tool
   
2. **[`tools/search_kb_articles.md`](./tools/search_kb_articles.md)**  
   → kNN hybrid search configuration
   
3. **[`workflows/ticket_upsert_workflow.md`](./workflows/ticket_upsert_workflow.md)**  
   → Complete 7-step workflow with decision tree
   
4. **[`agent_instructions.md`](./agent_instructions.md)**  
   → System prompt with JSON schema and citation requirements
   
5. **[`connectors.md`](./connectors.md)**  
   → Gemini LLM connector and webhook connector configs

**Key Point**: These are NOT just docs—they map 1:1 to actual Agent Builder components

---

## Part 5: Optional - Developer Console (30 seconds)

### 5.1 API Call Direct

```bash
curl -X POST http://localhost:3000/api/run/ticket/ticket-1 \
  -H 'Content-Type: application/json'
```

**Response**:
```json
{
  "success": true,
  "ticketId": "ticket-1",
  "action": "updated",
  "draft": {
    "customerMessage": "...",
    "internalNotes": "...",
    "confidence": 0.92,
    "citations": [...]
  },
  "timing": {
    "total_ms": 1890,
    "kb_search_ms": 245,
    "llm_draft_ms": 1200
  }
}
```

---

## Key Proof Points for Judges

### ✅ Agent Builder Tool Usage
- ES|QL query file proving spike detection tool
- kNN search configs proving semantic retrieval tools
- Multi-step workflow orchestrating all tools

### ✅ LLM Integration
- Gemini connector configuration
- Structured JSON output with schema validation
- Fallback to deterministic draft if LLM fails

### ✅ Confidence Gating
- Citation requirement gate (≥2 sources)
- Confidence threshold gate (≥0.85)
- Three-path decision tree (auto/duplicate/review)

### ✅ Production-Ready
- Handles failures gracefully
- Validates LLM output before acting
- Logs all decisions for audit trail
- Works with Elastic Cloud and local

---

## Troubleshooting

### "Unknown index" Error
```bash
cd infra
./create-indices.sh
```

### No Data in Inbox
```bash
node data/generator/generate_synthetic.js
```

### Gemini Not Working
- LLM integration is **optional**
- Workflow falls back to deterministic drafting
- Key feature is Agent Builder orchestration, not LLM

### Cloud Connection Issues
```bash
# Verify .env.local
echo $ELASTIC_CLOUD_ID
echo $ELASTIC_API_KEY

# Test connection
curl -H "Authorization: ApiKey $ELASTIC_API_KEY" \
  "https://<your-cloud-url>/_cluster/health"
```

---

## Time Breakdown

- ⏱️ Setup verification: 30s
- ⏱️ Tool demos: 2 min
- ⏱️ Workflow execution: 2 min
- ⏱️ Artifacts review: 1 min
- **Total**: < 5 minutes

---

## Questions Judges Might Ask

### Q: "Is this actually using Agent Builder?"
**A**: Yes! Check the `agent_builder/` folder:
- ES|QL tool: [`tools/detect_error_spikes.esql`](./tools/detect_error_spikes.esql)
- kNN tools: [`tools/search_kb_articles.md`](./tools/search_kb_articles.md)
- Workflow: [`workflows/ticket_upsert_workflow.md`](./workflows/ticket_upsert_workflow.md)

These aren't hypothetical—they're the actual configurations used.

### Q: "How do we know the LLM is being called?"
**A**: 
1. Check browser network tab during triage (you'll see `/api/run/ticket/[id]` with slow response indicating LLM call)
2. Look at timing metrics in response (shows `llm_draft_ms`)
3. Try with and without `GEMINI_API_KEY` set—you'll see different draft quality

### Q: "What if the LLM makes a mistake?"
**A**: **Citation gate** prevents this:
- Requires 2+ citations from Elasticsearch data
- Requires confidence ≥ 0.85
- If either fails, tickets are flagged for human review instead of auto-updated

### Q: "Can we run this without Gemini?"
**A**: Yes! The system has a **deterministic fallback**:
- Uses rule-based drafting if LLM unavailable
- Still orchestrates all Agent Builder tools (ES|QL, kNN)
- Still applies confidence gating
- Just less intelligent in language generation

---

## Next Steps After Demo

1. ✅ Review [`IMPLEMENTATION.md`](../IMPLEMENTATION.md) for architecture
2. ✅ Check [`demo/ARCHITECTURE.md`](../demo/ARCHITECTURE.md) for system design
3. ✅ Browse code in [`app/api/run/ticket/[id]/route.ts`](../app/api/run/ticket/[id]/route.ts)
4. ✅ Try modifying [`agent_instructions.md`](./agent_instructions.md) to customize behavior
