#!/bin/bash
set -euo pipefail

ELASTIC_MODE=${ELASTIC_MODE:-local}
ELASTIC_URL=${ELASTIC_URL:-http://localhost:9200}
ELASTIC_API_KEY=${ELASTIC_API_KEY:-}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPPINGS_DIR="$SCRIPT_DIR/mappings"

# Setup curl command with auth if API key is provided
CURL_CMD="curl -s"
if [ -n "$ELASTIC_API_KEY" ]; then
  CURL_CMD="curl -s -H 'Authorization: ApiKey $ELASTIC_API_KEY'"
fi

echo "🔍 Waiting for Elasticsearch to be ready (mode: $ELASTIC_MODE)..."
MAX_RETRIES=30
RETRY_COUNT=0
until eval "$CURL_CMD '$ELASTIC_URL/_cluster/health'" 2>/dev/null | grep -q '"status":"green\|yellow"'; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Failed to connect to Elasticsearch after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "   Waiting for Elasticsearch... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "✅ Elasticsearch is ready!"

INDICES=(
  "kb-articles"
  "tickets"
  "resolutions"
  "logs-app"
  "incidents"
  "ops-metrics"
  "ops-runs"
)

for index in "${INDICES[@]}"; do
  echo "🗑️  Deleting index: $index (if exists)"
  eval "$CURL_CMD -X DELETE '$ELASTIC_URL/$index'" > /dev/null 2>&1 || true
  
  echo "📝 Creating index: $index"
  RESULT=$(eval "$CURL_CMD -X PUT '$ELASTIC_URL/$index' -H 'Content-Type: application/json' -d @'$MAPPINGS_DIR/$index.json'")
  
  if echo "$RESULT" | grep -q '"acknowledged":true'; then
    echo "✅ Index $index created"
  else
    echo "❌ Failed to create index $index"
    echo "$RESULT"
    exit 1
  fi
done

echo ""
echo "🎉 All indices created successfully!"
