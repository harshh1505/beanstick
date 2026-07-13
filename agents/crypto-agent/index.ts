// agents/crypto-agent/index.ts
import { BaseAgent, AgentConfig } from '../runtime/index';
import { RfqGet, QuoteSign, FiatDetails } from '../../protocol/mcp/schemas';
import { ethers } from 'ethers';

interface CryptoAgentConfig extends Omit<AgentConfig, 'role'> {
  inventory: {
    token: string;
    balance: string;
    minOrder: string;
  }[];
  spreadBps: number;
  supportedRails: string[];
  fiatDetails: Record<string, any>;
}

export class CryptoAgent extends BaseAgent {
  private lpConfig: CryptoAgentConfig;
  private activeOrders: Map<string, any> = new Map();
  private computeReady = false;

  constructor(config: CryptoAgentConfig) {
    super({ ...config, role: 'lp' });
    this.lpConfig = config;
  }

  async initialize(): Promise<void> {
    await super.initialize();
    // Compute is now initialized by BaseAgent.attestSelf()
    this.computeReady = this.getAttestation()?.verified ?? false;
  }

  protected setupMessageHandlers(): void {
    this.messageHandler.on('rfq.get', async (msg) => {
      const rfqId = msg.data.rfqId as string;
      const rfq = msg.data as RfqGet;
      console.log(`[CryptoAgent] Received RFQ ${rfqId} from ${rfq.buyerAgent}`);
      this.logDecision('rfq.received', { rfqId, buyerAgent: rfq.buyerAgent, intent: rfq.intent });

      const quote = await this.generateQuote(rfq, rfqId);
      if (quote) {
        await this.axl.send(rfq.buyerAgent, { type: 'quote.sign', ...quote });
        this.logDecision('quote.sent', { rfqId, buyerAgent: rfq.buyerAgent, rate: quote.rate });
        await this.saveState();
      }
    });

    this.messageHandler.on('order.commit', async (msg) => {
      const commit = msg.data;
      console.log(`[CryptoAgent] Order committed: ${commit.quoteId}`);
      this.logDecision('order.committed', { quoteId: commit.quoteId, buyerAgent: commit.buyerAgent });

      const details: FiatDetails = {
        orderId: commit.quoteId,
        railType: commit.selectedRail,
        encryptedDetails: await this.encryptFiatDetails(
          commit.buyerAgent,
          this.lpConfig.fiatDetails[commit.selectedRail]
        ),
        nonce: ethers.hexlify(ethers.randomBytes(24)),
      };

      await this.axl.send(commit.buyerAgent, { type: 'fiat.details', ...details });
      await this.saveState();
    });

    this.messageHandler.on('proof.submit', async (msg) => {
      console.log(`[CryptoAgent] Proof submitted for order ${msg.data.orderId}`);
      this.logDecision('proof.received', { orderId: msg.data.orderId });
    });
  }

  protected getStateSnapshot(): object {
    const ordersObj: Record<string, any> = {};
    this.activeOrders.forEach((v, k) => { ordersObj[k] = v; });
    return {
      activeOrders: ordersObj,
      inventory: this.lpConfig.inventory,
      spreadBps: this.lpConfig.spreadBps,
    };
  }

  protected restoreState(state: any): void {
    if (state.activeOrders) {
      this.activeOrders = new Map(Object.entries(state.activeOrders));
    }
  }

  private async generateQuote(rfq: RfqGet, rfqId: string): Promise<QuoteSign | null> {
    const matchedRails = rfq.intent.rails.filter(r =>
      this.lpConfig.supportedRails.includes(r)
    );
    if (matchedRails.length === 0) {
      console.log('[CryptoAgent] No matching rails');
      return null;
    }

    const baseRate = await this.getMarketRate(rfq.intent.fromCurrency, rfq.intent.toCurrency);
    if (baseRate === 0) {
      console.log(`[CryptoAgent] No rate for ${rfq.intent.fromCurrency}-${rfq.intent.toCurrency}`);
      return null;
    }

    let rateWithSpread = baseRate * (1 - this.lpConfig.spreadBps / 10000);
    const outputAmount = parseFloat(rfq.intent.amount) * rateWithSpread;

    // Check inventory against OUTPUT amount (crypto), not input (fiat)
    const canFulfill = this.checkInventory(rfq.intent.toCurrency, outputAmount.toString());
    if (!canFulfill) {
      console.log(`[CryptoAgent] Insufficient inventory for ${outputAmount} ${rfq.intent.toCurrency}`);
      return null;
    }

    // Use 0G Compute for verifiable pricing decision (optional - doesn't block quote)
    let verificationId = `local-${Date.now()}`;
    if (this.computeReady) {
      try {
        const result = await this.compute.makeVerifiableDecision(
          'Determine optimal spread for this trade based on market conditions and risk.',
          {
            baseRate,
            spreadBps: this.lpConfig.spreadBps,
            intent: rfq.intent,
            inventory: this.lpConfig.inventory,
          }
        );
        verificationId = result.chatId;

        if (result.decision?.adjustedSpreadBps) {
          const adjustedSpread = Math.min(Math.max(result.decision.adjustedSpreadBps, 10), 200);
          rateWithSpread = baseRate * (1 - adjustedSpread / 10000);
        }

        console.log(`[CryptoAgent] Quote verified via 0G Compute: ${verificationId}`);
        this.logDecision('quote.verified', { verificationId, verified: result.verified });
      } catch (err: any) {
        console.warn('[CryptoAgent] 0G Compute skipped:', err.message?.slice(0, 50));
      }
    }

    const quote: QuoteSign = {
      rfqId,
      lpAgent: await this.getAXLPublicKey(),
      rate: rateWithSpread.toFixed(8),
      outputAmount: outputAmount.toFixed(8),
      fee: (parseFloat(rfq.intent.amount) * 0.005).toFixed(2),
      rails: matchedRails,
      expiry: Date.now() + 60000,
      signature: verificationId,
      reputation: 85,
    };

    return quote;
  }

  private checkInventory(currency: string, amount: string): boolean {
    const inv = this.lpConfig.inventory.find(i =>
      i.token.toLowerCase() === currency.toLowerCase()
    );
    if (!inv) return false;
    return parseFloat(inv.balance) >= parseFloat(amount);
  }

  private async getMarketRate(from: string, to: string): Promise<number> {
    const rates: Record<string, number> = {
      'USD-ETH': 0.00035,
      'USD-USDC': 1.0,
      'INR-ETH': 0.0000042,  // ~84 INR per USD, ~2400 USD per ETH
      'INR-USDC': 0.012,     // ~84 INR per USDC
    };
    return rates[`${from}-${to}`] || 0;
  }

  private async encryptFiatDetails(buyerPubkey: string, details: any): Promise<string> {
    return Buffer.from(JSON.stringify(details)).toString('base64');
  }

  // Direct quote generation (bypasses AXL for server-side calls)
  async generateQuoteDirectly(intent: any, rfqId: string): Promise<QuoteSign | null> {
    const rfq: RfqGet = {
      intent,
      buyerAgent: 'direct',
      timestamp: Date.now(),
      ttl: 60,
    };
    return this.generateQuote(rfq, rfqId);
  }
}
