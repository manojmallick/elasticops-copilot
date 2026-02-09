# ElasticOps Copilot Demo Script

## 3-Minute Demo Flow

### Setup (30 seconds)
```bash
./demo/bootstrap.sh
# Wait for app to start at http://localhost:3000
```

### Demo Flow (2.5 minutes)

#### 1. Incident Detection (45 seconds)
- Navigate to http://localhost:3000/inbox
- Click "🔍 Detect Error Spike" button
- Show how ES|QL detects error spikes in logs
- Point out newly created incident and ticket
- Click "View Details" on the incident
- Highlight:
  - Automatic detection from log patterns
  - Service, environment, error count
  - Link to timeline showing detection workflow steps

#### 2. Ticket Triage (60 seconds)
- From inbox, click on any open ticket
- Click "🤖 Run Triage" button
- Show the triage workflow execution
- After completion, refresh to see:
  - Auto-classified category/severity
  - Customer message draft
  - Internal notes with confidence level
- Click "📊 View Timeline" to show:
  - Step-by-step workflow execution
  - Embedding generation
  - Classification logic
  - Deduplication check
  - KB article retrieval
  - Resolution recommendations
  - Citations from multiple sources

#### 3. Search Explorer (30 seconds)
- Navigate to http://localhost:3000/search
- Enter query: "authentication error"
- Toggle between "KB Articles" and "Tickets"
- Expand "Why ranked here?" on a result
- Highlight:
  - Hybrid search (BM25 + vector kNN)
  - Highlight snippets showing relevance
  - Explanation showing scoring breakdown

#### 4. Dashboard (15 seconds)
- Navigate to http://localhost:3000/dashboard
- Show key metrics:
  - Duplicates prevented
  - Time saved (minutes)
  - Mean Time to Acknowledge (MTTA)
  - Auto-triage count
- Point out category breakdown

### Talking Points

**Elasticsearch Usage:**
1. **ES|QL**: Spike detection with aggregations and filtering
2. **Vector Search**: kNN for semantic similarity (dedupe, KB retrieval)
3. **Hybrid Search**: Combined BM25 + kNN for best results
4. **Metrics Aggregation**: Real-time KPI calculation
5. **Timeline Audit**: Complete workflow observability

**Value Proposition:**
- Reduces MTTA from minutes to seconds
- Prevents duplicate tickets automatically
- Provides evidence-based recommendations
- Complete audit trail for every decision
- Scales support operations without proportional headcount

### One-Line Quick Demo

For judges short on time:
```bash
./demo/run-demo.sh
# Executes full workflow and prints all demo URLs
```

Then just open the URLs and show the results!
