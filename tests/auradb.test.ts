import { TrustService } from '../services/trust-infrastructure/trust.service';
import { ReputationService } from '../services/trust-infrastructure/reputation.service';
import { FraudService } from '../services/trust-infrastructure/fraud.service';

// Mock the Neo4j driver connection to run tests locally without a DB
jest.mock('../services/trust-infrastructure/auradb', () => ({
  getAuraDBDriver: () => null,
  runQuery: async () => [],
}));

describe('Trust Graph Intelligence', () => {
  let trustService: TrustService;
  let repService: ReputationService;
  let fraudService: FraudService;

  beforeEach(() => {
    trustService = new TrustService();
    repService = new ReputationService();
    fraudService = new FraudService();
  });

  it('calculates trust score safely when AuraDB is offline', async () => {
    const evalResult = await trustService.calculateFinalLiquidityProviderScore('0xTestWallet');
    
    // When offline, it should gracefully degrade and return a default score of 100
    expect(evalResult.trustScore).toBe(100);
    expect(evalResult.fraud.riskScore).toBe(0);
    expect(evalResult.reputation.successRate).toBe(100);
  });

  it('fetches reputation safely', async () => {
    const rep = await repService.getLiquidityProviderReputation('0xTestWallet');
    expect(rep.successRate).toBe(100);
    expect(rep.settlementCount).toBe(0);
    expect(rep.volume).toBe(0);
  });

  it('evaluates fraud safely', async () => {
    const fraud = await fraudService.evaluateFraudRisk('0xTestWallet');
    expect(fraud.riskScore).toBe(0);
    expect(fraud.reasons.length).toBe(0);
  });
});
