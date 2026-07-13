// apps/web/src/lib/qr-commitment.ts
//
// QR Commitment and Verification Module (G.12.2)
// Prevents bait-and-switch on payment instructions.

import { keccak256, toUtf8Bytes } from 'ethers';

export type RailType = 'banksim' | 'upi' | 'venmo' | 'revolut' | 'ach';

export interface UpiPayload {
  pa: string;
  pn: string;
  am?: string;
  cu?: string;
  tn?: string;
}

export interface VenmoPayload {
  handle: string;
  note?: string;
}

export interface RevolutPayload {
  tag: string;
  name?: string;
}

export interface BankSimPayload {
  account: string;
}

export interface AchPayload {
  routingNumber: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
}

export type RailPayload = UpiPayload | VenmoPayload | RevolutPayload | BankSimPayload | AchPayload;

export function canonicalizeQrPayload(railType: RailType, payload: RailPayload): string {
  const parts: string[] = [railType];

  switch (railType) {
    case 'upi': {
      const upi = payload as UpiPayload;
      parts.push(`pa=${upi.pa.toLowerCase()}`);
      parts.push(`pn=${upi.pn.toLowerCase()}`);
      break;
    }
    case 'venmo': {
      const venmo = payload as VenmoPayload;
      parts.push(`handle=${venmo.handle.toLowerCase()}`);
      break;
    }
    case 'revolut': {
      const revolut = payload as RevolutPayload;
      parts.push(`tag=${revolut.tag.toLowerCase()}`);
      break;
    }
    case 'banksim': {
      const banksim = payload as BankSimPayload;
      parts.push(`account=${banksim.account.toLowerCase()}`);
      break;
    }
    case 'ach': {
      const ach = payload as AchPayload;
      parts.push(`routing=${ach.routingNumber}`);
      parts.push(`account=${ach.accountNumber}`);
      parts.push(`type=${ach.accountType}`);
      break;
    }
  }

  return parts.sort().join('|');
}

export function computeReceiverCommitment(canonicalPayload: string): string {
  return keccak256(toUtf8Bytes(canonicalPayload));
}

export function computeQrCommitment(qrString: string): string {
  return keccak256(toUtf8Bytes(qrString));
}

export function verifyReceiverCommitment(
  railType: RailType,
  payload: RailPayload,
  commitment: string
): boolean {
  const canonical = canonicalizeQrPayload(railType, payload);
  const computed = computeReceiverCommitment(canonical);
  return computed.toLowerCase() === commitment.toLowerCase();
}

export function parseUpiQrString(qrString: string): UpiPayload | null {
  try {
    const url = new URL(qrString);
    if (url.protocol !== 'upi:') return null;

    const pa = url.searchParams.get('pa');
    const pn = url.searchParams.get('pn');
    if (!pa || !pn) return null;

    return {
      pa,
      pn,
      am: url.searchParams.get('am') || undefined,
      cu: url.searchParams.get('cu') || undefined,
      tn: url.searchParams.get('tn') || undefined,
    };
  } catch {
    return null;
  }
}

export function generateUpiQrString(payload: UpiPayload, amount?: string, note?: string): string {
  const params = new URLSearchParams();
  params.set('pa', payload.pa);
  params.set('pn', payload.pn);
  if (amount) params.set('am', amount);
  params.set('cu', payload.cu || 'INR');
  if (note) params.set('tn', note);
  return `upi://pay?${params.toString()}`;
}

export function generatePaymentReference(orderId: string): string {
  return `BEANSTICK-${orderId.slice(0, 12).toUpperCase()}`;
}

export function extractOrderIdFromReference(reference: string): string | null {
  const match = reference.match(/^BEANSTICK-([A-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : null;
}

export interface CommitmentBundle {
  railType: RailType;
  canonicalPayload: string;
  receiverCommitment: string;
  qrString?: string;
  qrCommitment?: string;
}

export function createCommitmentBundle(
  railType: RailType,
  payload: RailPayload,
  qrString?: string
): CommitmentBundle {
  const canonicalPayload = canonicalizeQrPayload(railType, payload);
  const receiverCommitment = computeReceiverCommitment(canonicalPayload);

  return {
    railType,
    canonicalPayload,
    receiverCommitment,
    qrString,
    qrCommitment: qrString ? computeQrCommitment(qrString) : undefined,
  };
}

export function displayCommitmentFingerprint(commitment: string): string {
  return `${commitment.slice(0, 10)}...${commitment.slice(-8)}`;
}
