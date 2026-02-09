# Vercel Deployment Guide

Complete guide to deploy **ElasticOps Copilot** to Vercel with Agent Builder webhook integration.

---

## Overview

This deployment enables:
- ✅ **Next.js app** hosted on Vercel (serverless)
- ✅ **Elastic Cloud** for data storage (14-day free trial)
- ✅ **Agent Builder webhook** to create/update tickets from Kibana
- ✅ **Local fallback** (Docker) for when cloud expires

---

## Prerequisites

1. ✅ **Elastic Cloud** account with deployment created
   - Sign up: https://cloud.elastic.co/registration
   - Create deployment (Standard tier, 14-day trial)
   - Copy Cloud ID and create API key

2. ✅ **GitHub** account
   - Repo must be **public** (Devpost requirement)
   - MIT license included ✅

3. ✅ **Vercel** account
   - Free tier works perfectly
   - Sign up: https://vercel.com/signup

---

## Step 1: Prepare Elastic Cloud

### 1.1 Get Cloud Credentials

**Cloud ID:**
1. Go to Elastic Cloud Console → Your Deployment
2. Click "Manage" → "Cloud ID"
3. Copy the Cloud ID (format: `name:base64string`)

**API Key:**
1. Open Kibana → Stack Management → API Keys
2. Click "Create API key"
3. Name: `elasticops-vercel`
4. Privileges: **All** (or cluster privileges)
5. Copy the **encoded** API key

### 1.2 Create Indices and Load Data

Run locally first to populate your cloud cluster:

```bash
# In your local repo
cp .env.example .env.local

# Edit .env.local:
ELASTIC_MODE=cloud
ELASTIC_CLOUD_ID=your_cloud_id_here
ELASTIC_API_KEY=your_api_key_here
```

Then create indices and load data:

```bash
# Create indices
./infra/create-indices.sh

# Generate synthetic data (200 KB + 300 resolutions + 2K tickets + 10K logs)
node data/generator/generate_synthetic.js
```

**Verify in Kibana**: Open Dev Tools and run:
```
GET _cat/indices?v
```

You should see ~12,500 documents across 7 indices.

---

## Step 2: Push to GitHub

### 2.1 Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit - ElasticOps Copilot"
```

### 2.2 Create GitHub Repo

1. Go to https://github.com/new
2. Name: `elasticops-copilot`
3. **Visibility**: Public ⚠️ (Devpost requirement)
4. **Do NOT** initialize with README (you already have one)

### 2.3 Push Code

```bash
git remote add origin https://github.com/YOUR_USERNAME/elasticops-copilot.git
git branch -M main
git push -u origin main
```

✅ **Verify**: Your repo is public and shows the MIT license badge.

---

## Step 3: Deploy to Vercel

### 3.1 Create Vercel Project

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repo: `elasticops-copilot`
4. Framework Preset: **Next.js** (auto-detected)
5. Root Directory: `./` (default)
6. Click **"Deploy"**

⏳ Wait 2-3 minutes for initial deployment.

### 3.2 Configure Environment Variables

After deployment, go to:
**Project → Settings → Environment Variables**

Add these variables:

#### Elastic Cloud (Required)
```
ELASTIC_MODE=cloud
ELASTIC_CLOUD_ID=your_cloud_id_here
ELASTIC_API_KEY=your_api_key_here
```

#### Application Config (Required)
```
EMBED_DIMS=384
APP_URL=https://YOUR_VERCEL_DOMAIN.vercel.app
```

#### Webhook Security (Required for Agent Builder)
```
ELASTICOPS_WEBHOOK_SECRET=YOUR_RANDOM_SECRET_123456
```

> **Important**: Generate a random secret string (e.g., `openssl rand -hex 32`)

### 3.3 Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click the **three dots** on latest deployment
3. Click **"Redeploy"**

✅ All environment variables are now active!

---

## Step 4: Test Your Deployment

### 4.1 Verify App Works

Open your Vercel URL: `https://YOUR_VERCEL_DOMAIN.vercel.app`

You should see:
- ✅ Home page loads
- ✅ Navigate to `/inbox` → shows tickets
- ✅ Navigate to `/search` → search works
- ✅ Navigate to `/dashboard` → metrics display

### 4.2 Test Webhook Endpoint

