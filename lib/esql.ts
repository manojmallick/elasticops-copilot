import { esClient } from './elastic';

/**
 * Execute ES|QL query for spike detection on logs-app index
 * Detects ERROR spikes in the last 5 minutes (>= 40 errors per service+env)
 */
export async function detectLogSpikes() {
  const query = `
    FROM logs-app
    | WHERE @timestamp >= NOW() - 5 minutes
    | WHERE level == "ERROR"
    | STATS errors = COUNT(*) BY service, env
    | WHERE errors >= 40
    | SORT errors DESC
  `;

  try {
    const response = await esClient.transport.request({
      method: 'POST',
      path: '/_query',
      body: {
        query,
      },
    });

    return response;
  } catch (error) {
    console.error('ES|QL query error:', error);
    throw error;
  }
}

/**
 * Execute custom ES|QL query
 */
export async function executeESQL(query: string) {
  try {
    const response = await esClient.transport.request({
      method: 'POST',
      path: '/_query',
      body: { query },
    });

    return response;
  } catch (error) {
    console.error('ES|QL query error:', error);
    throw error;
  }
}
