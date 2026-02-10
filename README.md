# ElasticOps Copilot

**Multi-Agent Support Automation + Incident Awareness**

Intelligent support automation powered by Elasticsearch. Features automatic incident detection using ES|QL, AI-driven ticket triage with hybrid search, semantic deduplication, optional LLM integration (Google Gemini), and complete workflow observability with Agent Builder integration.

## 🌟 New Features

✅ **Dual Mode**: Works with Elastic Cloud OR local Docker  
✅ **Vercel Deployment**: Production-ready deployment with Agent Builder webhooks  
✅ **Agent Builder Integration**: Complete documentation and workflow examples  
✅ **Citation Gating**: Requires 2+ sources before auto-updating tickets  
✅ **Confidence Scoring**: Three-path decision logic (auto/duplicate/review)  

See [`CHANGELOG.md`](./CHANGELOG.md) for complete enhancement details.

## 🚀 Deployment Options

### Option 1: Live Cloud Demo
Production deployment on Vercel + Elastic Cloud with Agent Builder webhook integration:

- 🌐 **Live URL**: Accessible from anywhere
- 🤖 **Agent Builder**: Webhook connector allows agents to create tickets from Kibana
- 🔒 **Secure**: Webhook secret verification
- ⚡ **Fast**: Serverless functions, global CDN

**Quick Deploy**: Follow [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md) (~30 min setup)  
**Quick Setup**: Follow [`agent_builder/AGENT_BUILDER_SETUP.md`](./agent_builder/AGENT_BUILDER_SETUP.md) (~10 min config)

### Option 2: Local Development
Use Docker Compose for local development:

```bash
./demo/bootstrap.sh
```

Opens: http://localhost:3000

See [`CLOUD_SETUP.md`](./CLOUD_SETUP.md) for cloud-only setup without deployment.

## ⚡ Quick Start

### Option 1: Local Docker (Original)
```bash
./demo/bootstrap.sh
```

### Option 2: Elastic Cloud
```bash
# 1. Copy and edit environment file
cp .env.example .env.local
# Edit .env.local with your Cloud ID and API key

# 2. Run setup
./demo/bootstrap.sh
```

See [`CLOUD_SETUP.md`](./CLOUD_SETUP.md) for detailed cloud setup instructions.

## 🤖 Agent Builder Integration

This project includes comprehensive **Agent Builder** configuration in the [`agent_builder/`](./agent_builder/) folder:

- **[ES|QL Tool](./agent_builder/tools/detect_error_spikes.esql)** - Error spike detection query
- **[kNN Search Tools](./agent_builder/tools/)** - KB articles, tickets, resolutions
- **[Multi-Step Workflow](./agent_builder/workflows/ticket_upsert_workflow.md)** - 7-step triage process
- **[Agent Instructions](./agent_builder/agent_instructions.md)** - System prompt with JSON schema
- **[Connectors](./agent_builder/connectors.md)** - Gemini LLM + webhook configs
- **[Demo Script](./agent_builder/demo_steps.md)** - 5-minute walkthrough

## 🎯 One-Click Demo

```bash
./demo/run-demo.sh
```

Automatically runs:
1. Spike detection → creates incident + ticket
2. Selects an open ticket → runs triage workflow
3. Prints all demo URLs

Then visit the URLs to see the results!

## 🏗️ Architecture

```
┌─────────────┐    ES|QL      ┌──────────────┐
│  logs-app   │──────────────→│   Incident   │
│  (errors)   │               │   Detection  │
└─────────────┘               └──────────────┘
                                     │
                                     ↓
┌─────────────┐              ┌──────────────┐
│ kb-articles │────┐         │    Ticket    │
│ resolutions │────┼────────→│    Triage    │
│  tickets    │────┘  Hybrid │    Agent     │
└─────────────┘      Search  └──────────────┘
                                     │
                                     ↓
                              ┌──────────────┐
                              │  ops-runs    │
                              │  ops-metrics │
                              └──────────────┘
```