```bash
# Replace with your actual values
VERCEL_URL="https://YOUR_VERCEL_DOMAIN.vercel.app"
WEBHOOK_SECRET="YOUR_RANDOM_SECRET_123456"

curl -X POST "$VERCEL_URL/api/tools/create_or_update_ticket" \
  -H "Content-Type: application/json" \
  -H "x-elasticops-secret: $WEBHOOK_SECRET" \
  -d '{
    "subject": "Test ticket from webhook",
    "description": "Testing Agent Builder integration",
    "category": "network",
    "severity": "medium",
    "priority": "medium",
    "status": "new",
    "channel": "agent-builder"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "action": "created",
  "id": "ticket-xxx",
  "ticket": { ... }
}
```

### 4.3 Verify Ticket in Kibana

Open Kibana Dev Tools:
```
GET tickets/_search
{
  "query": {
    "match": {
      "channel": "agent-builder"
    }
  }
}
```

You should see your test ticket!

---

## Step 5: Configure Agent Builder in Kibana

### 5.1 Create Webhook Connector

1. Kibana → **Stack Management** → **Connectors**
2. Click **"Create connector"**
3. Select **"Webhook"**

**Configuration**:
- **Name**: `ElasticOps Ticket Webhook`
- **URL**: `https://YOUR_VERCEL_DOMAIN.vercel.app/api/tools/create_or_update_ticket`
- **Method**: `POST`
- **Headers**:
  ```json
  {
    "Content-Type": "application/json",
    "x-elasticops-secret": "YOUR_RANDOM_SECRET_123456"
  }
  ```

4. Click **"Save"**

### 5.2 Test Connector

Click **"Test"** button with sample payload:
```json
{
  "subject": "Test from Kibana connector",
  "description": "Verifying webhook works",
  "category": "application",
  "severity": "low",
  "priority": "low",
  "status": "new"
}
```

✅ Should return success!

### 5.3 Create Workflow

1. Kibana → **Stack Management** → **Workflows** → **Create workflow**
2. **Name**: `ticket_upsert_workflow`
3. **Description**: `Create or update tickets via webhook`

**Add Step**:
- **Type**: Run connector
- **Connector**: Select `ElasticOps Ticket Webhook`
- **Body**: Use workflow variables

Example body template:
```json
{
  "subject": "{{subject}}",
  "description": "{{description}}",
  "category": "{{category}}",
  "severity": "{{severity}}",
  "priority": "{{priority}}",
  "status": "{{status}}",
  "incident_ref": "{{incident_ref}}"
}
```

4. **Save workflow**

### 5.4 Create Agent Builder Tool

1. Kibana → **Agent Builder** → Your Agent
2. Click **"Add Tool"**
3. **Tool Type**: Workflow
4. **Name**: `create_or_update_ticket`
5. **Description**: `Create or update support tickets with incident data`
6. **Workflow**: Select `ticket_upsert_workflow`
7. **Parameters**:
   - `subject` (string, required)
   - `description` (string, required)
   - `category` (string, optional)
   - `severity` (string, optional)
   - `priority` (string, optional)
   - `status` (string, optional)
   - `incident_ref` (string, optional)

8. **Save tool**

### 5.5 Test Agent Tool

In Agent Builder, try this prompt:

```
Create a ticket for a database connection timeout issue with high severity.
```

The agent should:
1. Use the `create_or_update_ticket` tool
2. Call your Vercel webhook
3. Ticket appears in your Elastic Cloud cluster
4. You can see it at: `https://YOUR_VERCEL_DOMAIN.vercel.app/inbox`

✅ **Agent Builder is now integrated with your app!**

---

## Step 6: Add Local Fallback (Safety Net)

### Update README.md

Add this section to show judges both deployment options:

```markdown
## Deployment Options

### Option 1: Live Cloud Demo (Preferred)
🌐 **Live demo**: https://YOUR_VERCEL_DOMAIN.vercel.app

- Hosted on Vercel (serverless)
- Data on Elastic Cloud
- Agent Builder webhook integration active

### Option 2: Local Fallback (Docker)
If cloud trial expires or for offline demos:

\`\`\`bash
# Uses local Docker (Elasticsearch + Kibana)
./demo/bootstrap.sh
\`\`\`

Opens: http://localhost:3000
```

This removes the risk of your cloud trial expiring during judging!

---

## Troubleshooting

### Issue 1: "Unauthorized" on Webhook

**Symptom**: Agent Builder gets 401 error

**Fix**:
1. Verify `ELASTICOPS_WEBHOOK_SECRET` matches in:
   - Vercel environment variables
   - Kibana webhook connector headers
