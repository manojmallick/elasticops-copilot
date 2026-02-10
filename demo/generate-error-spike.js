#!/usr/bin/env node
/**
 * Generate Error Spike Demo Script
 * 
 * This script inserts ERROR logs into Elasticsearch to trigger incident detection.
 * 
 * Usage:
 *   node demo/generate-error-spike.js
 * 
 * Requirements:
 *   - ELASTIC_CLOUD_ID and ELASTIC_API_KEY set in .env
 *   - logs-app index exists in Elasticsearch
 * 
 * What it does:
 *   - Inserts 50 ERROR logs for service="api-gateway" env="production"
 *   - Spread over last 2 minutes
 *   - Triggers spike detection (threshold is 40 errors in 5 minutes)
 */

const path = require('path');
const fs = require('fs');

// Load .env from parent directory
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} else {
  console.error('⚠️  No .env file found at:', envPath);
  console.error('   Create one from .env.example:');
  console.error('   cp .env.example .env\n');
  console.error('   Then edit .env and add your credentials.\n');
}

const { Client } = require('@elastic/elasticsearch');

// Initialize Elasticsearch client (delayed to allow env loading)
let client;

function getClient() {
  if (!client) {
    if (!process.env.ELASTIC_CLOUD_ID || !process.env.ELASTIC_API_KEY) {
      console.error('❌ Missing Elasticsearch configuration');
      console.error('   ELASTIC_CLOUD_ID:', process.env.ELASTIC_CLOUD_ID ? '✅ Set' : '❌ Not set');
      console.error('   ELASTIC_API_KEY:', process.env.ELASTIC_API_KEY ? '✅ Set' : '❌ Not set');
      console.error('\n   Make sure your .env file contains:');
      console.error('   ELASTIC_CLOUD_ID=your_cloud_id_here');
      console.error('   ELASTIC_API_KEY=your_api_key_here\n');
      process.exit(1);
    }
    
    client = new Client({
      cloud: {
        id: process.env.ELASTIC_CLOUD_ID,
      },
      auth: {
        apiKey: process.env.ELASTIC_API_KEY,
      },
    });
  }
  return client;
}

async function generateErrorSpike() {
  console.log('🔥 Generating error spike...\n');
  
  const service = 'api-gateway';
  const env = 'production';
  const errorCount = 50; // Above threshold of 40
  const timeSpreadMinutes = 2;
  
  const now = Date.now();
  const operations = [];
  
  // Generate error messages
  const errorMessages = [
    'Connection timeout to database',
    'Failed to authenticate user',
    'Payment gateway returned 502',
    'Rate limit exceeded',
    'Memory allocation failed',
    'Webhook delivery failed',
    'Cache connection refused',
    'Invalid API token',
    'Query execution timeout',
    'Service unavailable',
  ];
  
  for (let i = 0; i < errorCount; i++) {
    // Spread timestamps over last 2 minutes
    const timestamp = new Date(now - Math.random() * timeSpreadMinutes * 60 * 1000);
    const message = errorMessages[Math.floor(Math.random() * errorMessages.length)];
    
    const doc = {
      '@timestamp': timestamp.toISOString(),
      level: 'ERROR',
      service,
      env,
      message,
      trace_id: `trace_${Math.random().toString(36).substr(2, 9)}`,
      user_id: `user_${Math.floor(Math.random() * 1000)}`,
      endpoint: '/api/v1/checkout',
      status_code: 500,
      duration_ms: Math.floor(Math.random() * 5000) + 100,
    };
    
    // Bulk index format
    operations.push({ index: { _index: 'logs-app' } });
    operations.push(doc);
  }
  
  try {
    console.log(`📝 Inserting ${errorCount} ERROR logs...`);
    console.log(`   Service: ${service}`);
    console.log(`   Environment: ${env}`);
    console.log(`   Time range: last ${timeSpreadMinutes} minutes\n`);
    
    const bulkResponse = await getClient().bulk({
      refresh: true,
      operations,
    });
    
    if (bulkResponse.errors) {
      console.error('❌ Some operations failed:');
      bulkResponse.items.forEach((item, idx) => {
        if (item.index?.error) {
          console.error(`  - Doc ${idx}: ${item.index.error.reason}`);
        }
      });
    } else {
      console.log(`✅ Successfully inserted ${errorCount} error logs!\n`);
    }
    
    // Verify spike detection will work
    console.log('🔍 Verifying spike detection...\n');
    
    const esqlQuery = `
      FROM logs-app
      | WHERE @timestamp >= NOW() - 5 minutes
      | WHERE level == "ERROR"
      | STATS errors = COUNT(*) BY service, env
      | WHERE errors >= 40
      | SORT errors DESC
    `;
    
    const queryResponse = await getClient().transport.request({
      method: 'POST',
      path: '/_query',
      body: { query: esqlQuery },
    });
    
    const spikes = queryResponse.values || [];
    
    if (spikes.length > 0) {
      console.log('✅ Spike detected!');
      spikes.forEach(([errors, svc, environment]) => {
        console.log(`   • ${svc} (${environment}): ${errors} errors`);
      });
      console.log('\n📊 Next steps:');
      console.log('   1. Go to http://localhost:3000/inbox');
      console.log('   2. Click "🔍 Detect Error Spike"');
      console.log('   3. You should see: "✅ Spike detected! Created incident..."');
      console.log('   4. View the new incident and ticket in the inbox\n');
    } else {
      console.log('⚠️  No spike detected. Possible reasons:');
      console.log('   - Threshold not met (need >= 40 errors in 5 minutes)');
      console.log('   - Index refresh delay (wait a few seconds)');
      console.log('   - Wrong index name or mapping\n');
    }
    
  } catch (error) {
    console.error('❌ Error generating spike:', error.message);
    if (error.meta?.body?.error) {
      console.error('   Details:', error.meta.body.error);
    }
    process.exit(1);
  }
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  // getClient() will check env vars and exit if missing
  
  try {
    // Check if logs-app index exists
    const exists = await getClient().indices.exists({ index: 'logs-app' });
    
    if (!exists) {
      console.error('❌ Index "logs-app" does not exist');
      console.error('   Run: bash infra/create-indices.sh\n');
      process.exit(1);
    }
    
    console.log('✅ Prerequisites met\n');
  } catch (error) {
    console.error('❌ Failed to connect to Elasticsearch:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 ElasticOps Copilot - Error Spike Generator\n');
  console.log('=' .repeat(60) + '\n');
  
  await checkPrerequisites();
  await generateErrorSpike();
  
  console.log('=' .repeat(60));
  console.log('✅ Done!\n');
}

main().catch(console.error);
