# ElasticOps Copilot — Demo Script

## Prerequisites
- App running at http://localhost:3000 (via `./demo/bootstrap.sh` or `npm run dev`)

---

## 3-Minute Demo Walkthrough

### 1. Incident Detection *(45s)*

1. Navigate to http://localhost:3000/inbox
2. Click **"🔥 Simulate Error Spike"** to generate 60 error logs
3. Click **"🔍 Detect Error Spike"** — ES|QL detects the spike
4. Point out newly created **incident + ticket**
5. Click into the incident — show service, env, error count

**Key talking point:** ES|QL query runs `FROM logs-app | WHERE level == "ERROR" | STATS errors = COUNT(*) BY service, env | WHERE errors >= 40`

### 2. Ticket Triage *(60s)*

1. From inbox, click on any open ticket
2. Click **"🤖 Run Triage"**
3. After completion, show:
   - **Confidence breakdown**: KB score, Resolution score, Similar Tickets score
   - **Auto-classified** category, severity, priority
   - **Customer message draft** with clickable citation links
   - **Internal notes** with structured breakdown
4. Click **"📊 View Timeline"** to show 7-step workflow execution

**Key talking point:** Citation gate requires ≥2 sources. Low confidence → `NEEDS_HUMAN` fallback.

### 3. Search Explorer *(30s)*

1. Navigate to http://localhost:3000/search
2. Search: `"authentication error"`
3. Toggle between **KB Articles** and **Tickets**
4. Expand **"▶ Why ranked here?"** to see:
   - BM25 text relevance score
   - kNN vector similarity score
   - Final RRF score: `1/(k+rank_bm25) + 1/(k+rank_vector)`

**Key talking point:** Full RRF transparency — judges can see exactly why each result ranked where it did.

### 4. Dashboard *(15s)*

1. Navigate to http://localhost:3000/dashboard
2. Show KPIs: duplicates prevented, time saved, MTTA, auto-triage count

---

## Quick One-Liner

For judges short on time:
```bash
./demo/run-demo.sh
# Runs the full workflow and prints all demo URLs
```

---

## Talking Points Summary

| Feature | Elasticsearch Usage |
|---|---|
| Spike detection | ES|QL aggregations |
| Deduplication | kNN cosine similarity (>0.95) |
| KB retrieval | BM25 + kNN hybrid search |
| Search explorer | Reciprocal Rank Fusion |
| Confidence scoring | Weighted scoring model |
| Audit trail | ops-runs + ops-metrics indices |