2. Check header name is exactly: `x-elasticops-secret`

### Issue 2: Empty Data in App

**Symptom**: Inbox shows no tickets

**Fix**:
1. Verify indices exist in Kibana:
   ```
   GET _cat/indices?v
   ```
2. Re-run data generator:
   ```bash
   node data/generator/generate_synthetic.js
   ```

### Issue 3: Cloud Connection Timeout

**Symptom**: Vercel logs show "ETIMEDOUT"

**Fix**:
1. Check `ELASTIC_CLOUD_ID` is correct (no typos)
2. Verify `ELASTIC_API_KEY` hasn't expired
3. Test connection locally first:
   ```bash
   curl -H "Authorization: ApiKey $ELASTIC_API_KEY" \
     "https://YOUR_CLOUD_URL:443/_cluster/health"
   ```

### Issue 4: Build Fails on Vercel

**Symptom**: Deployment fails with TypeScript errors

**Fix**:
1. Check `next.config.js` has:
   ```js
   typescript: {
     ignoreBuildErrors: false // or true if needed
   }
   ```
2. Run build locally first:
   ```bash
   npm run build
   ```

---

## Security Best Practices

✅ **DO:**
- Use API keys (not passwords)
- Set webhook secret for connector auth
- Rotate credentials regularly
- Use HTTPS only (Vercel enforces this)

❌ **DON'T:**
- Commit `.env.local` to git (already in `.gitignore`)
- Share webhook secret publicly
- Use same API key for dev/prod

---

## Cost Optimization

### Vercel (Free)
- ✅ Free tier includes:
  - 100 GB bandwidth/month
  - Serverless functions
  - Automatic HTTPS

### Elastic Cloud (14-day Trial)
- ✅ Trial includes:
  - 2 GB RAM
  - 8 GB storage
  - All features unlocked

**After Trial**:
- Standard tier: ~$25/month
- Can pause deployment (data retained)
- Or switch to local Docker (free)

---

## Validation Checklist

Before submitting to judges:

### Vercel App
- [ ] App loads without errors
- [ ] Environment variables set correctly
- [ ] All pages accessible (inbox, search, dashboard)
- [ ] Data displays properly

### Agent Builder
- [ ] Webhook connector configured
- [ ] Test connector succeeds
- [ ] Workflow created and tested
- [ ] Agent tool creates tickets successfully

### Documentation
- [ ] README updated with live demo URL
- [ ] Local fallback instructions added
- [ ] Agent Builder setup documented
- [ ] Public GitHub repo with MIT license

### Proof of Webhook Integration
- [ ] Screenshot: Kibana connector config
- [ ] Screenshot: Agent Builder tool config
- [ ] Screenshot: Agent creating a ticket
- [ ] Screenshot: Ticket appears in app inbox

---

## What Judges Will See

### 1. Live Demo (Cloud)
1. Visit your Vercel URL: `https://YOUR_VERCEL_DOMAIN.vercel.app`
2. See real data in inbox
3. Search works with semantic kNN
4. Dashboard shows metrics

### 2. Agent Builder Integration (Kibana)
1. Log into your Elastic Cloud cluster
2. Navigate to Agent Builder
3. See `create_or_update_ticket` tool
4. Test it with a prompt
5. Ticket appears in app

### 3. Local Fallback (Docker)
If they prefer offline:
```bash
git clone https://github.com/YOUR_USERNAME/elasticops-copilot
cd elasticops-copilot
./demo/bootstrap.sh
```

---

## Next Steps

1. ✅ Deploy to Vercel (Steps 1-3)
2. ✅ Test deployment (Step 4)
3. ✅ Configure Agent Builder (Step 5)
4. ✅ Add local fallback docs (Step 6)
5. 📸 Take screenshots of:
   - Vercel deployment success
   - Kibana webhook connector
   - Agent Builder tool config
   - Agent creating a ticket
6. 📝 Update README with live demo URL
7. 🚀 Submit to Devpost!

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Elastic Cloud Docs**: https://www.elastic.co/guide/en/cloud/current/index.html
- **Agent Builder Docs**: https://www.elastic.co/guide/en/kibana/current/agent-builder.html
- **This Repo**: https://github.com/YOUR_USERNAME/elasticops-copilot

---

**Deployment Status**: 🚀 Ready to Deploy  
**Estimated Time**: 30 minutes  
**Complexity**: Medium (well documented)
