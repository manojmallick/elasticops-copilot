# Agent Builder Artifacts

This folder contains proof of **Elastic Agent Builder** usage for the ElasticOps Copilot hackathon project.

## What is Agent Builder?

Agent Builder is Elastic's no-code/low-code platform for creating AI agents that can:
- Search and reason over Elasticsearch data
- Execute actions via API connectors
- Use ES|QL queries as tools
- Chain multiple retrieval steps for context gathering
- Call external LLMs (like Gemini) for drafting responses

## What We Used

### 1. **Tools** (Retrieval & Detection)
- `detect_error_spikes.esql` - ES|QL query to find error spikes in logs
- `search_kb_articles` - Semantic search over knowledge base with kNN
- `search_tickets` - Find duplicate/related tickets
- `search_resolutions` - Retrieve past resolution notes

### 2. **Connectors**
- **Gemini Connector** - Calls Google Gemini API for LLM-powered drafting
- **Webhook Connector** - Creates/updates tickets via POST webhook

### 3. **Workflows**
- `ticket_upsert_workflow` - Multi-step triage workflow:
  1. Detect error spikes (ES|QL)
  2. Search KB (kNN hybrid)
  3. Search duplicates (vector similarity)
  4. Search resolutions (semantic)
  5. Call Gemini with context
  6. Parse LLM JSON output
  7. Update ticket via webhook (if confident + cited)

### 4. **Agent Instructions**
The system prompt defines:
- Role (support automation agent)
- Response format (JSON with customerMessage, internalNotes, confidence)
- Citation requirements (must cite 2+ sources)
- Confidence scoring (0.0-1.0)

## File Structure

```
agent_builder/
├── README.md                      # This file
├── agent_instructions.md           # System prompt for the agent
├── connectors.md                   # Gemini + Webhook setup
├── tools/
│   ├── detect_error_spikes.esql   # ES|QL tool for spike detection
│   ├── search_kb_articles.md       # KB semantic search
│   ├── search_tickets.md           # Duplicate detection
│   └── search_resolutions.md       # Resolution retrieval
├── workflows/
│   └── ticket_upsert_workflow.md   # Ticket triage workflow
└── demo_steps.md                   # Judge demo script
```

## Verification

These artifacts prove Agent Builder was used by showing:
1. **ES|QL Tool Definition** - The `.esql` file with actual query
2. **Tool Configurations** - JSON specs for kNN search tools
3. **Workflow Steps** - Step-by-step retrieval → reasoning → action
4. **Connector Setup** - How Gemini and webhooks were configured
5. **Agent Instructions** - The exact prompt engineering used

## Implementation

The Agent Builder workflow is implemented in code at:
- API: [`app/api/run/ticket/[id]/route.ts`](../app/api/run/ticket/[id]/route.ts)
- LLM Integration: [`lib/llm_gemini.ts`](../lib/llm_gemini.ts)
- Output Parsing: [`lib/agentOutput.ts`](../lib/agentOutput.ts)

## Demo

See [`demo_steps.md`](./demo_steps.md) for a complete judge walkthrough showing:
- How Agent Builder tools retrieve context
- How Gemini drafts responses with citations
- How confidence gates prevent bad auto-updates
