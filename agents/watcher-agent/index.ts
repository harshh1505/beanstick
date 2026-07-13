// agents/watcher-agent/index.ts
//
// WatcherAgent: Observes payment events from PSP webhooks and on-chain state.
// CRITICAL: This agent OBSERVES only — it does NOT release funds.
// It emits candidate payment observations to the AttestationAgent.

import { BaseAgent, AgentConfig } from '../runtime';
import { AXLMessage } from '../../protocol/axl/bridge';
import { ethers } from 'ethers';
import crypto from 'node:crypto';
import { SyncService } from '../../services/trust-infrastructure/sync.service';

export interface WatcherAgentConfig extends Omit<AgentConfig, 'role'> {
  escrowAddress: string;
  escrowRpcUrl: string;
  attestorPubkeys: string[];
  webhookSecret?: string;
}

export interface PaymentObservation {
  observationId: string;
  orderId: string;
  amount: string;
  currency: string;
  sender: string;
  receiver: string;
  transactionId: string;
  timestamp: number;
  rail: string;
  rawPayload: string;
  signatureHeader: string;
  signatureValid: boolean;
  observedAt: number;
  matchConfidence: number;
  state: 'candidate' | 'forwarded' | 'verified' | 'rejected';
}

export interface OrderState {
  orderId: number;
  buyer: string;
  lp: string;
  tokenAmount: bigint;
  fiatAmount: bigint;
  fiatCurrency: string;
  railType: string;
  deadline: number;
  state: number;
}

const ESCROW_ABI = [
  'function getLockedOrders() view returns (uint256[])',
  'function getOrder(uint256 orderId) view returns (tuple(uint256 id, address buyer, address lp, address token, uint256 tokenAmount, uint256 fiatAmount, string fiatCurrency, string railType, uint256 buyerBond, uint256 lpBond, uint256 deadline, uint8 state, bytes32 proofHash, bytes32 evidenceHash))',
  'event OrderLocked(uint256 indexed orderId, uint256 tokenAmount, uint256 deadline)',
  'event OrderReleased(uint256 indexed orderId, address indexed buyer, uint256 tokenAmount)',
  'event OrderExpired(uint256 indexed orderId, address slashed)',
  'event OrderDisputed(uint256 indexed orderId, address disputant)',
] as const;

export class WatcherAgent extends BaseAgent {
  private escrow: ethers.Contract;
  private escrowProvider: ethers.JsonRpcProvider;
  private observations: Map<string, PaymentObservation> = new Map();
  private watchedOrders: Map<number, OrderState> = new Map();
  private attestorPubkeys: string[];
  private webhookSecret: string;
  private pollInterval: NodeJS.Timeout | null = null;
  private syncService = new SyncService();

  constructor(config: WatcherAgentConfig) {
    super({ ...config, role: 'keeper' });
    this.escrowProvider = new ethers.JsonRpcProvider(config.escrowRpcUrl);
    this.escrow = new ethers.Contract(config.escrowAddress, ESCROW_ABI, this.escrowProvider);
    this.attestorPubkeys = config.attestorPubkeys;
    this.webhookSecret = config.webhookSecret || process.env.PAYMENT_WEBHOOK_SECRET || '';
  }

  protected setupMessageHandlers(): void {
    this.messageHandler.on('payment.webhook', async (msg: AXLMessage) => {
      await this.handleWebhookEvent(msg.data);
    });

    this.messageHandler.on('order.watch', async (msg: AXLMessage) => {
      await this.startWatchingOrder(msg.data.orderId);
    });
  }

  protected getStateSnapshot(): object {
    return {
      observations: Array.from(this.observations.entries()),
      watchedOrders: Array.from(this.watchedOrders.entries()),
    };
  }

  protected restoreState(state: any): void {
    if (state.observations) {
      this.observations = new Map(state.observations);
    }
    if (state.watchedOrders) {
      this.watchedOrders = new Map(state.watchedOrders);
    }
  }

