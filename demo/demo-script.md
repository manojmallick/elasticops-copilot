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
- **NEW:** Click "🔥 Simulate Error Spike" button to generate 60 error logs instantly
- Click "🔍 Detect Error Spike" button
- Show how ES|QL detects error spikes in logs
- Point out newly created incident and ticket
- Click "View Details" on the incident
- Highlight:
  - One-click spike simulation for demos (no manual script needed)
  - Automatic detection from log patterns
  - Service, environment, error count
  - Duplicate prevention (won't create multiple incidents for same spike)
  - Link to timeline showing detection workflow steps

#### 2. Ticket Triage (60 seconds)
- From inbox, click on any open ticket
- Click "🤖 Run Triage" button
- Show the triage workflow execution
- After completion, see the success message with:
  - **NEW:** Visual confidence breakdown showing:
    - 📚 KB Articles score (normalized 0-100%)
    - 🔧 Resolutions score (normalized 0-100%)
    - 🎫 Similar Tickets score (normalized 0-100%)
    - Overall confidence with color coding (green ≥70%, yellow ≥40%, red <40%)
  - Auto-classified category/severity
  - Customer message draft with clickable citation links
  - Internal notes with structured breakdown
- Click "📊 View Timeline" to show:
  - Step-by-step workflow execution
  - Embedding generation
  - Classification logic
  - Deduplication check
  - KB article retrieval with scores
  - Resolution recommendations with scores
  - **NEW:** Confidence breakdown visualization with progress bars
  - Citations from multiple sources (≥2 indices required)

#### 3. Search Explorer (30 seconds)
- Navigate to http://localhost:3000/search
- Enter query: "authentication error"
- Toggle between "KB Articles" and "Tickets"
- **NEW:** Expand "▶ Why ranked here?" on a result to see:
  - **📝 BM25 Text Relevance**: Original score, rank, and RRF contribution
  - **🧠 Vector Similarity**: Semantic score, rank, and RRF contribution
  - **Final RRF Score**: Combined ranking using Reciprocal Rank Fusion (k=60)
- Highlight:
  - **NEW:** Separate BM25 and kNN queries merged with RRF algorithm
  - Formula: score = 1/(k+rank_bm25) + 1/(k+rank_vector)
  - Complete transparency into why each result ranked where it did
  - Results can rank high by text match, semantic similarity, or both

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
3. **RRF Hybrid Search**: Reciprocal Rank Fusion merging BM25 + kNN with explainability
4. **Bulk Operations**: Demo spike simulation with 60-error bulk insert
5. **Metrics Aggregation**: Real-time KPI calculation
6. **Timeline Audit**: Complete workflow observability with confidence metrics

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
