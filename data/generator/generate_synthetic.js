#!/usr/bin/env node

/**
 * Synthetic Data Generator for ElasticOps Copilot
 * Creates reproducible demo data with deterministic embeddings
 */

const { Client } = require('@elastic/elasticsearch');
const crypto = require('crypto');

const ELASTIC_MODE = process.env.ELASTIC_MODE || 'local';
const ELASTIC_CLOUD_ID = process.env.ELASTIC_CLOUD_ID;
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;
const ELASTIC_URL = process.env.ELASTIC_URL || 'http://localhost:9200';
const EMBED_DIMS = 384;
const BATCH_SIZE = 100;

// Configure client based on mode
const clientConfig = {};

if (ELASTIC_MODE === 'cloud' && ELASTIC_CLOUD_ID && ELASTIC_API_KEY) {
  clientConfig.cloud = { id: ELASTIC_CLOUD_ID };
  clientConfig.auth = { apiKey: ELASTIC_API_KEY };
  console.log('Using Elastic Cloud configuration');
} else {
  clientConfig.node = ELASTIC_URL;
  if (ELASTIC_API_KEY && ELASTIC_URL.startsWith('https')) {
    clientConfig.auth = { apiKey: ELASTIC_API_KEY };
  }
  console.log('Using local/URL configuration');
}

const client = new Client(clientConfig);

