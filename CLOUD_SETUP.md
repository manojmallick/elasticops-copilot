# Elastic Cloud Setup Guide

This guide explains how to configure ElasticOps Copilot for **Elastic Cloud** (vs. local Docker).

## Prerequisites

1. ✅ Elastic Cloud account ([sign up here](https://cloud.elastic.co/registration))
2. ✅ **Cloud deployment** created (Elasticsearch + Kibana)
3. ✅ **API key** generated with cluster privileges
4. ✅ **Cloud ID** copied from deployment details

---

## Step 1: Get Your Cloud Credentials

### 1.1 Find Your Cloud ID

1. Log in to [Elastic Cloud Console](https://cloud.elastic.co)
2. Navigate to your deployment
3. Click **"Manage"** → **"Cloud ID"**
4. Copy the Cloud ID (format: `name:base64encodedstring`)

Example:
```
elasticops:d2VzdGV1cm9wZS5henVyZS5lbGFzdGljLWNsb3VkLmNvbTo0NDMkYzJjZmMwNDQ2OWI4NGE0N2IyOGUxN2JiOGIyN2Q3YmQkYmNkYzkyZWY0ZDFmNDM3ZmI3MWRlMmYxODAwMTFhZDA=
```

### 1.2 Create API Key

#### Option A: Via Kibana UI
1. Open Kibana → **Stack Management** → **API Keys**
2. Click **"Create API key"**
3. Name: `elasticops-api-key`
4. **DO NOT** restrict access (or grant `all` cluster privileges)
5. Copy the encoded API key

#### Option B: Via REST API
```bash
curl -X POST "https://YOUR-CLOUD-URL:443/_security/api_key" \
  -u elastic:YOUR_PASSWORD \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "elasticops-api-key",
    "expiration": "30d"
  }'
```

**Response**:
```json
{
  "id": "...",
  "name": "elasticops-api-key",
  "api_key": "...",
  "encoded": "QWI2MFFwd0J6Z2QxWDlMWXlKaEY6RnVYeWMzbUkxZnhPTmlQVTdMZlVFZw=="
}
```

Copy the `encoded` value.

### 1.3 Get Your Elasticsearch URL (Optional)

Only needed if you want to use URL mode instead of Cloud ID mode.

Format: `https://<deployment-id>.<region>.elastic-cloud.com:443`

Example:
```
https://c2cfc04469b84a47b28e17bb8b27d7bd.westeurope.azure.elastic-cloud.com:443
```

---

## Step 2: Configure Environment

### 2.1 Copy Environment Template

```bash
cp .env.example .env.local
```

### 2.2 Edit .env.local

**For Cloud ID Mode** (recommended):
```bash
# Mode Selection
ELASTIC_MODE=cloud

# Elastic Cloud Credentials
ELASTIC_CLOUD_ID=elasticops:d2VzdGV1cm9wZS5henVyZS5lbGFzdGljLWNsb3VkLmNvbTo0NDMkYzJjZmMwNDQ2OWI4NGE0N2IyOGUxN2JiOGIyN2Q3YmQkYmNkYzkyZWY0ZDFmNDM3ZmI3MWRlMmYxODAwMTFhZDA=
ELASTIC_API_KEY=QWI2MFFwd0J6Z2QxWDlMWXlKaEY6RnVYeWMzbUkxZnhPTmlQVTdMZlVFZw==

# Optional: LLM Integration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# App Config
NEXT_PUBLIC_APP_NAME=ElasticOps Copilot
```

**For URL Mode** (alternative):
```bash
# Mode Selection
ELASTIC_MODE=cloud

# Elastic Cloud Connection
ELASTIC_URL=https://c2cfc04469b84a47b28e17bb8b27d7bd.westeurope.azure.elastic-cloud.com:443
ELASTIC_API_KEY=QWI2MFFwd0J6Z2QxWDlMWXlKaEY6RnVYeWMzbUkxZnhPTmlQVTdMZlVFZw==

# Optional: LLM Integration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# App Config
NEXT_PUBLIC_APP_NAME=ElasticOps Copilot
```

---

## Step 3: Verify Connection

### 3.1 Test Cloud Connection

```bash
# Using Cloud ID (recommended)
curl -H "Authorization: ApiKey $ELASTIC_API_KEY" \
  "https://c2cfc04469b84a47b28e17bb8b27d7bd.westeurope.azure.elastic-cloud.com:443/_cluster/health"
```

**Expected Response**:
```json
{
  "cluster_name": "c2cfc04469b84a47b28e17bb8b27d7bd",
  "status": "green",
  "number_of_nodes": 3,
  ...
}
```

### 3.2 Test with Node.js

```bash
node -e "
const { Client } = require('@elastic/elasticsearch');
const client = new Client({
  cloud: { id: process.env.ELASTIC_CLOUD_ID },
  auth: { apiKey: process.env.ELASTIC_API_KEY }
});
client.info().then(console.log);
"
```

---

## Step 4: Create Indices

```bash
cd infra
./create-indices.sh
```

**What This Does**:
1. Connects to Elastic Cloud using API key
2. Deletes existing indices (if any)
3. Creates 7 indices with mappings:
   - `kb-articles`
   - `tickets`
   - `resolutions`
   - `logs-app`
   - `incidents`
   - `ops-metrics`
   - `ops-runs`

**Expected Output**:
```
🔍 Waiting for Elasticsearch to be ready (mode: cloud)...
✅ Elasticsearch is ready!
📝 Creating index: kb-articles
✅ Index kb-articles created
📝 Creating index: tickets
✅ Index tickets created
...
🎉 All indices created successfully!
```

---

## Step 5: Generate Synthetic Data

```bash
node data/generator/generate_synthetic.js
```

**What This Does**:
- Creates ~200 KB articles
- Creates ~300 resolution notes
- Creates ~2000 tickets
- Creates ~10,000 log entries

**Expected Output**:
```
Using Elastic Cloud configuration
📦 Creating KB articles batch 1/2
✅ Created 100 KB articles
📦 Creating KB articles batch 2/2
✅ Created 100 KB articles
...
🎉 Synthetic data generation complete!
```

---

## Step 6: Start Application

```bash
npm install
npm run dev
```

**Open**: http://localhost:3000

---

## Architecture: Cloud vs. Local

### Local Mode (Docker)
```
┌──────────────┐
│ Next.js App  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Docker       │
│ - ES:9200    │
│ - Kibana:5601│
└──────────────┘
```

### Cloud Mode
```
┌──────────────┐
│ Next.js App  │
└──────┬───────┘
       │
       │ API Key Auth
       ▼
┌────────────────────┐
│ Elastic Cloud      │
│ - ES (TLS)         │
│ - Kibana (managed) │
└────────────────────┘
```

---

## How Cloud Mode Works

### Client Configuration

**Cloud ID Mode** ([`lib/elastic.ts`](../lib/elastic.ts)):
```typescript
const clientConfig: ClientOptions = {
  cloud: {
    id: process.env.ELASTIC_CLOUD_ID!
  },
  auth: {
    apiKey: process.env.ELASTIC_API_KEY!
  }
};
```

The Cloud ID is base64-encoded and contains:
- Cluster endpoint URL
- Deployment UUID
- Kibana UUID

The client library decodes this automatically.

### Authentication

**API Key** (recommended):
```bash
Authorization: ApiKey <base64-encoded-key>
```

**vs. Basic Auth** (less secure):
```bash
Authorization: Basic <base64(username:password)>
```

---

## Differences from Local Mode

| Feature | Local (Docker) | Cloud |
|---------|----------------|-------|
| **Setup** | `docker-compose up` | Get Cloud ID + API key |
| **Connection** | `http://localhost:9200` | `cloud.id` + HTTPS |
| **Auth** | None (or basic) | API key required |
| **Kibana** | `localhost:5601` | Cloud-hosted URL |
| **TLS** | Optional | Always enforced |
| **Scaling** | Single node | Auto-scaling available |

---

## Common Issues

### Issue 1: "Unauthorized" Error

**Symptom**:
```
Error: security_exception - unable to authenticate user
```

**Fix**:
- Verify API key is correct
- Check API key hasn't expired
- Ensure API key has cluster privileges

**Test**:
```bash
curl -H "Authorization: ApiKey $ELASTIC_API_KEY" \
  "$ELASTIC_URL/_security/_authenticate"
```

---

### Issue 2: "Unknown Index" Error

**Symptom**:
```
Error: index_not_found_exception - no such index [tickets]
```

**Fix**:
```bash
cd infra
./create-indices.sh
```

---

### Issue 3: Connection Timeout

**Symptom**:
```
Error: connect ETIMEDOUT
```

**Possible Causes**:
1. Wrong Cloud ID
2. Firewall blocking HTTPS
3. VPN interference

**Debug**:
```bash
# Check if URL is reachable
curl -I https://YOUR-CLOUD-URL:443

# Test with verbose output
curl -v -H "Authorization: ApiKey $ELASTIC_API_KEY" \
  https://YOUR-CLOUD-URL:443/_cluster/health
```

---

### Issue 4: Cloud ID Format Error

**Symptom**:
```
Error: Cloud ID should be in the format <name>:<base64string>
```

**Fix**:
Ensure Cloud ID includes the deployment name prefix:
```
elasticops:d2VzdGV1cm9wZS5henVyZS5lbGFzdGljLWNsb3VkLmNvbTo0NDMk...
^^^^^^^^^
   name
```

---

## Switching Between Modes

### Cloud → Local

1. Edit `.env.local`:
   ```bash
   ELASTIC_MODE=local
   # ELASTIC_CLOUD_ID=...   # Comment out
   # ELASTIC_API_KEY=...    # Comment out
   ```

2. Start Docker:
   ```bash
   cd infra
   docker-compose up -d
   ```

3. Recreate indices:
   ```bash
   ./create-indices.sh
   node ../data/generator/generate_synthetic.js
   ```

### Local → Cloud

Follow Steps 1-6 above.

---

## Security Best Practices

### ✅ DO
- Use API keys (not passwords)
- Set API key expiration (e.g., 30 days)
- Rotate keys regularly
- Never commit `.env.local` to git
- Use separate keys for dev/prod

### ❌ DON'T
- Share API keys in public repos
- Use the `elastic` superuser for apps
- Store keys in source code
- Use same key for multiple apps

---

## Cost Optimization

### Free Tier
Elastic Cloud offers a **14-day free trial** with:
- 8GB RAM
- 2GB storage
- All features unlocked

### After Trial
For hackathon/demo purposes:
- **Standard tier** (~$25/month)
- 2GB RAM / 8GB storage
- Sufficient for 10k-100k documents

**Tip**: Delete deployment after hackathon to avoid charges.

---

## Monitoring

### Check Deployment Health

**Kibana** → **Stack Monitoring**

or via API:
```bash
curl -H "Authorization: ApiKey $ELASTIC_API_KEY" \
  "$ELASTIC_URL/_cluster/health?pretty"
```

### Check Index Stats

```bash
curl -H "Authorization: ApiKey $ELASTIC_API_KEY" \
  "$ELASTIC_URL/_cat/indices?v"
```

**Example Output**:
```
health status index        docs.count docs.deleted
green  open   kb-articles         200            0
green  open   tickets            2000            0
green  open   resolutions         300            0
green  open   logs-app          10000            0
```

---

## Next Steps

1. ✅ Verify setup: http://localhost:3000
2. ✅ Check agents: http://localhost:3000/inbox
3. ✅ Try search: http://localhost:3000/search
4. ✅ View dashboard: http://localhost:3000/dashboard
5. ✅ Run demo: See [`agent_builder/demo_steps.md`](../agent_builder/demo_steps.md)

---

## Support

- **Docs**: https://www.elastic.co/guide/en/cloud/current/index.html
- **Forum**: https://discuss.elastic.co/c/elastic-cloud/48
- **Slack**: Elastic Community Slack (#cloud channel)
