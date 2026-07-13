import { runQuery, getAuraDBDriver } from './auradb';

export interface FraudInsights {
  riskScore: number;
  reasons: string[];
}

export class FraudService {
  async evaluateFraudRisk(wallet: string): Promise<FraudInsights> {
    if (!getAuraDBDriver()) {
      return { riskScore: 0, reasons: [] };
    }

    let riskScore = 0;
    const reasons: string[] = [];

    try {
      // 1. High Failure Rate Check
      const failureQuery = `
        MATCH (lp:LiquidityProvider {wallet: $wallet})
        RETURN lp.failCount as failCount, lp.successCount as successCount
      `;
      const fails = await runQuery(failureQuery, { wallet });
      if (fails.length > 0) {
        const { failCount, successCount } = fails[0];
        const total = failCount + successCount;
        if (total > 5 && failCount / total > 0.3) {
          riskScore += 40;
          reasons.push('High rate of failed settlements (>30%)');
        }
      }

      // 2. Circular Trading Detection (A -> B -> A)
      const circularQuery = `
        MATCH (lp:LiquidityProvider {wallet: $wallet})<-[:TRADED_WITH]-(u:User)-[:TRADED_WITH]->(other:LiquidityProvider)
        WHERE lp.wallet <> other.wallet
        WITH lp, other, count(u) as sharedUsers
        WHERE sharedUsers > 5
        RETURN sharedUsers
      `;
      const circular = await runQuery(circularQuery, { wallet });
      if (circular.length > 0) {
        riskScore += 30;
        reasons.push('Suspicious clustering detected (high density of shared counterparty trading)');
      }

      // 3. Suspicious LP Rings (Isolated networks)
      const ringQuery = `
        MATCH (lp:LiquidityProvider {wallet: $wallet})<-[:TRADED_WITH]-(u:User)
        WITH lp, collect(u) as users
        MATCH (other:LiquidityProvider)<-[:TRADED_WITH]-(u2:User)
        WHERE u2 IN users AND other.wallet <> lp.wallet
        WITH lp, other, count(u2) as overlap
        WHERE overlap > 10
        RETURN other.wallet as ringMember
      `;
      const rings = await runQuery(ringQuery, { wallet });
      if (rings.length > 3) {
        riskScore += 25;
        reasons.push('Possible reputation manipulation (detected dense isolated LP ring)');
      }
      
    } catch (err) {
      console.error('[FraudService] Error evaluating risk:', err);
    }

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    return { riskScore, reasons };
  }
}
