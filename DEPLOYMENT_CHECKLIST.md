# Vercel Deployment Checklist

Quick checklist for deploying ElasticOps Copilot to Vercel with Agent Builder integration.

---

## Pre-Deployment (Local)

### Elastic Cloud Setup
- [ ] Elastic Cloud account created (https://cloud.elastic.co)
- [ ] Deployment created (14-day trial, Standard tier)
- [ ] Cloud ID copied from deployment details
- [ ] API key created with cluster privileges
- [ ] `.env.local` configured with cloud credentials
- [ ] Indices created (`./infra/create-indices.sh`)
- [ ] Data loaded (`node data/generator/generate_synthetic.js`)
- [ ] Verified data in Kibana Dev Tools (`GET _cat/indices?v`)

### GitHub Setup
- [ ] Repository initialized (`git init`)
- [ ] GitHub repo created (public, no README)
- [ ] Code pushed to GitHub (`git push origin main`)
- [ ] MIT license visible in repo

---

## Vercel Deployment

### Initial Deploy
- [ ] Logged into Vercel (https://vercel.com)
- [ ] Imported GitHub repo
- [ ] Framework detected as Next.js
- [ ] Initial deployment successful
- [ ] Deployment URL copied (e.g., `https://elasticops-copilot.vercel.app`)

### Environment Variables
Add in Vercel → Project → Settings → Environment Variables:

**Elastic Cloud (Required)**
- [ ] `ELASTIC_MODE=cloud`
- [ ] `ELASTIC_CLOUD_ID=<your_cloud_id>`
- [ ] `ELASTIC_API_KEY=<your_api_key>`

**Application (Required)**
- [ ] `EMBED_DIMS=384`
- [ ] `APP_URL=https://YOUR_VERCEL_DOMAIN.vercel.app`

**Webhook Security (Required)**
- [ ] `ELASTICOPS_WEBHOOK_SECRET=<random_32char_string>`
- [ ] Secret saved somewhere safe (needed for Kibana config)

**Action After Adding**:
- [ ] Redeployed from Vercel dashboard

---

## Testing Deployment

### App Functionality
- [ ] Home page loads (`https://YOUR_DOMAIN.vercel.app`)
- [ ] Inbox page shows tickets (`/inbox`)
- [ ] Search page works (`/search`)
- [ ] Dashboard shows metrics (`/dashboard`)
- [ ] No console errors in browser

### Webhook Endpoint
Test with curl:
```bash
curl -X POST "https://YOUR_DOMAIN.vercel.app/api/tools/create_or_update_ticket" \
  -H "Content-Type: application/json" \
  -H "x-elasticops-secret: YOUR_SECRET" \
  -d '{"subject":"Test","description":"Test ticket","category":"application","severity":"low","priority":"low","status":"new"}'
```

- [ ] Returns success response (200)
- [ ] Ticket visible in Kibana (`GET tickets/_search`)
- [ ] Ticket appears in app inbox

---

## Agent Builder Configuration

### Webhook Connector
**Path**: Kibana → Stack Management → Connectors → Create connector → Webhook

- [ ] Connector created with name: `ElasticOps Ticket Webhook`
- [ ] URL set to: `https://YOUR_DOMAIN.vercel.app/api/tools/create_or_update_ticket`
- [ ] Method: `POST`
- [ ] Headers include:
  - [ ] `Content-Type: application/json`
  - [ ] `x-elasticops-secret: YOUR_SECRET`
- [ ] Test connector succeeds
- [ ] Connector saved

### Workflow
**Path**: Kibana → Stack Management → Workflows → Create workflow

- [ ] Workflow created: `ticket_upsert_workflow`
- [ ] Step added: Run connector (ElasticOps Ticket Webhook)
- [ ] Body template includes all parameters:
  - [ ] `id`, `subject`, `description`, `category`, `severity`, `priority`, `status`, `incident_ref`, `channel`
- [ ] Workflow saved

### Agent Builder Tool
**Path**: Kibana → Agent Builder → Your Agent → Add Tool

- [ ] Tool type: Workflow
- [ ] Tool name: `create_or_update_ticket`
- [ ] Description added (explains when to use)
- [ ] Workflow selected: `ticket_upsert_workflow`
- [ ] Parameters documented in tool description
- [ ] Tool saved

---

## Testing Agent Builder

### Test Prompts
Try these in Agent Builder chat:

**Test 1 - Basic Creation**:
```
Create a ticket for a database timeout issue with high severity
```
- [ ] Agent uses `create_or_update_ticket` tool
- [ ] Ticket created successfully
- [ ] Ticket appears in app inbox

**Test 2 - With Incident**:
```
For incident INC-2024-001, create a critical ticket to track the API failure
```
- [ ] Ticket created with `incident_ref`
- [ ] Correct severity set

**Test 3 - Category Classification**:
```
Users can't log in. Create an authentication ticket.
```
- [ ] Category set to "authentication"
- [ ] Appropriate severity assigned

---

## Documentation Updates

### README.md
- [ ] Live demo URL added
- [ ] Deployment section added
- [ ] Link to `VERCEL_DEPLOYMENT.md`

### Screenshots for Submission
Take screenshots of:
- [ ] Vercel deployment success page
- [ ] Vercel environment variables (hide sensitive values)
- [ ] Kibana webhook connector configuration
- [ ] Agent Builder tool configuration
- [ ] Agent Builder creating a ticket (chat interface)
- [ ] Ticket appearing in app inbox
- [ ] App running on Vercel (all pages)

---

## Submission Preparation

### DevPost Submission
- [ ] Project title: `ElasticOps Copilot`
- [ ] Tagline prepared (< 60 chars)
- [ ] Description written (explains Agent Builder integration)
- [ ] Screenshots uploaded (7-8 images)
- [ ] Video demo link (optional but recommended)
- [ ] GitHub repo link added (public)
- [ ] Live demo link added (Vercel URL)
- [ ] Technologies listed:
  - [ ] Elasticsearch
  - [ ] ES|QL
  - [ ] Agent Builder
  - [ ] kNN Vector Search
  - [ ] Next.js
  - [ ] Vercel
  - [ ] TypeScript

### Proof Documents
In repo, ensure these exist:
- [ ] `agent_builder/` folder (9 files)
- [ ] `VERCEL_DEPLOYMENT.md` (complete guide)
- [ ] `agent_builder/AGENT_BUILDER_SETUP.md` (quick reference)
- [ ] `CLOUD_SETUP.md` (cloud setup guide)
- [ ] Screenshots in `demo/screenshots/`

---

## Final Validation

### Judge Experience Test
Imagine you're a judge. Verify:

**Option 1: Live Cloud Demo**
- [ ] Visit Vercel URL → Works without setup
- [ ] All features visible (inbox, search, dashboard)
- [ ] Data is populated and realistic
- [ ] No errors in browser console

**Option 2: Agent Builder Demo**
- [ ] Judge logs into your Elastic Cloud (provide guest credentials)
- [ ] Navigate to Agent Builder
- [ ] See `create_or_update_ticket` tool
- [ ] Test with a prompt
- [ ] Ticket appears in app

**Option 3: Local Fallback**
- [ ] `git clone` repo
- [ ] Run `./demo/bootstrap.sh`
- [ ] Wait < 5 minutes
- [ ] App works at `http://localhost:3000`

---

## Contingency Plans

### If Cloud Trial Expires
- [ ] Local Docker mode works (`./demo/bootstrap.sh`)
- [ ] README documents both modes
- [ ] Screenshots show cloud mode worked

### If Vercel Limits Hit
- [ ] Alternative: Deploy to Render/Railway
- [ ] Or: Run locally for live demo
- [ ] Screenshots prove it worked

### If Agent Builder Issues
- [ ] Have screenshots showing it working
- [ ] Have curl commands to demonstrate webhook
- [ ] Explain architecture even if can't demo live

---

## Success Criteria

✅ All boxes checked above  
✅ Live demo works reliably  
✅ Agent Builder integration proven  
✅ Documentation is comprehensive  
✅ Screenshots show all features  
✅ GitHub repo is public with MIT license  
✅ Submission meets all Devpost requirements  

---

## Timeline Estimate

- **Pre-Deployment**: 15 minutes (if cloud already set up)
- **Vercel Deploy**: 10 minutes (initial + env vars + redeploy)
- **Testing**: 10 minutes (webhook + app pages)
- **Agent Builder**: 10 minutes (connector + workflow + tool)
- **Testing Agent**: 5 minutes (3 test prompts)
- **Screenshots**: 10 minutes (7-8 screenshots)
- **Documentation**: 5 minutes (update README, verify guides)

**Total: ~65 minutes** (1 hour)

---

## Support

If issues arise:
- **Vercel**: Check function logs in dashboard
- **Elastic Cloud**: Verify credentials, check cluster health
- **Webhook**: Test with curl first, verify secret matches
- **Agent Builder**: Check workflow execution logs

---

**Status After Completion**: 🚀 Ready for Judging  
**Deployment Mode**: Cloud + Agent Builder  
**Fallback**: Local Docker (documented)

Good luck! 🎉
