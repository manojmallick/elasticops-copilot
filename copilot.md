You are my implementation assistant. Build the full repository for a hackathon project called:

ElasticOps Copilot — Multi-Agent Support Automation + Incident Awareness

GOAL
- One-command setup for judges: clone → run → see demo in < 5 minutes.
- Everything runs locally: Elasticsearch + Kibana + Next.js.
- Data is synthetic (no personal/confidential data).
- Core flows:
  (1) Incident → Ticket: ES|QL spike detection on logs-app → create incident → retrieve resolutions → create ticket → record metrics + ops-runs timeline.
  (2) Ticket triage: classify → dedupe via vector similarity → hybrid retrieve KB + resolutions → draft summary w/ citations → update ticket → record metrics + ops-runs timeline.

HARD REQUIREMENTS (Do Not Skip)
1) Infrastructure
   - docker-compose for Elasticsearch + Kibana
   - security disabled for hackathon ease
   - scripts to create indices from mappings
2) Indices/mappings (JSON files)
   - kb-articles, tickets, resolutions, logs-app, incidents, ops-metrics, ops-runs
   - all vectors use dense_vector dims=384, cosine similarity, index=true
3) Synthetic data generator (Node)
   - Creates and indexes:
     - 200 KB articles
     - 2000 tickets
     - 300 resolution cards
     - 10k logs over last 2 hours with 3 spikes
   - Uses deterministic pseudo-embeddings (sha256-based) to keep demo reproducible.
   - Uses Elasticsearch bulk API, handles batching and errors.
4) Next.js App (App Router, Node API routes)
   Pages:
   - /inbox: shows incidents + tickets, button to detect spike (incident->ticket)
   - /ticket/[id]: ticket detail + Run triage button + link to timeline
   - /incident/[id]: incident detail + link to timeline
   - /timeline/[id]: timeline stepper (not raw JSON) showing steps and citations
   - /search: search explorer with Hybrid mode toggle (KB vs Tickets) and "Why ranked?" panel showing highlights + explanation (collapsed view ok)
   - /dashboard: KPIs from ops-metrics aggregated over last 7 days
   API routes:
   - GET /api/tickets, GET /api/tickets/[id]
   - GET /api/incidents, GET /api/incidents/[id]
   - POST /api/search
   - GET /api/metrics
   - GET /api/timeline/[id] (latest ops-run by ref_id)
   - POST /api/run/ticket/[id] (runs ticket triage workflow)
   - POST /api/run/incident/detect (runs ES|QL spike detector → create incident → create ticket)
   - POST /api/tools/create_or_update_ticket (custom tool that creates/updates tickets + writes metrics)
5) Demo scripts
   - demo/bootstrap.sh: starts docker, creates indices, loads synthetic data, installs deps, runs app
   - demo/run-demo.sh: runs detect spike + selects an open ticket + runs triage, then prints links for demo pages
6) README
   - judge-optimized: 30-second skim friendly
   - includes architecture diagram image path demo/architecture.png
   - includes one-command quickstart and one-click demo
   - clearly lists "Where Elasticsearch is used" (hybrid, vectors, ES|QL, metrics)
7) Repo hygiene
   - LICENSE file (MIT)
   - .env.example
   - package.json scripts: dev/build/start
   - consistent folder structure
   - no third-party logos/branding in UI copy
   - no hard dependency on external APIs

TECH STACK
- Next.js 14 (App Router)
- Node 18+
- @elastic/elasticsearch JS client
- No auth, no DB besides Elasticsearch.

ENV
- .env.local uses:
  ELASTIC_URL=http://localhost:9200
  EMBED_DIMS=384
  APP_URL=http://localhost:3000

REPO STRUCTURE (Must Match)
elasticops-copilot/
  app/
    layout.tsx
    inbox/page.tsx
    ticket/[id]/page.tsx
    incident/[id]/page.tsx
    timeline/[id]/page.tsx
    search/page.tsx
    dashboard/page.tsx
    api/
      tickets/route.ts
      tickets/[id]/route.ts
      incidents/route.ts
      incidents/[id]/route.ts
      search/route.ts
      metrics/route.ts
      timeline/[id]/route.ts
      run/ticket/[id]/route.ts
      run/incident/detect/route.ts
      tools/create_or_update_ticket/route.ts
  lib/
    elastic.ts
    embed.ts
    searchTemplates.ts
    esql.ts
  infra/
    docker-compose.yml
    create-indices.sh
    mappings/
      kb-articles.json
      tickets.json
      resolutions.json
      logs-app.json
      incidents.json
      ops-metrics.json
  data/
    generator/
      generate_synthetic.js
  demo/
    architecture.mmd
    architecture.png (generate instructions; placeholder ok)
    run-demo.sh
    bootstrap.sh
    demo-script.md
    screenshots/ (empty folder ok)
  .env.example
  LICENSE
  README.md
  package.json

