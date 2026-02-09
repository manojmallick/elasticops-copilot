import { Client } from '@elastic/elasticsearch';

const ELASTIC_MODE = process.env.ELASTIC_MODE || 'local';
const ELASTIC_CLOUD_ID = process.env.ELASTIC_CLOUD_ID;
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;
const ELASTIC_URL = process.env.ELASTIC_URL || 'http://localhost:9200';

// Singleton Elasticsearch client
let client: Client | null = null;

export function getElasticClient(): Client {
  if (!client) {
    const config: any = {};
    
    // Cloud mode: use Cloud ID + API key
    if (ELASTIC_MODE === 'cloud' && ELASTIC_CLOUD_ID && ELASTIC_API_KEY) {
      config.cloud = {
        id: ELASTIC_CLOUD_ID,
      };
      config.auth = {
        apiKey: ELASTIC_API_KEY,
      };
    } 
    // Local mode or fallback: use URL
    else {
      config.node = ELASTIC_URL;
      
      // Use API key if provided (for HTTPS endpoints without Cloud ID)
      if (ELASTIC_API_KEY && ELASTIC_URL.startsWith('https')) {
        config.auth = {
          apiKey: ELASTIC_API_KEY,
        };
      }
    }
    
    client = new Client(config);
  }
  return client;
}

export const esClient = getElasticClient();
