#!/bin/bash
# Quick validation script to check if all files are in place

echo "🔍 Validating ElasticOps Copilot Repository..."
echo ""

ERRORS=0

check_file() {
  if [ -f "$1" ]; then
    echo "✅ $1"
  else
    echo "❌ MISSING: $1"
    ((ERRORS++))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo "✅ $1/"
  else
    echo "❌ MISSING: $1/"
    ((ERRORS++))
  fi
}

echo "📁 Configuration Files:"
check_file "package.json"
check_file "tsconfig.json"
check_file "next.config.js"
check_file ".env.example"
check_file ".gitignore"
check_file "LICENSE"
check_file "README.md"

echo ""
echo "🐳 Infrastructure:"
check_file "infra/docker-compose.yml"
check_file "infra/create-indices.sh"
check_file "infra/mappings/kb-articles.json"
check_file "infra/mappings/tickets.json"
check_file "infra/mappings/resolutions.json"
check_file "infra/mappings/logs-app.json"
check_file "infra/mappings/incidents.json"
check_file "infra/mappings/ops-metrics.json"
check_file "infra/mappings/ops-runs.json"

echo ""
echo "📚 Core Libraries:"
check_file "lib/elastic.ts"
check_file "lib/embed.ts"
check_file "lib/esql.ts"
check_file "lib/searchTemplates.ts"

echo ""
echo "🎲 Data Generator:"
check_file "data/generator/generate_synthetic.js"

echo ""
echo "🔌 API Routes:"
check_file "app/api/tickets/route.ts"
check_file "app/api/tickets/[id]/route.ts"
check_file "app/api/incidents/route.ts"
check_file "app/api/incidents/[id]/route.ts"
check_file "app/api/search/route.ts"
check_file "app/api/metrics/route.ts"
check_file "app/api/timeline/[id]/route.ts"
check_file "app/api/run/ticket/[id]/route.ts"
check_file "app/api/run/incident/detect/route.ts"
check_file "app/api/tools/create_or_update_ticket/route.ts"

echo ""
echo "🎨 UI Pages:"
check_file "app/layout.tsx"
check_file "app/globals.css"
check_file "app/page.tsx"
check_file "app/inbox/page.tsx"
check_file "app/ticket/[id]/page.tsx"
check_file "app/incident/[id]/page.tsx"
check_file "app/timeline/[id]/page.tsx"
check_file "app/search/page.tsx"
check_file "app/dashboard/page.tsx"

echo ""
echo "🎬 Demo Scripts:"
check_file "demo/bootstrap.sh"
check_file "demo/run-demo.sh"
check_file "demo/demo-script.md"
check_file "demo/architecture.mmd"
check_dir "demo/screenshots"

echo ""
echo "================================"
if [ $ERRORS -eq 0 ]; then
  echo "✅ All files present! Repository is complete."
  echo ""
  echo "🚀 Ready to run:"
  echo "   ./demo/bootstrap.sh"
else
  echo "❌ Found $ERRORS missing files/directories"
  exit 1
fi
