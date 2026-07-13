import { GraphService } from './graph.service';

export class SyncService {
  private graphService = new GraphService();

  /**
   * Synchronizes a successful settlement event to AuraDB.
   */
  async syncSettlement(data: {
    userWallet: string;
    lpWallet: string;
    settlementId: string;
    amount: number;
    railType: string;
    fiatAgentId: string;
    cryptoAgentId: string;
  }) {
    const start = Date.now();
    try {
      await this.graphService.ingestSettlementEvent({
        ...data,
        status: 'COMPLETED'
      });
      console.log(`[AuraDB-Sync] Settled ${data.settlementId} synced to graph in ${Date.now() - start}ms`);
    } catch (err: any) {
      console.error(`[AuraDB-Sync] Failed to sync settlement ${data.settlementId}:`, err.message);
    }
  }

  /**
   * Synchronizes a failed settlement event to AuraDB.
   */
  async syncFailure(data: {
    userWallet: string;
    lpWallet: string;
    settlementId: string;
    amount: number;
    railType: string;
    fiatAgentId: string;
    cryptoAgentId: string;
  }) {
    const start = Date.now();
    try {
      await this.graphService.ingestSettlementEvent({
        ...data,
        status: 'FAILED'
      });
      console.log(`[AuraDB-Sync] Failure ${data.settlementId} synced to graph in ${Date.now() - start}ms`);
    } catch (err: any) {
      console.error(`[AuraDB-Sync] Failed to sync failure ${data.settlementId}:`, err.message);
    }
  }

  /**
   * Synchronizes a risk signal (e.g. invalid webhook signature) to AuraDB.
   */
  async syncRiskSignal(data: {
    orderId: string;
    reason: string;
    severity: string;
  }) {
    const start = Date.now();
    try {
      // Stub implementation: In a full system this would create a RiskSignal node connected to the order/LP
      console.log(`[AuraDB-Sync] Risk signal for ${data.orderId} (${data.reason}) synced in ${Date.now() - start}ms`);
    } catch (err: any) {
      console.error(`[AuraDB-Sync] Failed to sync risk signal ${data.orderId}:`, err.message);
    }
  }
}