  /**
   * Verify HMAC signature on incoming webhook payload.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const received = (signatureHeader || '').replace(/^sha256=/, '');
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(received, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Handle incoming webhook event. Creates an observation and forwards to attestors.
   * CRITICAL: Does NOT release funds — only observes and forwards.
   */
  async handleWebhookEvent(data: {
    rawPayload: string;
    signatureHeader: string;
    orderId: string;
    amount: string;
    currency: string;
    sender: string;
    receiver: string;
    transactionId: string;
    timestamp: number;
    rail: string;
  }): Promise<PaymentObservation> {
    const signatureValid = this.verifyWebhookSignature(data.rawPayload, data.signatureHeader);

    const observation: PaymentObservation = {
      observationId: `obs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      orderId: data.orderId,
      amount: data.amount,
      currency: data.currency,
      sender: data.sender,
      receiver: data.receiver,
      transactionId: data.transactionId,
      timestamp: data.timestamp,
      rail: data.rail,
      rawPayload: data.rawPayload,
      signatureHeader: data.signatureHeader,
      signatureValid,
      observedAt: Date.now(),
      matchConfidence: signatureValid ? 100 : 0,
      state: 'candidate',
    };

    this.observations.set(observation.observationId, observation);
    this.logDecision('payment.observed', {
      observationId: observation.observationId,
      orderId: observation.orderId,
      signatureValid,
    });

    console.log(`[${this.config.name}] Payment observed: ${observation.observationId} sig=${signatureValid ? '✓' : '✗'}`);

    if (signatureValid) {
      await this.forwardToAttestors(observation);
    } else {
      observation.state = 'rejected';
      console.warn(`[${this.config.name}] Rejected observation ${observation.observationId}: invalid signature`);
      this.syncService.syncRiskSignal({
        orderId: data.orderId,
        reason: 'invalid_webhook_signature',
        severity: 'high'
      }).catch(console.error);
    }

    return observation;
  }

  /**
   * Forward observation to all registered attestors via AXL.
   * The attestor will validate and potentially submit release evidence.
   */
  private async forwardToAttestors(observation: PaymentObservation): Promise<void> {
    observation.state = 'forwarded';

    for (const attestorPubkey of this.attestorPubkeys) {
      try {
        await this.axl.send(attestorPubkey, {
          type: 'payment.observed',
          observation,
          watcherPubkey: await this.getAXLPublicKey(),
        });
        console.log(`[${this.config.name}] Forwarded ${observation.observationId} to attestor ${attestorPubkey.slice(0, 16)}...`);
      } catch (err) {
        console.error(`[${this.config.name}] Failed to forward to attestor:`, err);
      }
    }
  }

  /**
   * Start watching an order for state changes.
   */
  async startWatchingOrder(orderId: number): Promise<void> {
    const order = await this.fetchOrderState(orderId);
    if (order) {
      this.watchedOrders.set(orderId, order);
      console.log(`[${this.config.name}] Now watching order ${orderId}`);
    }
  }

  /**
   * Fetch current order state from escrow contract.
   */
  async fetchOrderState(orderId: number): Promise<OrderState | null> {
    try {
      const order = await this.escrow.getOrder(orderId);
      return {
        orderId: Number(order.id),
        buyer: order.buyer,
        lp: order.lp,
        tokenAmount: order.tokenAmount,
        fiatAmount: order.fiatAmount,
        fiatCurrency: order.fiatCurrency,
        railType: order.railType,
        deadline: Number(order.deadline),
        state: order.state,
      };
    } catch (err) {
      console.error(`[${this.config.name}] Failed to fetch order ${orderId}:`, err);
      return null;
    }
  }

  /**
   * Poll escrow for order state changes. Runs periodically.
   */
  async pollEscrowState(): Promise<void> {
    try {
      const lockedOrders = await this.escrow.getLockedOrders();

      for (const orderId of lockedOrders) {
        const id = Number(orderId);
        const current = await this.fetchOrderState(id);
        const previous = this.watchedOrders.get(id);

        if (current && (!previous || previous.state !== current.state)) {
          this.watchedOrders.set(id, current);
          this.logDecision('order.state_change', {
            orderId: id,
            previousState: previous?.state,
            newState: current.state,
          });
          console.log(`[${this.config.name}] Order ${id} state: ${previous?.state ?? 'new'} → ${current.state}`);
        }
      }
    } catch (err) {
      console.error(`[${this.config.name}] Escrow poll failed:`, err);
    }
  }

  /**
   * Start the watcher polling loop.
   */
  async start(): Promise<void> {
    await super.start();

    this.pollInterval = setInterval(async () => {
      await this.pollEscrowState();
    }, 15000);

    console.log(`[${this.config.name}] Polling escrow every 15s`);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    super.stop();
  }

  /**
   * Get observation by ID.
   */
  getObservation(observationId: string): PaymentObservation | undefined {
    return this.observations.get(observationId);
  }

  /**
   * Get all observations for an order.
   */
  getObservationsForOrder(orderId: string): PaymentObservation[] {
    return Array.from(this.observations.values())
      .filter(o => o.orderId === orderId);
  }

  /**
   * Mark observation as verified (called by attestor via AXL).
   */
  markVerified(observationId: string): void {
    const obs = this.observations.get(observationId);
    if (obs) {
      obs.state = 'verified';
      this.logDecision('observation.verified', { observationId });
    }
  }

  /**
   * Mark observation as rejected.
   */
  markRejected(observationId: string, reason: string): void {
    const obs = this.observations.get(observationId);
    if (obs) {
      obs.state = 'rejected';
      this.logDecision('observation.rejected', { observationId, reason });
    }
  }
}
