// agents/fiat-agent/index.ts
import { BaseAgent, AgentConfig } from '../runtime/index';
import { RfqGet, QuoteSign, OrderCommit } from '../../protocol/mcp/schemas';
import { simulatePayment } from '../payment-verify/banksim';
import type { PaymentWebhookPayload } from '../payment-verify/webhook';
import { TrustService } from '../../services/trust-infrastructure/trust.service';

interface FiatAgentConfig extends Omit<AgentConfig, 'role'> {
  supportedRails: string[];
  demoMode: boolean;
  webhookUrl: string;
}

export class FiatAgent extends BaseAgent {
  private fiatConfig: FiatAgentConfig;
  private pendingQuotes: Map<string, QuoteSign[]> = new Map();
  private trustService = new TrustService();

  constructor(config: FiatAgentConfig) {
    super({ ...config, role: 'buyer' });
    this.fiatConfig = config;
  }

  protected setupMessageHandlers(): void {
    this.messageHandler.on('quote.sign', async (msg) => {
      const quote = msg.data as QuoteSign;
      console.log(`[FiatAgent] Received quote from ${quote.lpAgent}: ${quote.rate}`);

      const quotes = this.pendingQuotes.get(quote.rfqId) || [];
      quotes.push(quote);
      this.pendingQuotes.set(quote.rfqId, quotes);
      this.logDecision('quote.received', { lpAgent: quote.lpAgent, rate: quote.rate });
    });

    this.messageHandler.on('fiat.details', async (msg) => {
      console.log(`[FiatAgent] Received fiat details for order ${msg.data.orderId}`);
      this.logDecision('fiat.details.received', { orderId: msg.data.orderId });
    });
  }

  protected getStateSnapshot(): object {
    const quotesObj: Record<string, QuoteSign[]> = {};
    this.pendingQuotes.forEach((v, k) => { quotesObj[k] = v; });
    return {
      pendingQuotes: quotesObj,
      supportedRails: this.fiatConfig.supportedRails,
    };
  }

  protected restoreState(state: any): void {
    if (state.pendingQuotes) {
      this.pendingQuotes = new Map(Object.entries(state.pendingQuotes));
    }
  }

  async broadcastRfq(intent: RfqGet['intent'], lpPubkeys: string[]): Promise<string> {
    const rfqId = `rfq_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const rfq: RfqGet = {
      intent,
      buyerAgent: await this.getAXLPublicKey(),
      timestamp: Date.now(),
      ttl: 60,
    };

    console.log(`[FiatAgent] Broadcasting RFQ to ${lpPubkeys.length} LPs: ${JSON.stringify(intent)}`);

    this.pendingQuotes.set(rfqId, []);

    for (const lpPubkey of lpPubkeys) {
      try {
        await this.axl.send(lpPubkey, { type: 'rfq.get', rfqId, ...rfq });
      } catch (err) {
        console.error(`[FiatAgent] Failed to send RFQ to ${lpPubkey}:`, err);
      }
    }

    return rfqId;
  }

  getQuotesForRfq(rfqId: string): QuoteSign[] {
    return this.pendingQuotes.get(rfqId) || [];
  }

  addQuote(rfqId: string, quote: QuoteSign): void {
    const quotes = this.pendingQuotes.get(rfqId) || [];
    quotes.push(quote);
    this.pendingQuotes.set(rfqId, quotes);
    console.log(`[FiatAgent] Added quote for ${rfqId}: ${quote.rate}`);
  }

  async commitToQuote(quote: QuoteSign): Promise<void> {
    const commit = {
      quoteId: quote.rfqId,
      buyerAgent: await this.getAXLPublicKey(),
      lpAgent: quote.lpAgent,
      selectedRail: quote.rails[0],
      antiGriefBondTx: '',
      timestamp: Date.now(),
    };

    console.log(`[FiatAgent] Committing to quote from ${quote.lpAgent}`);
    await this.axl.send(quote.lpAgent, { type: 'order.commit', ...commit });
  }

  async selectQuoteAndCommit(rfqId: string): Promise<OrderCommit | null> {
    const quotes = this.pendingQuotes.get(rfqId);
    if (!quotes || quotes.length === 0) {
      console.log('[FiatAgent] No quotes received');
      return null;
    }

    const scored = await Promise.all(quotes.map(async (q) => {
      // Calculate AuraDB Trust Score
      const trustEval = await this.trustService.calculateFinalLiquidityProviderScore(q.lpAgent);
      
      // Original logic: score = rate * (reputation / 100)
      // New logic: incorporate TrustScore directly
      const rateScore = parseFloat(q.rate);
      const trustScore = trustEval.trustScore / 100;
      
      // Weighting: 70% Price, 30% Trust
      // Since price scales linearly, we blend them. For simplicity, we just multiply.
      const finalScore = rateScore * trustScore;

      return {
        quote: q,
        score: finalScore,
        trustInfo: trustEval
      };
    }));

    scored.sort((a, b) => b.score - a.score);
    const bestQuote = scored[0].quote;

    console.log(`[FiatAgent] Selected quote from ${bestQuote.lpAgent} (Score: ${scored[0].score.toFixed(4)}, Trust: ${scored[0].trustInfo.trustScore.toFixed(2)})`);

    const commit: OrderCommit = {
      quoteId: bestQuote.rfqId,
      buyerAgent: await this.getAXLPublicKey(),
      lpAgent: bestQuote.lpAgent,
      selectedRail: bestQuote.rails[0],
      antiGriefBondTx: '',
      timestamp: Date.now(),
    };

    await this.axl.send(bestQuote.lpAgent, { type: 'order.commit', ...commit });

    return commit;
  }

  async submitPaymentProof(
    orderId: string,
    amount: string,
    currency: string,
    railType: string,
    receiverHandle: string,
    senderHandle: string
  ): Promise<string> {
    console.log(`[FiatAgent] Awaiting payment for order ${orderId}`);
    console.log(`[FiatAgent] Pay ${amount} ${currency} via ${railType} to ${receiverHandle}`);
    console.log(`[FiatAgent] Include memo: orderId=${orderId}`);

    if (this.fiatConfig.demoMode) {
      const payload: PaymentWebhookPayload = {
        orderId,
        amount,
        currency,
        sender: senderHandle,
        receiver: receiverHandle,
        transactionId: `tx_${orderId}`,
        timestamp: Math.floor(Date.now() / 1000),
        rail: railType as any,
      };
      await simulatePayment(this.fiatConfig.webhookUrl, payload);
    }

    const rootHash = await this.waitForEscrowRelease(orderId);
    console.log(`[FiatAgent] Escrow released. Evidence hash: ${rootHash}`);

    return rootHash;
  }

  private async waitForEscrowRelease(
    orderId: string,
    timeoutMs: number = 600_000
  ): Promise<string> {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(process.env.ZEROG_TESTNET_RPC!);
    const escrow = new ethers.Contract(
      process.env.ESCROW_ADDRESS!,
      ['event Released(bytes32 indexed orderId, bytes32 evidenceHash)'],
      provider
    );
    const orderHash = ethers.id(orderId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Escrow release timeout')),
        timeoutMs
      );
      escrow.on('Released', (id: string, evidenceHash: string) => {
        if (id === orderHash) {
          clearTimeout(timeout);
          escrow.removeAllListeners('Released');
          resolve(evidenceHash);
        }
      });
    });
  }
}
