import neo4j, { Driver } from 'neo4j-driver';
import 'dotenv/config';

let driver: Driver | null = null;
let isHealthy = false;

/**
 * Initializes the AuraDB Driver with production-grade Connection Pooling.
 */
export function getAuraDBDriver(): Driver | null {
  if (driver) return driver;

  const uri = process.env.AURADB_URI || process.env.NEO4J_URI;
  const user = process.env.AURADB_USERNAME || process.env.NEO4J_USERNAME;
  const password = process.env.AURADB_PASSWORD || process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    console.warn('[AuraDB] Credentials missing. Trust Infrastructure degraded. System will fallback to local/flat scores.');
    return null;
  }

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 20000,
      maxConnectionLifetime: 3600000, // 1 hour
      maxTransactionRetryTime: 15000, // built-in transaction retry
      logging: {
        level: 'warn',
        logger: (level, message) => console.log(`[AuraDB-Driver-${level}] ${message}`)
      }
    });
    console.log('[AuraDB] Connection pool initialized.');
    return driver;
  } catch (error: any) {
    console.error('[AuraDB] Failed to initialize AuraDB driver:', error.message);
    return null;
  }
}

/**
 * Validates the connection on startup without crashing.
 */
export async function verifyConnectivity(): Promise<boolean> {
  const d = getAuraDBDriver();
  if (!d) return false;

  try {
    const serverInfo = await d.getServerInfo();
    console.log(`[AuraDB] Successfully connected to AuraDB instance at ${serverInfo.address}`);
    isHealthy = true;
    return true;
  } catch (err: any) {
    console.warn(`[AuraDB] Startup connectivity check failed: ${err.message}. System will run in degraded mode.`);
    isHealthy = false;
    return false;
  }
}

export function checkAuraDBHealth(): boolean {
  return isHealthy;
}

export async function closeAuraDBDriver() {
  if (driver) {
    await driver.close();
    driver = null;
    isHealthy = false;
    console.log('[AuraDB] Driver closed.');
  }
}

/**
 * Utility function to wrap an operation with exponential backoff.
 */
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
      console.warn(`[AuraDB] Operation failed (${error.message}). Retrying in ${Math.round(backoffMs)}ms... (Attempt ${attempt}/${maxRetries})`);
      await new Promise(res => setTimeout(res, backoffMs));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Executes a Cypher query with exponential backoff and structured observability.
 */
export async function runQuery<T = any>(query: string, params: any = {}): Promise<T[]> {
  const d = getAuraDBDriver();
  if (!d) return [];

  const start = Date.now();
  return withRetry(async () => {
    const session = d.session();
    try {
      const result = await session.run(query, params);
      const latency = Date.now() - start;
      console.log(`[AuraDB] Query execution OK (latency: ${latency}ms)`);
      return result.records.map(record => record.toObject()) as T[];
    } finally {
      await session.close();
    }
  }).catch(error => {
    const latency = Date.now() - start;
    console.error(`[AuraDB] Query execution FAILED after retries (latency: ${latency}ms):`, error.message);
    return [];
  });
}
