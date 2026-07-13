import neo4j, { Driver } from 'neo4j-driver';

let driver: Driver | null = null;
let isHealthy = false;

export function getAuraDBDriver(): Driver | null {
  if (driver) return driver;

  const uri = process.env.AURADB_URI || process.env.NEO4J_URI;
  const user = process.env.AURADB_USERNAME || process.env.NEO4J_USERNAME;
  const password = process.env.AURADB_PASSWORD || process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    return null;
  }

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 20000
    });
    isHealthy = true;
    return driver;
  } catch (error) {
    console.error('[Web AuraDB] Failed to initialize driver:', error);
    isHealthy = false;
    return null;
  }
}

export function checkAuraDBHealth(): boolean {
  return isHealthy;
}

export async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      const backoffMs = Math.pow(2, attempt) * 500 + Math.random() * 200;
      await new Promise(res => setTimeout(res, backoffMs));
    }
  }
  throw new Error('Unreachable');
}

export async function runQuery<T = any>(query: string, params: any = {}): Promise<T[]> {
  const d = getAuraDBDriver();
  if (!d) return [];

  return withRetry(async () => {
    const session = d.session();
    try {
      const result = await session.run(query, params);
      return result.records.map(record => record.toObject()) as T[];
    } finally {
      await session.close();
    }
  }).catch(error => {
    console.error('[Web AuraDB] Query execution failed after retries:', error.message);
    return [];
  });
}
