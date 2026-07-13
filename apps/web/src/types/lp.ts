// apps/web/src/types/lp.ts
//
// Data types for LP Rail Registration (G.12.1) and Order Proof Timeline (G.12.7)

export type RailType = 'banksim' | 'upi' | 'venmo' | 'revolut' | 'ach';
export type ReversibilityClass = 'instant' | 'reversible' | 'final';
export type OwnershipVerificationStatus = 'pending' | 'verified' | 'failed';

export interface LpProfile {
  walletAddress: string;
  axlPubkey: string;
  registeredAt: number;
  active: boolean;
  reputation: {
    score: number;
    totalTrades: number;
    completionRate: number;
    averageSettleTimeSeconds: number;
    slashCount: number;
  };
}

export interface LpRailRegistration {
  id: string;
  lpId: string;
  railType: RailType;
  receiverLabel: string;
  beneficiaryName: string;
  canonicalReceiverPayload: string;
  receiverCommitment: string;
  qrPayload?: string;
  qrCommitment?: string;
  region: string;
  currency: string;
  minAmount: string;
  maxAmount: string;
  reversibilityClass: ReversibilityClass;
  ownershipVerificationStatus: OwnershipVerificationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface PaymentEvent {
  id: string;
  provider: string;
  railType: RailType;
  rawHeaders: Record<string, string>;
  rawBody: string;
  signatureVerificationStatus: 'valid' | 'invalid' | 'unchecked';
  normalizedSender: string;
  normalizedReceiver: string;
  normalizedReference: string;
  normalizedAmount: string;
  normalizedCurrency: string;
  providerStatus: string;
  candidateOrderId?: string;
  matchConfidence: number;
  eventState: 'candidate' | 'verified' | 'rejected' | 'ambiguous';
  observedAt: number;
}

export interface Attestation {
  id: string;
  orderId: string;
  paymentEventId: string;
  attestorId: string;
  attestationMode: string;
  publicInputs: string[];
  evidenceHash: string;
  storageRootHash: string;
  signature: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  submittedOnchainTx?: string;
  createdAt: number;
}

export type ProofPhase =
  | 'AWAITING_LOCK'
  | 'LOCKED'
  | 'AWAITING_FIAT_DETAILS'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_OBSERVED'
  | 'GENERATING_PROOF'
  | 'PROOF_GENERATED'
  | 'VERIFYING_PROOF'
  | 'PROOF_VERIFIED'
  | 'RELEASING_FUNDS'
  | 'RELEASED'
  | 'PROOF_FAILED'
  | 'TIMEOUT'
  | 'DISPUTED';

export interface OrderProofTimeline {
  orderId: string;
  phase: ProofPhase;
  events: {
    phase: ProofPhase;
    timestamp: number;
    txHash?: string;
    details?: string;
  }[];
  lockedAt?: number;
  fiatDetailsSentAt?: number;
  paymentSubmittedAt?: number;
  paymentObservedAt?: number;
  proofGeneratedAt?: number;
  proofVerifiedAt?: number;
  releasedAt?: number;
  expiredAt?: number;
  evidenceHash?: string;
  storageRootHash?: string;
}

export interface RailPolicy {
  railType: RailType;
  reversibilityClass: ReversibilityClass;
  challengeWindowSeconds: number;
  permittedReleaseStatuses: string[];
  highRiskAmountThreshold: string;
  manualReviewThreshold: string;
}

export const RAIL_POLICIES: Record<RailType, RailPolicy> = {
  banksim: {
    railType: 'banksim',
    reversibilityClass: 'instant',
    challengeWindowSeconds: 0,
    permittedReleaseStatuses: ['completed'],
    highRiskAmountThreshold: '1000000',
    manualReviewThreshold: '10000000',
  },
  upi: {
    railType: 'upi',
    reversibilityClass: 'instant',
    challengeWindowSeconds: 60,
    permittedReleaseStatuses: ['SUCCESS', 'completed'],
    highRiskAmountThreshold: '100000',
    manualReviewThreshold: '500000',
  },
  venmo: {
    railType: 'venmo',
    reversibilityClass: 'reversible',
    challengeWindowSeconds: 300,
    permittedReleaseStatuses: ['completed', 'settled'],
    highRiskAmountThreshold: '500',
    manualReviewThreshold: '2000',
  },
  revolut: {
    railType: 'revolut',
    reversibilityClass: 'reversible',
    challengeWindowSeconds: 600,
    permittedReleaseStatuses: ['completed', 'settled'],
    highRiskAmountThreshold: '1000',
    manualReviewThreshold: '5000',
  },
  ach: {
    railType: 'ach',
    reversibilityClass: 'reversible',
    challengeWindowSeconds: 86400,
    permittedReleaseStatuses: ['settled'],
    highRiskAmountThreshold: '10000',
    manualReviewThreshold: '50000',
  },
};
