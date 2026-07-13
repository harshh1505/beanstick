// agents/attestation-agent/index.ts
//
// AttestationAgent: Validates payment observations and generates release evidence.
// This agent transforms raw payment events into escrow-acceptable evidence.
// It has NO discretionary power beyond evidence generation and relay.
// The Escrow contract makes the final release decision.

import { BaseAgent, AgentConfig } from '../runtime';
import { AXLMessage } from '../../protocol/axl/bridge';
import { ZeroGStorage } from '../../zerog/storage/client';
import { ethers } from 'ethers';
import crypto from 'node:crypto';
import { SyncService } from '../../services/trust-infrastructure/sync.service';

export interface AttestationAgentConfig extends Omit<AgentConfig, 'role'> {
  escrowAddress: string;
  escrowRpcUrl: string;
  watcherPubkeys: string[];
  amountToleranceBps?: number;
  timestampToleranceSec?: number;
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

export interface OrderCommitment {
  orderId: string;
  expectedAmount: string;
  expectedCurrency: string;
  receiverCommitment: string;
  referenceHash?: string;
  deadline: number;
  attestationMode: string;
}

export interface Attestation {
  attestationId: string;
  observationId: string;
  orderId: string;
  attestorPubkey: string;
  validationResult: {
    amountMatch: boolean;
    currencyMatch: boolean;
    receiverMatch: boolean;
    timestampValid: boolean;
    signatureValid: boolean;
    overallValid: boolean;
    reason?: string;
  };
  evidenceHash: string;
  storageRootHash: string;
  submittedTx?: string;
  createdAt: number;
}

const ESCROW_ABI = [
  'function release(bytes32 orderId, bytes32 evidenceHash) external',
  'function getOrder(uint256 orderId) view returns (tuple(uint256 id, address buyer, address lp, address token, uint256 tokenAmount, uint256 fiatAmount, string fiatCurrency, string railType, uint256 buyerBond, uint256 lpBond, uint256 deadline, uint8 state, bytes32 proofHash, bytes32 evidenceHash))',
] as const;

export class AttestationAgent extends BaseAgent {
  private escrow: ethers.Contract;
  private escrowSigner: ethers.Wallet;
  private attestations: Map<string, Attestation> = new Map();
  private orderCommitments: Map<string, OrderCommitment> = new Map();
  private watcherPubkeys: string[];
  private amountToleranceBps: number;
  private timestampToleranceSec: number;
  private syncService = new SyncService();

  constructor(config: AttestationAgentConfig) {
    super({ ...config, role: 'keeper' });

    const provider = new ethers.JsonRpcProvider(config.escrowRpcUrl);
    this.escrowSigner = new ethers.Wallet(config.privateKey, provider);
    this.escrow = new ethers.Contract(config.escrowAddress, ESCROW_ABI, this.escrowSigner);
    this.storage = new ZeroGStorage(config.privateKey);
    this.watcherPubkeys = config.watcherPubkeys;
    this.amountToleranceBps = config.amountToleranceBps ?? 100; // 1% default
    this.timestampToleranceSec = config.timestampToleranceSec ?? 600; // 10 min default
  }

  protected setupMessageHandlers(): void {
    this.messageHandler.on('payment.observed', async (msg: AXLMessage) => {
      const { observation, watcherPubkey } = msg.data;

      if (!this.watcherPubkeys.includes(watcherPubkey)) {
        console.warn(`[${this.config.name}] Rejected observation from untrusted watcher: ${watcherPubkey.slice(0, 16)}...`);
        return;
      }

      await this.processObservation(observation);
    });

    this.messageHandler.on('order.commit', async (msg: AXLMessage) => {
      await this.registerOrderCommitment(msg.data);
    });
  }

  protected getStateSnapshot(): object {
    return {
      attestations: Array.from(this.attestations.entries()),
      orderCommitments: Array.from(this.orderCommitments.entries()),
    };
  }

  protected restoreState(state: any): void {
    if (state.attestations) {
      this.attestations = new Map(state.attestations);
    }
    if (state.orderCommitments) {
      this.orderCommitments = new Map(state.orderCommitments);
    }
  }

