import { ReputationService } from './reputation.service';
import { FraudService } from './fraud.service';
import { getAuraDBDriver } from './auradb';

export interface TrustEvaluation {
  trustScore: number;
  reputation: any;
  fraud: any;
}

export class TrustService {
  private repService = new ReputationService();
  private fraudService = new FraudService();

  async calculateFinalLiquidityProviderScore(lpWallet: string): Promise<TrustEvaluation> {
    if (!getAuraDBDriver()) {
      // Graceful fallback for Fiat Agent if AuraDB is offline
      return {
        trustScore: 100, // perfect score to fall back to purely price-based logic
        reputation: { successRate: 100, settlementCount: 0, volume: 0, networkTrustScore: 100 },
        fraud: { riskScore: 0, reasons: [] }
      };
    }

    const start = Date.now();
    const rep = await this.repService.getLiquidityProviderReputation(lpWallet);
    const fraud = await this.fraudService.evaluateFraudRisk(lpWallet);

    // Formula:
    // 40% Settlement Reliability (successRate)
    // 25% Volume (normalized, simplified for now: 100 points if volume > 1000)
    // 20% Network Reputation (multi-hop trust)
    // 15% Fraud Risk (inverse of riskScore)

    const volumeScore = Math.min((rep.volume / 1000) * 100, 100);
    const networkScore = rep.networkTrustScore;
    
    // Invert fraud risk (0 risk = 100 points, 100 risk = 0 points)
    const fraudScore = 100 - fraud.riskScore;

    const trustScore = 
      (rep.successRate * 0.40) + 
      (volumeScore * 0.25) + 
      (networkScore * 0.20) + 
      (fraudScore * 0.15);

    console.log(`[AuraDB-Trust] Generated score for ${lpWallet}: ${trustScore.toFixed(2)} (Latency: ${Date.now() - start}ms)`);

    return {
      trustScore,
      reputation: rep,
      fraud
    };
  }
}
