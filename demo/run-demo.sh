#!/bin/bash
set -euo pipefail

echo "🎬 ElasticOps Copilot - Demo Script"
echo "===================================="
echo ""

APP_URL=${APP_URL:-http://localhost:3000}
ELASTIC_API_KEY=${ELASTIC_API_KEY:-}

# Setup curl auth if needed
CURL_CMD="curl -s"
if [ -n "$ELASTIC_API_KEY" ]; then
  # For API requests, no auth needed (Next.js handles it)
  CURL_CMD="curl -s"
fi

# Step 1: Detect spike and create incident
echo "Step 1: Running spike detection..."
DETECT_RESPONSE=$($CURL_CMD -X POST "$APP_URL/api/run/incident/detect")
echo "$DETECT_RESPONSE" | jq .

INCIDENT_ID=$(echo "$DETECT_RESPONSE" | jq -r '.incident_id // empty')
TICKET_ID=$(echo "$DETECT_RESPONSE" | jq -r '.ticket_id // empty')

if [ -n "$INCIDENT_ID" ]; then
  echo "✅ Incident created: $INCIDENT_ID"
  echo "✅ Ticket created: $TICKET_ID"
else
  echo "ℹ️  No spike detected, fetching an existing open ticket..."
fi

# Step 2: Get an open ticket
echo ""
echo "Step 2: Fetching open tickets..."
TICKETS_RESPONSE=$($CURL_CMD "$APP_URL/api/tickets?status=open&size=1")
TRIAGE_TICKET_ID=$(echo "$TICKETS_RESPONSE" | jq -r '.tickets[0].id // empty')

if [ -z "$TRIAGE_TICKET_ID" ] && [ -n "$TICKET_ID" ]; then
  TRIAGE_TICKET_ID="$TICKET_ID"
fi

if [ -z "$TRIAGE_TICKET_ID" ]; then
  echo "❌ No open tickets found to triage"
  exit 1
fi

echo "📋 Selected ticket for triage: $TRIAGE_TICKET_ID"

# Step 3: Run triage on the ticket
echo ""
echo "Step 3: Running ticket triage workflow..."
TRIAGE_RESPONSE=$($CURL_CMD -X POST "$APP_URL/api/run/ticket/$TRIAGE_TICKET_ID")
echo "$TRIAGE_RESPONSE" | jq .

RUN_ID=$(echo "$TRIAGE_RESPONSE" | jq -r '.run_id // empty')

if [ -n "$RUN_ID" ]; then
  echo "✅ Triage completed: Run ID $RUN_ID"
else
  echo "⚠️  Triage may have failed"
fi

# Print summary
echo ""
echo "===================================="
echo "🎉 Demo execution complete!"
echo ""
echo "📍 Demo Pages:"
echo "  • Inbox:      $APP_URL/inbox"
echo "  • Ticket:     $APP_URL/ticket/$TRIAGE_TICKET_ID"
if [ -n "$INCIDENT_ID" ]; then
  echo "  • Incident:   $APP_URL/incident/$INCIDENT_ID"
fi
echo "  • Timeline:   $APP_URL/timeline/$TRIAGE_TICKET_ID"
echo "  • Search:     $APP_URL/search"
echo "  • Dashboard:  $APP_URL/dashboard"
echo ""
echo "🔍 Try searching: 'authentication error' or 'payment failed'"
echo "===================================="
