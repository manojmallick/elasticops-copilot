# Testing Error Spike Detection

Quick guide to trigger and test the incident detection feature.

---

## 🎯 Goal

Generate error logs in Elasticsearch to trigger the spike detection algorithm and see:
- Incident auto-creation
- Ticket auto-creation with KB citations
- Full audit timeline

---

## 📋 Prerequisites

1. **Elasticsearch running** with indices created:
   ```bash
   bash infra/create-indices.sh
   ```

2. **Environment variables** set in `.env`:
   ```bash
   ELASTIC_CLOUD_ID=your_cloud_id
   ELASTIC_API_KEY=your_api_key
   ```

3. **Node.js** dependencies installed:
   ```bash
   npm install
   ```

---

## 🚀 Method 1: Automated Script (Recommended)

### Prerequisites:
Make sure your `.env` file has valid Elasticsearch credentials:
```bash
# .env
ELASTIC_CLOUD_ID=your_actual_cloud_id_here
ELASTIC_API_KEY=your_actual_api_key_here
```

### Run the generator:
```bash
node demo/generate-error-spike.js
```

**What it does:**
- Inserts 50 ERROR logs into `logs-app` index
- Service: `api-gateway`, Environment: `production`
- Spread over last 2 minutes
- Verifies spike is detectable

**Expected output:**
```
✅ Successfully inserted 50 error logs!

✅ Spike detected!
   • api-gateway (production): 50 errors

📊 Next steps:
   1. Go to http://localhost:3000/inbox
   2. Click "🔍 Detect Error Spike"
   3. You should see: "✅ Spike detected! Created incident..."
```

---

## 🔬 Method 2: Manual cURL

### Insert a single error log:
```bash
curl -X POST "http://localhost:9200/logs-app/_doc?refresh=true" \
  -H "Content-Type: application/json" \
  -d '{
    "@timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "level": "ERROR",
    "service": "api-gateway",
    "env": "production",
    "message": "Connection timeout to database",
    "trace_id": "trace_abc123",
    "endpoint": "/api/v1/checkout",
    "status_code": 500
  }'
```

### Insert 50 errors at once:
```bash
for i in {1..50}; do
  curl -s -X POST "http://localhost:9200/logs-app/_doc" \
    -H "Content-Type: application/json" \
    -d '{
      "@timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
      "level": "ERROR",
      "service": "api-gateway",
      "env": "production",
      "message": "Error #'$i': Payment gateway timeout",
      "trace_id": "trace_'$RANDOM'"
    }' > /dev/null
done

# Refresh index
curl -X POST "http://localhost:9200/logs-app/_refresh"
```

---

## 🧪 Testing in UI

### 1. Go to Inbox page:
```
http://localhost:3000/inbox
```

### 2. Click "🔍 Detect Error Spike" button

### 3. Expected outcomes:

**✅ Spike Detected:**
```
✅ Spike detected! Created incident INC-1234567890 and ticket TKT-1234567891
```

**ℹ️ No Spike:**
```
ℹ️ No error spikes detected in the last 5 minutes
```

### 4. View created incident:
- Incident appears in **Incidents** column (left)
- Click to view details
- See timeline with evidence

### 5. View created ticket:
- Ticket appears in **Tickets** column (right)
- Click to view details
- See auto-triaged category, priority, KB citations

---

## 🔍 Detection Algorithm

**ES|QL Query:**
```sql
FROM logs-app
| WHERE @timestamp >= NOW() - 5 minutes
| WHERE level == "ERROR"
| STATS errors = COUNT(*) BY service, env
| WHERE errors >= 40
| SORT errors DESC
```

**Spike Criteria:**
- ✅ At least **40 errors** in **5 minutes**
- ✅ Grouped by `service` and `env`
- ✅ Only `ERROR` level logs

---

## 📊 What Happens After Detection

1. **Incident Created:**
   - Index: `incidents`
   - Title: "Error spike in {service}"
   - Severity: `critical` (500+ errors) or `high`
   - Status: `open`

2. **Related Resolutions Retrieved:**
   - Vector search on `resolutions` index
   - Based on incident summary embedding

3. **Ticket Created:**
   - Index: `tickets`
   - Subject: Auto-generated from incident
   - Citations: KB articles + resolutions
   - Priority: Determined by error count

4. **Timeline Recorded:**
   - Index: `ops-runs`
   - Workflow: `incident_detection`
   - All steps with timing
   - View at `/timeline/{run_id}`

---

## 🐛 Troubleshooting

### "No spike detected" but you inserted 50+ errors:

**Check index refresh:**
```bash
curl -X POST "http://localhost:9200/logs-app/_refresh"
```

**Verify logs exist:**
```bash
curl -X GET "http://localhost:9200/logs-app/_search?q=level:ERROR&size=0"
```

**Check timestamp (must be recent):**
```bash
# Logs older than 5 minutes won't be detected
curl -X GET "http://localhost:9200/logs-app/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"term": {"level": "ERROR"}},
          {"range": {"@timestamp": {"gte": "now-5m"}}}
        ]
      }
    },
    "size": 0
  }'
```

### Script fails with "Index not found":

**Create indices:**
```bash
cd infra
bash create-indices.sh
```

### Connection errors:

**Verify environment variables:**
```bash
echo $ELASTIC_CLOUD_ID
echo $ELASTIC_API_KEY
```

---

## 🎬 Demo Scenario

**Realistic error spike simulation:**

1. **Generate baseline traffic** (optional):
   ```bash
   # Insert 20 INFO logs (below threshold)
   for i in {1..20}; do
     curl -s -X POST "http://localhost:9200/logs-app/_doc" \
       -H "Content-Type: application/json" \
       -d '{"@timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'","level":"INFO","service":"api-gateway","env":"production","message":"Request processed"}' > /dev/null
   done
   ```

2. **Trigger spike:**
   ```bash
   node demo/generate-error-spike.js
   ```

3. **Detect in UI:**
   - Go to `/inbox`
   - Click "🔍 Detect Error Spike"
   - See incident + ticket created

4. **Investigate:**
   - Click incident to view details
   - Click "📊 View Timeline" to see full workflow
   - Click ticket to see auto-triage with KB citations

5. **Resolve:**
   - Incident shows related resolutions
   - Ticket has draft customer message with links

---

## 📝 Customization

### Change threshold (modify `lib/esql.ts`):
```typescript
| WHERE errors >= 10  // Lower threshold for testing
```

### Change time window:
```typescript
| WHERE @timestamp >= NOW() - 1 minutes  // Shorter window
```

### Use different service:
```javascript
// In generate-error-spike.js
const service = 'payment-api';
const env = 'staging';
```

---

## ✅ Success Checklist

- [ ] Generated 40+ ERROR logs in last 5 minutes
- [ ] Clicked "Detect Error Spike" in UI
- [ ] Saw confirmation message with incident/ticket IDs
- [ ] Incident appears in inbox left column
- [ ] Ticket appears in inbox right column
- [ ] Can view incident details
- [ ] Can view ticket details with citations
- [ ] Can view timeline at `/timeline/{run_id}`

---

**Need more help?** Check logs:
```bash
# Next.js dev server logs
npm run dev

# Check Elasticsearch query works
curl -X POST "http://localhost:9200/_query" \
  -H "Content-Type: application/json" \
  -d '{"query":"FROM logs-app | WHERE level == \"ERROR\" | STATS errors = COUNT(*)"}'
```