  /**
   * Register an order commitment for validation.
   */
  async registerOrderCommitment(commitment: OrderCommitment): Promise<void> {
    this.orderCommitments.set(commitment.orderId, commitment);
    this.logDecision('commitment.registered', {
      orderId: commitment.orderId,
      expectedAmount: commitment.expectedAmount,
      expectedCurrency: commitment.expectedCurrency,
    });
    console.log(`[${this.config.name}] Registered commitment for order ${commitment.orderId}`);
  }

  /**
   * Process a payment observation from a watcher.
   * Validates against order commitments and submits release if valid.
   */
  async processObservation(observation: PaymentObservation): Promise<Attestation | null> {
    console.log(`[${this.config.name}] Processing observation ${observation.observationId}`);

    const commitment = this.orderCommitments.get(observation.orderId);
    if (!commitment) {
      console.warn(`[${this.config.name}] No commitment found for order ${observation.orderId}`);
      return null;
    }

    const validation = this.validateObservation(observation, commitment);
    const attestation = await this.createAttestation(observation, validation);

    if (validation.overallValid) {
      await this.submitRelease(attestation);
    }

    return attestation;
  }

  /**
   * Validate observation against order commitments.
   */
  validateObservation(
    observation: PaymentObservation,
    commitment: OrderCommitment
  ): Attestation['validationResult'] {
    const reasons: string[] = [];

    // Amount validation with tolerance
    const paid = parseFloat(observation.amount);
    const expected = parseFloat(commitment.expectedAmount);
    const tolerance = expected * (this.amountToleranceBps / 10000);
    const amountMatch = Math.abs(paid - expected) <= tolerance;
    if (!amountMatch) {
      reasons.push(`amount: ${observation.amount} vs ${commitment.expectedAmount} (±${this.amountToleranceBps}bps)`);
    }

    // Currency validation
    const currencyMatch = observation.currency.toUpperCase() === commitment.expectedCurrency.toUpperCase();
    if (!currencyMatch) {
      reasons.push(`currency: ${observation.currency} vs ${commitment.expectedCurrency}`);
    }

    // Receiver commitment validation
    const receiverHash = ethers.id(observation.receiver);
    const receiverMatch = receiverHash === commitment.receiverCommitment ||
                          observation.receiver === commitment.receiverCommitment;
    if (!receiverMatch) {
      reasons.push(`receiver commitment mismatch`);
    }

    // Timestamp validation
    const now = Math.floor(Date.now() / 1000);
    const timestampValid = Math.abs(now - observation.timestamp) <= this.timestampToleranceSec;
    if (!timestampValid) {
      reasons.push(`timestamp outside ±${this.timestampToleranceSec}s window`);
    }

    // Signature from watcher
    const signatureValid = observation.signatureValid;
    if (!signatureValid) {
      reasons.push('watcher reported invalid HMAC signature');
    }

    const overallValid = amountMatch && currencyMatch && receiverMatch && timestampValid && signatureValid;

    return {
      amountMatch,
      currencyMatch,
      receiverMatch,
      timestampValid,
      signatureValid,
      overallValid,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    };
  }