See [demo/architecture.mmd](demo/architecture.mmd) for full diagram.

**Generate PNG:**
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i demo/architecture.mmd -o demo/architecture.png
```

## 🔍 Where Elasticsearch is Used

### 1. **ES|QL for Spike Detection**
Detects error spikes in real-time:
```sql
FROM logs-app
| WHERE @timestamp >= NOW() - 5 minutes
| WHERE level == "ERROR"
| STATS errors = COUNT(*) BY service, env
| WHERE errors >= 40
```

### 2. **Vector Search (kNN)**
- **Semantic deduplication**: Find similar tickets before creating duplicates
- **Resolution retrieval**: Match incidents to historical fixes
- **KB recommendations**: Surface relevant articles

Uses deterministic 384-dim embeddings (SHA-256 based) for reproducibility.

### 3. **Hybrid Search (BM25 + kNN)**
Combines text matching and semantic similarity:
- BM25 for keyword relevance
- kNN for semantic understanding
- Weighted scoring for best results

### 4. **Metrics Aggregation**
Real-time KPI calculation:
- Time saved (auto-triage vs manual)
- Duplicates prevented
- Mean Time to Acknowledge (MTTA)
- Category breakdowns

### 5. **Audit & Timeline**
Complete workflow observability in `ops-runs`:
- Step-by-step execution traces
- Citations and evidence
- Performance metrics
- Error tracking

## 📊 Demo Flow (3 Minutes)

### 🔥 Generate Test Spike (Optional - 30s)
To trigger incident detection, generate error logs:
```bash
node demo/generate-error-spike.js
```
This inserts 50 ERROR logs into `logs-app` (threshold is 40 errors/5min).

**See full testing guide**: [`demo/TESTING_SPIKE_DETECTION.md`](./demo/TESTING_SPIKE_DETECTION.md)

### 1. Incident Detection (45s)
- Go to `/inbox`
- Click "Detect Error Spike"
- See auto-created incident + ticket
- View timeline showing detection steps

### 2. Ticket Triage (60s)
- Open any ticket
- Click "Run Triage"
- Watch auto-classification
- See KB + resolution recommendations
- Review citations and confidence score
- View complete timeline

### 3. Search Explorer (30s)
- Go to `/search`
- Search: "authentication error"
- Toggle KB vs Tickets mode
- Expand "Why ranked here?" to see scoring

### 4. Dashboard (15s)
- View KPIs (duplicates, time saved, MTTA)
- Category breakdown

## 📁 Repository Structure

```
elasticops-copilot/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout + nav
│   ├── globals.css              # Styles
│   ├── inbox/page.tsx           # Incidents + tickets
│   ├── ticket/[id]/page.tsx     # Ticket detail
│   ├── incident/[id]/page.tsx   # Incident detail
│   ├── timeline/[id]/page.tsx   # Workflow timeline
│   ├── search/page.tsx          # Search explorer
│   ├── dashboard/page.tsx       # Metrics dashboard
│   └── api/                     # API routes
│       ├── tickets/route.ts
│       ├── incidents/route.ts
│       ├── search/route.ts
│       ├── metrics/route.ts
│       ├── timeline/[id]/route.ts
│       ├── run/
│       │   ├── ticket/[id]/route.ts      # Triage workflow
│       │   └── incident/detect/route.ts   # Spike detection
│       └── tools/
│           └── create_or_update_ticket/route.ts
├── lib/                         # Core utilities
│   ├── elastic.ts              # ES client
│   ├── embed.ts                # Deterministic embeddings
│   ├── esql.ts                 # ES|QL queries
│   └── searchTemplates.ts      # Hybrid search builders
├── infra/                       # Infrastructure
│   ├── docker-compose.yml
│   ├── create-indices.sh
│   └── mappings/               # Index mappings (JSON)
│       ├── kb-articles.json
│       ├── tickets.json
│       ├── resolutions.json
│       ├── logs-app.json
│       ├── incidents.json
│       ├── ops-metrics.json
│       └── ops-runs.json
├── data/generator/              # Synthetic data
│   └── generate_synthetic.js   # Creates 200 KB, 300 res, 2K tickets, 10K logs
└── demo/                        # Demo materials
    ├── bootstrap.sh            # One-command setup
    ├── run-demo.sh             # Automated demo execution
    ├── demo-script.md          # 3-minute walkthrough
    ├── architecture.mmd        # Mermaid diagram
    └── screenshots/            # (empty, add as needed)