IMPLEMENTATION DETAILS (Exact Behaviors)

A) Embeddings
- Use deterministic pseudo-embedding function in lib/embed.ts (sha256-based) identical to generator.
- Store embeddings back into ticket docs after triage; store in incidents as well.

B) Ticket Triage Workflow (POST /api/run/ticket/:id)
Steps to store in ops-runs.steps:
- embed: dims
- classify: category, severity, priority
- dedupe: isDuplicate boolean, similarTickets[] (max 5)
- retrieve_kb: top KB ids + highlight snippets
- retrieve_resolutions: top resolution ids + brief fields
- draft: customerMessage + internalNotes + citations[]
- act: updatedTicket id
Rules:
- ALWAYS perform dedupe before drafting.
- citations array must include at least 2 sources if found:
  - kb-articles:<id>, resolutions:<id>, tickets:<id>
- If fewer than 2 sources found, set confidence=low and do not update ticket (or update only with "needs_human" flag). This is important: avoid acting without evidence.
- If duplicate detected, write metrics:
  - duplicates_prevented += 1
  - time_saved_minutes += 15

C) Incident → Ticket (POST /api/run/incident/detect)
- Run ES|QL spike query on logs-app in last 5 minutes:
  FROM logs-app
  | WHERE @timestamp >= NOW() - 5 minutes
  | WHERE level == "ERROR"
  | STATS errors = COUNT(*) BY service, env
  | WHERE errors >= 40
  | SORT errors DESC
- If none found: return {found:false,message:"No spikes..."}
- If found:
  - create incident doc in incidents with embedding from summary
  - retrieve top resolutions by knn using incident embedding
  - create ticket in tickets (category="incident", channel="system", status="open")
  - write metric mtta_seconds=30
  - write ops-run timeline steps
Return incident_id and ticket_id

D) Search Explorer (POST /api/search)
- If mode=kb: run hybrid query (BM25 + knn as should)
- If mode=tickets: run ticketDedupeSearch (knn + filters)
- Return hits[] including:
  - id
  - score
  - highlight
  - explanation (use _explanation if available)
  - source (some fields)

E) Timeline UI
- Render a vertical stepper (simple HTML/CSS ok)
- Each step shows:
  - step name
  - key outputs
  - citations (if present)
- Must not be raw JSON blob.

F) Dashboard (/dashboard)
- Fetch /api/metrics
- Show totals: duplicates_prevented, time_saved_minutes, mtta_seconds
- Also show "Top categories" optionally by calling ES|QL query endpoint or another route (optional).

G) Scripts
- infra/create-indices.sh:
  - waits for ES
  - deletes existing indices
  - creates each index with correct mapping file
- demo/bootstrap.sh:
  - docker compose up -d
  - wait
  - chmod +x infra/create-indices.sh && run it
  - run node data/generator/generate_synthetic.js
  - npm install
  - npm run dev
- demo/run-demo.sh:
  - calls /api/run/incident/detect
  - selects latest open ticket from /api/tickets
  - calls /api/run/ticket/:id
  - prints URLs (inbox, ticket, timeline, search, dashboard)
All scripts must be executable and use set -euo pipefail.

H) README and docs
- README must include:
  - one-paragraph summary
  - quickstart commands
  - one-click demo commands
  - demo flow timeline (3 mins)
  - Where Elasticsearch is used (hybrid, vectors, ES|QL, metrics, audit)
  - Repo guide
- Include demo/demo-script.md with 3-minute outline
- Include demo/architecture.mmd diagram, and instructions to generate PNG via mmdc.

QUALITY BAR / ACCEPTANCE CRITERIA
- After running:
  ./demo/bootstrap.sh
  I can open http://localhost:3000/inbox and see tickets/incidents.
- Running:
  ./demo/run-demo.sh
  creates a new incident+ticket if spike exists, runs triage, and metrics update.
- /search returns results and includes highlight + explanation.
- /timeline/[id] shows a stepper with citations.
- No external APIs required; everything local.

NOW DO THIS:
1) Create all files as per structure.
2) Implement all routes, libs, scripts, and pages as described.
3) Ensure code compiles and lints reasonably.
4) Add small inline comments where helpful.
5) Do NOT invent external services or branding.

When done, output:
- A brief checklist of what you created
- Any manual steps needed (should be none beyond running bootstrap)
- Common troubleshooting tips (ES not ready, ports in use)