// Deterministic embedding function (matches lib/embed.ts)
function generateEmbedding(text) {
  const normalized = text.toLowerCase().trim();
  const hash = crypto.createHash('sha256').update(normalized).digest();
  
  const embedding = [];
  const rounds = Math.ceil(EMBED_DIMS / 32);
  
  for (let round = 0; round < rounds; round++) {
    const roundHash = crypto
      .createHash('sha256')
      .update(hash)
      .update(Buffer.from([round]))
      .digest();
    
    for (let i = 0; i < 32 && embedding.length < EMBED_DIMS; i++) {
      const value = (roundHash[i] / 255.0) * 2 - 1;
      embedding.push(value);
    }
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

// Bulk indexing helper
async function bulkIndex(index, documents) {
  const body = documents.flatMap(doc => [
    { index: { _index: index } },
    doc,
  ]);

  try {
    const result = await client.bulk({ body, refresh: true });
    
    if (result.errors) {
      const erroredDocs = result.items.filter(item => item.index.error);
      console.error(`❌ Bulk indexing errors in ${index}:`, erroredDocs.length);
      erroredDocs.slice(0, 3).forEach(item => {
        console.error('   ', item.index.error);
      });
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Bulk index error for ${index}:`, error.message);
    throw error;
  }
}

// Data generators
const categories = ['authentication', 'billing', 'performance', 'integration', 'data', 'incident'];
const severities = ['low', 'medium', 'high', 'critical'];
const priorities = ['p4', 'p3', 'p2', 'p1'];
const statuses = ['open', 'in_progress', 'resolved', 'closed'];
const channels = ['email', 'chat', 'phone', 'system'];
const services = ['api-gateway', 'auth-service', 'billing-service', 'data-processor', 'notification-service'];
const envs = ['production', 'staging', 'development'];
const errorCodes = ['AUTH_001', 'BILL_002', 'PERF_003', 'INTG_004', 'DATA_005', 'SYS_999'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDate(daysAgo, hoursVariation = 24) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - randomInt(0, hoursVariation));
  return date.toISOString();
}

// Generate KB articles (200)
async function generateKBArticles() {
  console.log('📚 Generating 200 KB articles...');
  
  const articles = [];
  const titles = [
    'How to reset user password',
    'Troubleshooting authentication failures',
    'Understanding billing cycles',
    'Optimizing query performance',
    'Integrating third-party APIs',
    'Data backup and recovery procedures',
    'Handling timeout errors',
    'Setting up SSO authentication',
    'Managing API rate limits',
    'Debugging webhook failures',
  ];
  
  for (let i = 0; i < 200; i++) {
    const title = `${titles[i % titles.length]} - Case ${i + 1}`;
    const category = categories[i % categories.length];
    const content = `This article explains ${title.toLowerCase()}. Common symptoms include errors, delays, or unexpected behavior. 
    
Solution steps:
1. Verify configuration settings
2. Check system logs for errors
3. Review recent changes
4. Apply recommended fixes
5. Monitor for resolution

Category: ${category}. This has been validated across multiple customer scenarios and has a 95% success rate.`;
    
    const embedding = generateEmbedding(title + ' ' + content);
    
    articles.push({
      title,
      content,
      category,
      tags: [category, 'howto', 'troubleshooting'].slice(0, randomInt(2, 3)),
      created_at: generateDate(randomInt(30, 180)),
      updated_at: generateDate(randomInt(1, 30)),
      author: `author_${randomInt(1, 10)}`,
      views: randomInt(100, 5000),
      helpful_count: randomInt(10, 500),
      embedding,
    });
  }
  
  // Index in batches
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    await bulkIndex('kb-articles', batch);
  }
  
  console.log('✅ KB articles indexed');
}

// Generate resolutions (300)
async function generateResolutions() {
  console.log('🔧 Generating 300 resolution cards...');
  
  const resolutions = [];
  const titleTemplates = [
    'Quick fix for {category} issue',
    'Standard procedure for {category} errors',
    'Resolution steps for {category} failures',
    'Automated fix for {category} problems',
  ];
  
  for (let i = 0; i < 300; i++) {
    const category = categories[i % categories.length];
    const severity = severities[i % severities.length];
    const title = titleTemplates[i % titleTemplates.length].replace('{category}', category);
    
    const summary = `This resolution addresses ${category} issues with ${severity} severity. Applies to common failure patterns.`;
    const steps = `Step 1: Identify root cause\nStep 2: Apply configuration change\nStep 3: Restart affected service\nStep 4: Verify resolution\nStep 5: Document outcome`;
    
    const embedding = generateEmbedding(title + ' ' + summary);
    
    resolutions.push({
      resolution_id: `RES-${String(i + 1).padStart(5, '0')}`,
      title,
      summary,
      steps,
      category,
      severity,
      tags: [category, severity],
      success_rate: 0.7 + Math.random() * 0.29, // 70-99%
      avg_resolution_time_minutes: randomInt(5, 120),
      created_at: generateDate(randomInt(60, 365)),
      updated_at: generateDate(randomInt(1, 60)),
      created_by: `engineer_${randomInt(1, 15)}`,
      embedding,
    });
  }
  
  for (let i = 0; i < resolutions.length; i += BATCH_SIZE) {
    const batch = resolutions.slice(i, i + BATCH_SIZE);
    await bulkIndex('resolutions', batch);
  }
  
  console.log('✅ Resolutions indexed');
}

// Generate tickets (2000)
async function generateTickets() {
  console.log('🎫 Generating 2000 tickets...');
  
  const tickets = [];
  const subjectTemplates = [
    'Cannot login to account',
    'Payment processing failed',
    'Slow response times',
    'API integration not working',
    'Data sync issues',
    'Missing data in reports',
    'Timeout errors',
    'Unexpected error messages',
  ];
  
  for (let i = 0; i < 2000; i++) {
    const subject = `${subjectTemplates[i % subjectTemplates.length]} #${i + 1}`;
    const category = categories[i % categories.length];
    const severity = severities[i % severities.length];
    const status = i < 100 ? 'open' : randomChoice(statuses);
    
    const description = `Customer reported: ${subject}. This started happening recently and is affecting their workflow. Need urgent assistance.`;
    
    const embedding = generateEmbedding(subject + ' ' + description);
    
    const ticket = {
      ticket_id: `TKT-${String(i + 1).padStart(6, '0')}`,
      subject,
      description,
      category,
      severity,
      priority: priorities[severities.indexOf(severity)],
      status,
      channel: randomChoice(channels),
      customer_id: `CUST-${randomInt(1000, 9999)}`,
      assigned_to: status === 'open' ? null : `agent_${randomInt(1, 20)}`,
      created_at: generateDate(randomInt(0, 30)),
      updated_at: generateDate(randomInt(0, 15)),
      tags: [category, severity],
      embedding,
    };
    
    if (status === 'resolved' || status === 'closed') {
      ticket.resolved_at = generateDate(randomInt(0, 10));
      ticket.customer_message = 'Thank you for your inquiry. This has been resolved.';
      ticket.internal_notes = 'Applied standard resolution procedure.';
    }
    
    tickets.push(ticket);
  }
  
  for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
    const batch = tickets.slice(i, i + BATCH_SIZE);
    await bulkIndex('tickets', batch);
  }
  
  console.log('✅ Tickets indexed');
}

// Generate logs with 3 spikes (10k logs over last 2 hours)
async function generateLogs() {
  console.log('📊 Generating 10k logs with 3 error spikes...');
  
  const logs = [];
  const now = new Date();
  
  // Normal logs (8k)
  for (let i = 0; i < 8000; i++) {
    const minutesAgo = randomInt(0, 120);
    const timestamp = new Date(now.getTime() - minutesAgo * 60 * 1000);
    
    logs.push({
      '@timestamp': timestamp.toISOString(),
      service: randomChoice(services),
      env: randomChoice(envs),
      level: Math.random() < 0.95 ? randomChoice(['INFO', 'WARN', 'DEBUG']) : 'ERROR',
      message: `Normal operation log entry ${i}`,
      trace_id: `trace_${randomInt(100000, 999999)}`,
      user_id: Math.random() < 0.7 ? `user_${randomInt(1, 1000)}` : null,
      error_code: null,
      duration_ms: randomInt(10, 500),
    });
  }
  
  // Spike 1: Recent spike (last 3 minutes) - api-gateway ERROR in production
  const spike1Time = new Date(now.getTime() - 3 * 60 * 1000);
  for (let i = 0; i < 800; i++) {
    logs.push({
      '@timestamp': new Date(spike1Time.getTime() + randomInt(0, 180) * 1000).toISOString(),
      service: 'api-gateway',
      env: 'production',
      level: 'ERROR',
      message: `Connection timeout to downstream service`,
      trace_id: `trace_${randomInt(100000, 999999)}`,
      user_id: `user_${randomInt(1, 1000)}`,
      error_code: 'SYS_999',
      duration_ms: randomInt(5000, 15000),
    });
  }
  
  // Spike 2: auth-service ERROR in production (5-8 minutes ago)
  const spike2Time = new Date(now.getTime() - 6 * 60 * 1000);
  for (let i = 0; i < 600; i++) {
    logs.push({
      '@timestamp': new Date(spike2Time.getTime() + randomInt(0, 180) * 1000).toISOString(),
      service: 'auth-service',
      env: 'production',
      level: 'ERROR',
      message: 'Authentication token validation failed',
      trace_id: `trace_${randomInt(100000, 999999)}`,
      user_id: `user_${randomInt(1, 1000)}`,
      error_code: 'AUTH_001',
      duration_ms: randomInt(100, 2000),
    });
  }
  
  // Spike 3: billing-service ERROR in staging (10-12 minutes ago)
  const spike3Time = new Date(now.getTime() - 11 * 60 * 1000);
  for (let i = 0; i < 600; i++) {
    logs.push({
      '@timestamp': new Date(spike3Time.getTime() + randomInt(0, 120) * 1000).toISOString(),
      service: 'billing-service',
      env: 'staging',
      level: 'ERROR',
      message: 'Payment processing failed',
      trace_id: `trace_${randomInt(100000, 999999)}`,
      user_id: `user_${randomInt(1, 500)}`,
      error_code: 'BILL_002',
      duration_ms: randomInt(1000, 8000),
    });
  }
  
  // Sort by timestamp
  logs.sort((a, b) => new Date(a['@timestamp']).getTime() - new Date(b['@timestamp']).getTime());
  
  for (let i = 0; i < logs.length; i += BATCH_SIZE) {
    const batch = logs.slice(i, i + BATCH_SIZE);
    await bulkIndex('logs-app', batch);
  }
  
  console.log('✅ Logs indexed (including 3 error spikes)');
}

// Main execution
async function main() {
  console.log('🚀 Starting synthetic data generation...\n');
  
  try {
    // Check Elasticsearch connection
    const health = await client.cluster.health();
    console.log(`✅ Connected to Elasticsearch (status: ${health.status})\n`);
    
    await generateKBArticles();
    await generateResolutions();
    await generateTickets();
    await generateLogs();
    
    console.log('\n🎉 All synthetic data generated successfully!');
    console.log('📊 Summary:');
    console.log('   - 200 KB articles');
    console.log('   - 300 resolution cards');
    console.log('   - 2000 tickets (100 open)');
    console.log('   - 10k logs (with 3 error spikes in last 12 mins)');
    
  } catch (error) {
    console.error('❌ Error generating data:', error);
    process.exit(1);
  }
}

main();
