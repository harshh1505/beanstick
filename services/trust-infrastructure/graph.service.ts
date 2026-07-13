import { getAuraDBDriver, runQuery } from './auradb';

export class GraphService {
  async initializeSchema() {
    const driver = getAuraDBDriver();
    if (!driver) {
      console.warn('[GraphService] Skipping schema init: AuraDB not configured.');
      return;
    }

    console.log('[GraphService] Initializing graph schema & constraints...');
    
    // Constraints to enforce uniqueness and optimize lookups
    const constraints = [
      'CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.wallet IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (lp:LiquidityProvider) REQUIRE lp.wallet IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (s:Settlement) REQUIRE s.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (p:PaymentRail) REQUIRE p.type IS UNIQUE',
    ];

    for (const query of constraints) {
      try {
        await runQuery(query);
      } catch (err: any) {
        console.error(`[GraphService] Constraint failed: ${err.message}`);
      }
    }
    
    // Seed essential nodes (like standard Payment Rails)
    try {
      await runQuery(`
        MERGE (:PaymentRail {type: 'banksim'})
        MERGE (:PaymentRail {type: 'upi'})
        MERGE (:PaymentRail {type: 'venmo'})
        MERGE (:PaymentRail {type: 'transak'})
      `);
    } catch (err: any) {
      console.error(`[GraphService] Seeding failed: ${err.message}`);
    }

    console.log('[GraphService] Schema init complete.');
  }

  async ingestSettlementEvent(data: {
    userWallet: string;
    lpWallet: string;
    settlementId: string;
    amount: number;
    status: 'COMPLETED' | 'FAILED';
    railType: string;
    fiatAgentId: string;
    cryptoAgentId: string;
  }) {
    if (!getAuraDBDriver()) return;

    console.log(`[GraphService] Ingesting settlement ${data.settlementId} into graph...`);

    const query = `
      // 1. Ensure User & LP nodes exist
      MERGE (u:User {wallet: $userWallet})
        ON CREATE SET u.createdAt = timestamp()
        
      MERGE (lp:LiquidityProvider {wallet: $lpWallet})
        ON CREATE SET lp.totalVolume = 0.0, lp.successCount = 0, lp.failCount = 0

      // 2. Ensure Agents exist
      MERGE (fa:Agent {id: $fiatAgentId})
        ON CREATE SET fa.type = 'FiatAgent'
        
      MERGE (ca:Agent {id: $cryptoAgentId})
        ON CREATE SET ca.type = 'CryptoAgent'

      // 3. Ensure Rail exists
      MERGE (r:PaymentRail {type: $railType})

      // 4. Create Settlement Node
      MERGE (s:Settlement {id: $settlementId})
        ON CREATE SET s.amount = $amount, s.status = $status, s.timestamp = timestamp()

      // 5. Build Relationships
      MERGE (u)-[:TRADED_WITH]->(lp)
      MERGE (lp)-[:COMPLETED]->(s)
      MERGE (s)-[:USED]->(r)
      MERGE (fa)-[:VERIFIED]->(s)
      MERGE (ca)-[:VERIFIED]->(s)

      // 6. Update LP Stats
      WITH lp, s
      CALL apoc.do.when(
        s.status = 'COMPLETED',
        'SET lp.totalVolume = lp.totalVolume + amount, lp.successCount = lp.successCount + 1 RETURN lp',
        'SET lp.failCount = lp.failCount + 1 RETURN lp',
        {lp: lp, amount: s.amount}
      ) YIELD value
      RETURN value
    `;

    // Note: The apoc.do.when requires APOC. If APOC isn't guaranteed, we can do it with plain Cypher:
    const safeQuery = `
      MERGE (u:User {wallet: $userWallet})
        ON CREATE SET u.createdAt = timestamp()
        
      MERGE (lp:LiquidityProvider {wallet: $lpWallet})
        ON CREATE SET lp.totalVolume = 0.0, lp.successCount = 0, lp.failCount = 0

      MERGE (fa:Agent {id: $fiatAgentId})
        ON CREATE SET fa.type = 'FiatAgent'
        
      MERGE (ca:Agent {id: $cryptoAgentId})
        ON CREATE SET ca.type = 'CryptoAgent'

      MERGE (r:PaymentRail {type: $railType})

      MERGE (s:Settlement {id: $settlementId})
        ON CREATE SET s.amount = $amount, s.status = $status, s.timestamp = timestamp()

      MERGE (u)-[:TRADED_WITH]->(lp)
      MERGE (lp)-[:COMPLETED]->(s)
      MERGE (s)-[:USED]->(r)
      MERGE (fa)-[:VERIFIED]->(s)
      MERGE (ca)-[:VERIFIED]->(s)

      // Manual conditional updates without APOC
      SET lp.totalVolume = lp.totalVolume + CASE WHEN $status = 'COMPLETED' THEN $amount ELSE 0 END
      SET lp.successCount = lp.successCount + CASE WHEN $status = 'COMPLETED' THEN 1 ELSE 0 END
      SET lp.failCount = lp.failCount + CASE WHEN $status = 'FAILED' THEN 1 ELSE 0 END
      
      // Compute successRate dynamically or keep it updated
      SET lp.successRate = CASE 
        WHEN (lp.successCount + lp.failCount) > 0 
        THEN (tofloat(lp.successCount) / (lp.successCount + lp.failCount)) * 100 
        ELSE 100.0 END
    `;

    try {
      await runQuery(safeQuery, data);
      console.log(`[GraphService] Ingestion of ${data.settlementId} complete.`);
    } catch (err: any) {
      console.error(`[GraphService] Failed to ingest settlement: ${err.message}`);
    }
  }
}
