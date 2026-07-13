import { runQuery, getAuraDBDriver } from './auradb';

export interface ProviderReputation {
  wallet: string;
  successRate: number;
  settlementCount: number;
  volume: number;
  networkTrustScore: number;
}

export class ReputationService {
  async getLiquidityProviderReputation(wallet: string): Promise<ProviderReputation> {
    if (!getAuraDBDriver()) {
      // Fallback
      return { wallet, successRate: 100, settlementCount: 0, volume: 0, networkTrustScore: 100 };
    }

    // Advanced Multi-Hop Reputation Query
    // 1. Get base metrics
    // 2. Evaluate how many users trust this LP and how many of those users trust OTHER highly reputable LPs
    const query = `
      MATCH (lp:LiquidityProvider {wallet: $wallet})
      
      // Calculate Multi-Hop Network Trust
      // Find users who traded with this LP, and see if they traded with other high-success LPs
      OPTIONAL MATCH (lp)<-[:TRADED_WITH]-(u:User)-[:TRADED_WITH]->(otherLp:LiquidityProvider)
      WHERE otherLp.wallet <> lp.wallet AND otherLp.successRate > 90
      WITH lp, count(DISTINCT otherLp) as trustedNeighbors

      RETURN lp.successRate as successRate, 
             (lp.successCount + lp.failCount) as settlementCount,
             lp.totalVolume as volume,
             trustedNeighbors
    `;

    try {
      const results = await runQuery(query, { wallet });
      if (results.length > 0) {
        const trustedNeighbors = results[0].trustedNeighbors || 0;
        // Cap network trust boost at 100
        const networkTrustScore = Math.min(50 + (trustedNeighbors * 10), 100);

        return {
          wallet,
          successRate: results[0].successRate || 0,
          settlementCount: results[0].settlementCount || 0,
          volume: results[0].volume || 0,
          networkTrustScore
        };
      }
    } catch (err) {
      console.error('[ReputationService] Error fetching reputation:', err);
    }

    return { wallet, successRate: 100, settlementCount: 0, volume: 0, networkTrustScore: 100 };
  }
}