```

## 🛠️ Tech Stack

- **Next.js 14** (App Router)
- **Elasticsearch 8.11** (no security for easy demo)
- **Node.js 18+**
- **@elastic/elasticsearch** client
- **Deterministic embeddings** (no external APIs)

## 🧪 Data

All data is synthetic and generated deterministically:
- **200 KB articles** across 6 categories
- **300 resolution playbooks** with success rates
- **2000 tickets** (100 open for demos)
- **10k logs** with 3 intentional error spikes

No personal or confidential data used.

## 🐛 Troubleshooting

### Elasticsearch not ready
```bash
# Check status
curl http://localhost:9200/_cluster/health

# Wait longer or restart
cd infra && docker-compose restart elasticsearch
```

### Ports in use
```bash
# Stop conflicting services
lsof -ti:9200 | xargs kill -9  # ES
lsof -ti:3000 | xargs kill -9  # Next.js
```

### Docker issues
```bash
# Clean restart
cd infra
docker-compose down -v
docker-compose up -d
```

### Missing indices
```bash
./infra/create-indices.sh
node data/generator/generate_synthetic.js
```

## 📦 Manual Setup

If you prefer step-by-step:

```bash
# 1. Start infrastructure
cd infra
docker-compose up -d

# 2. Create indices
./create-indices.sh

# 3. Generate data
cd ..
node data/generator/generate_synthetic.js

# 4. Install deps
npm install

# 5. Run app
npm run dev
```

## 🎓 Key Features for Judges

✅ **No External Dependencies**: Everything runs locally (or in cloud)  
✅ **Dual Mode Support**: Works with Elastic Cloud OR local Docker  
✅ **Agent Builder Proof**: Complete artifacts folder showing ES|QL tools, kNN search, multi-step workflows  
✅ **LLM Integration**: Optional Google Gemini with citation gating and confidence scoring  
✅ **Reproducible Demo**: Deterministic embeddings, synthetic data  
✅ **Judge-Friendly**: One command to full demo in < 5 min  
✅ **Real Elasticsearch**: ES|QL, kNN, hybrid search, aggregations  
✅ **Production Patterns**: Metrics, audit trails, workflow orchestration, confidence gates  
✅ **Clean Code**: Well-structured, commented, lint-friendly  

## 📚 Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** - All changes for cloud + Agent Builder enhancement
- **[CLOUD_SETUP.md](./CLOUD_SETUP.md)** - Complete Elastic Cloud setup guide
- **[agent_builder/README.md](./agent_builder/README.md)** - Agent Builder artifacts overview
- **[agent_builder/demo_steps.md](./agent_builder/demo_steps.md)** - 5-minute judge demo script
- **[demo/ARCHITECTURE.md](./demo/ARCHITECTURE.md)** - System design details  

## 📝 Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
```

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

Built for Elasticsearch hackathon. Uses Elasticsearch for all search, analytics, and storage needs. No AI APIs required - embeddings generated deterministically for demo consistency.

---

**Quick Links:**
- 📋 Inbox: http://localhost:3000/inbox
- 🔍 Search: http://localhost:3000/search
- 📊 Dashboard: http://localhost:3000/dashboard
- 🔧 Kibana: http://localhost:5601