  /**
   * Create attestation record and pin evidence to 0G Storage.
   */
  async createAttestation(
    observation: PaymentObservation,
    validationResult: Attestation['validationResult']
  ): Promise<Attestation> {
    const attestorPubkey = await this.getAXLPublicKey();

    // Create evidence blob
    const evidence = {
      observation,
      validationResult,
      attestorPubkey,
      attestedAt: Date.now(),
    };

    // Pin to 0G Storage
    const blob = new TextEncoder().encode(JSON.stringify(evidence, null, 2));
    let storageRootHash = '';
    try {
      storageRootHash = await this.storage.uploadProof(blob);
      console.log(`[${this.config.name}] Evidence pinned: ${storageRootHash}`);
    } catch (err) {
      console.error(`[${this.config.name}] Failed to pin evidence:`, err);
    }

    const attestation: Attestation = {
      attestationId: `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      observationId: observation.observationId,
      orderId: observation.orderId,
      attestorPubkey,
      validationResult,
      evidenceHash: storageRootHash || ethers.id(JSON.stringify(evidence)),
      storageRootHash,
      createdAt: Date.now(),
    };

    this.attestations.set(attestation.attestationId, attestation);
    this.logDecision('attestation.created', {
      attestationId: attestation.attestationId,
      orderId: observation.orderId,
      valid: validationResult.overallValid,
    });

    return attestation;
  }

  /**
   * Submit release evidence to escrow contract.
   * This is the ONLY place where escrow release is triggered.
   */
  async submitRelease(attestation: Attestation): Promise<string> {
    if (!attestation.validationResult.overallValid) {
      console.log(`[${this.config.name}] Skipping release for invalid attestation ${attestation.attestationId}`);
      return '';
    }

    try {
      const orderIdHash = ethers.id(attestation.orderId);
      const evidenceHash = attestation.storageRootHash as `0x${string}` || ethers.id(attestation.evidenceHash);

      console.log(`[${this.config.name}] Submitting release: order=${attestation.orderId} evidence=${attestation.storageRootHash?.slice(0, 16)}...`);

      const tx = await this.escrow.release(orderIdHash, evidenceHash);
      const receipt = await tx.wait();

      attestation.submittedTx = receipt?.hash;
      this.logDecision('release.submitted', {
        attestationId: attestation.attestationId,
        orderId: attestation.orderId,
        txHash: receipt?.hash,
      });

      console.log(`[${this.config.name}] Release submitted: tx=${receipt?.hash}`);

      // Notify watcher that observation was verified
      await this.notifyWatcherVerified(attestation);

      // Neo4j Ingestion (Successful Settlement)
      const commitment = this.orderCommitments.get(attestation.orderId);
      if (commitment) {
        // Find the buyer pubkey from the commitment if available, or just mock userWallet
        const buyerAgent = await this.getAXLPublicKey(); // Actually Attestation is watcher/keeper
        this.syncService.syncSettlement({
          userWallet: 'user_wallet', // We don't have direct access here, but in full system this is populated
          lpWallet: commitment.receiverCommitment,
          settlementId: attestation.orderId,
          amount: parseFloat(commitment.expectedAmount),
          railType: 'unknown',
          fiatAgentId: buyerAgent,
          cryptoAgentId: commitment.receiverCommitment
        }).catch(console.error);
      }

      return receipt?.hash ?? '';
    } catch (err) {
      console.error(`[${this.config.name}] Release failed:`, err);
      this.logDecision('release.failed', {
        attestationId: attestation.attestationId,
        error: (err as Error).message,
      });

      // Neo4j Ingestion (Failed Settlement)
      const commitment = this.orderCommitments.get(attestation.orderId);
      if (commitment) {
        this.syncService.syncFailure({
          userWallet: 'user_wallet',
          lpWallet: commitment.receiverCommitment,
          settlementId: attestation.orderId,
          amount: parseFloat(commitment.expectedAmount),
          railType: 'unknown',
          fiatAgentId: 'unknown',
          cryptoAgentId: commitment.receiverCommitment
        }).catch(console.error);
      }

      return '';
    }
  }

  /**
   * Notify watcher that observation was verified and released.
   */
  private async notifyWatcherVerified(attestation: Attestation): Promise<void> {
    for (const watcherPubkey of this.watcherPubkeys) {
      try {
        await this.axl.send(watcherPubkey, {
          type: 'observation.verified',
          observationId: attestation.observationId,
          attestationId: attestation.attestationId,
          txHash: attestation.submittedTx,
        });
      } catch (err) {
        console.error(`[${this.config.name}] Failed to notify watcher:`, err);
      }
    }
  }

  /**
   * Get attestation record by ID.
   */
  getAttestationRecord(attestationId: string): Attestation | undefined {
    return this.attestations.get(attestationId);
  }

  /**
   * Get all attestations for an order.
   */
  getAttestationsForOrder(orderId: string): Attestation[] {
    return Array.from(this.attestations.values())
      .filter(a => a.orderId === orderId);
  }

  /**
   * Manually add order commitment (for external callers).
   */
  addCommitment(commitment: OrderCommitment): void {
    this.orderCommitments.set(commitment.orderId, commitment);
  }

  /**
   * Check if order has commitment registered.
   */
  hasCommitment(orderId: string): boolean {
    return this.orderCommitments.has(orderId);
  }
}
