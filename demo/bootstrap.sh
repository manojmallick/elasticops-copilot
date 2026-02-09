#!/bin/bash
set -euo pipefail

echo "🚀 ElasticOps Copilot - Bootstrap Script"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Load .env.local if it exists
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Detect Elasticsearch mode
ELASTIC_MODE=${ELASTIC_MODE:-local}
ELASTIC_URL=${ELASTIC_URL:-http://localhost:9200}

if [ "$ELASTIC_MODE" = "cloud" ]; then
  echo "☁️  Mode: Elastic Cloud"
  echo "    Cloud ID: ${ELASTIC_CLOUD_ID:0:30}..."
  echo ""
else
  echo "🐳 Mode: Local Docker"
  echo ""
  
  # Step 1: Start Docker services
  echo "📦 Step 1/5: Starting Elasticsearch and Kibana..."
  cd infra
  docker-compose up -d
  cd "$PROJECT_ROOT"

  echo "⏳ Waiting for services to be ready (this may take 30-60 seconds)..."
  sleep 10
fi

# Step 2: Create indices
echo ""
echo "📝 Step 2/5: Creating Elasticsearch indices..."
chmod +x infra/create-indices.sh
./infra/create-indices.sh

# Step 3: Generate synthetic data
echo ""
echo "🎲 Step 3/5: Generating synthetic data..."
node data/generator/generate_synthetic.js

# Step 4: Install dependencies
echo ""
echo "📚 Step 4/5: Installing Node dependencies..."
npm install

# Step 5: Start Next.js app
echo ""
echo "🎉 Step 5/5: Starting Next.js development server..."
echo ""
echo "========================================"
echo "✅ Bootstrap complete!"
echo ""
echo "🌐 Application starting at: http://localhost:3000"
if [ "$ELASTIC_MODE" = "local" ]; then
  echo "📊 Kibana available at: http://localhost:5601"
fi
echo ""
echo "Demo pages:"
echo "  • Inbox: http://localhost:3000/inbox"
echo "  • Search: http://localhost:3000/search"
echo "  • Dashboard: http://localhost:3000/dashboard"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

npm run dev
