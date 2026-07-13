// apps/web/src/lib/db/payment-events.ts
//
// JSON file-based storage for payment events and attestations (G.13)
// In production, migrate to SQLite or Postgres.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PaymentEvent, Attestation, OrderProofTimeline, ProofPhase } from '../../types/lp';

const DATA_DIR = process.env.BEANSTICK_DATA_DIR || '/tmp/beanstick';
const PAYMENT_EVENTS_FILE = path.join(DATA_DIR, 'payment-events.json');
const ATTESTATIONS_FILE = path.join(DATA_DIR, 'attestations.json');
const ORDER_TIMELINES_FILE = path.join(DATA_DIR, 'order-timelines.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err);
  }
  return defaultValue;
}

function writeJson<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getPaymentEvents(): Record<string, PaymentEvent> {
  return readJson<Record<string, PaymentEvent>>(PAYMENT_EVENTS_FILE, {});
}

export function getPaymentEvent(id: string): PaymentEvent | null {
  const events = getPaymentEvents();
  return events[id] || null;
}

export function getPaymentEventsForOrder(orderId: string): PaymentEvent[] {
  const events = getPaymentEvents();
  return Object.values(events).filter(e => e.candidateOrderId === orderId);
}

export function savePaymentEvent(event: PaymentEvent): void {
  const events = getPaymentEvents();
  events[event.id] = event;
  writeJson(PAYMENT_EVENTS_FILE, events);
}

export function createPaymentEvent(data: {
  provider: string;
  railType: PaymentEvent['railType'];
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
}): PaymentEvent {
  const event: PaymentEvent = {
    id: `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ...data,
    eventState: data.signatureVerificationStatus === 'valid' ? 'candidate' : 'rejected',
    observedAt: Date.now(),
  };
  savePaymentEvent(event);
  return event;
}

export function updatePaymentEventState(
  id: string,
  state: PaymentEvent['eventState']
): boolean {
  const event = getPaymentEvent(id);
  if (!event) return false;

  event.eventState = state;
  savePaymentEvent(event);
  return true;
}

export function getAttestations(): Record<string, Attestation> {
  return readJson<Record<string, Attestation>>(ATTESTATIONS_FILE, {});
}

export function getAttestation(id: string): Attestation | null {
  const attestations = getAttestations();
  return attestations[id] || null;
}

export function getAttestationsForOrder(orderId: string): Attestation[] {
  const attestations = getAttestations();
  return Object.values(attestations).filter(a => a.orderId === orderId);
}

export function saveAttestation(attestation: Attestation): void {
  const attestations = getAttestations();
  attestations[attestation.id] = attestation;
  writeJson(ATTESTATIONS_FILE, attestations);
}

export function createAttestation(data: {
  orderId: string;
  paymentEventId: string;
  attestorId: string;
  attestationMode: string;
  publicInputs: string[];
  evidenceHash: string;
  storageRootHash: string;
  signature: string;
}): Attestation {
  const attestation: Attestation = {
    id: `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ...data,
    verificationStatus: 'pending',
    createdAt: Date.now(),
  };
  saveAttestation(attestation);
  return attestation;
}

export function updateAttestationStatus(
  id: string,
  status: Attestation['verificationStatus'],
  txHash?: string
): boolean {
  const attestation = getAttestation(id);
  if (!attestation) return false;

  attestation.verificationStatus = status;
  if (txHash) {
    attestation.submittedOnchainTx = txHash;
  }
  saveAttestation(attestation);
  return true;
}

export function getOrderTimelines(): Record<string, OrderProofTimeline> {
  return readJson<Record<string, OrderProofTimeline>>(ORDER_TIMELINES_FILE, {});
}

export function getOrderTimeline(orderId: string): OrderProofTimeline | null {
  const timelines = getOrderTimelines();
  return timelines[orderId] || null;
}

export function saveOrderTimeline(timeline: OrderProofTimeline): void {
  const timelines = getOrderTimelines();
  timelines[timeline.orderId] = timeline;
  writeJson(ORDER_TIMELINES_FILE, timelines);
}

export function createOrderTimeline(orderId: string): OrderProofTimeline {
  const timeline: OrderProofTimeline = {
    orderId,
    phase: 'AWAITING_LOCK',
    events: [{
      phase: 'AWAITING_LOCK',
      timestamp: Date.now(),
    }],
  };
  saveOrderTimeline(timeline);
  return timeline;
}

export function updateOrderPhase(
  orderId: string,
  phase: ProofPhase,
  details?: { txHash?: string; details?: string }
): OrderProofTimeline | null {
  let timeline = getOrderTimeline(orderId);
  if (!timeline) {
    timeline = createOrderTimeline(orderId);
  }

  timeline.phase = phase;
  timeline.events.push({
    phase,
    timestamp: Date.now(),
    txHash: details?.txHash,
    details: details?.details,
  });

  switch (phase) {
    case 'LOCKED':
      timeline.lockedAt = Date.now();
      break;
    case 'AWAITING_PAYMENT':
      timeline.fiatDetailsSentAt = Date.now();
      break;
    case 'PAYMENT_OBSERVED':
      timeline.paymentObservedAt = Date.now();
      break;
    case 'PROOF_GENERATED':
      timeline.proofGeneratedAt = Date.now();
      break;
    case 'PROOF_VERIFIED':
      timeline.proofVerifiedAt = Date.now();
      break;
    case 'RELEASED':
      timeline.releasedAt = Date.now();
      break;
    case 'TIMEOUT':
      timeline.expiredAt = Date.now();
      break;
  }

  saveOrderTimeline(timeline);
  return timeline;
}

export function setOrderEvidence(
  orderId: string,
  evidenceHash: string,
  storageRootHash: string
): boolean {
  const timeline = getOrderTimeline(orderId);
  if (!timeline) return false;

  timeline.evidenceHash = evidenceHash;
  timeline.storageRootHash = storageRootHash;
  saveOrderTimeline(timeline);
  return true;
}
