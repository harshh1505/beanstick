// agents/payment-verify/webhook.ts
//
// HMAC-verified PSP webhook receiver. Each LP configures their bank/PSP
// (Razorpay, Venmo Business, Revolut, …) to POST payment receipts to a
// KeeperHub workflow URL with header `X-Webhook-Signature: sha256=<hex>`.
// KeeperHub forwards the request to this Hono app, which:
//   1. Verifies the HMAC.
//   2. Looks up the expected order (amount, currency, receiver).
//   3. Validates the payload matches.
//   4. Pins the (payload + signature) blob to 0G Storage as dispute evidence.
//   5. Calls Escrow.release(orderId, evidenceHash) on-chain.

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import crypto from 'node:crypto';
import { ethers } from 'ethers';
import { ZeroGStorage } from '../../zerog/storage/client';

export interface PaymentWebhookPayload {
  /** Reference id the buyer included in the payment memo. */
  orderId: string;
  amount: string;
  currency: string;
  /** Buyer's PSP handle (UPI VPA, @venmo, IBAN …). */
  sender: string;
  /** LP's PSP handle. */
  receiver: string;
  /** PSP-assigned tx id. */
  transactionId: string;
  /** Unix seconds. */
  timestamp: number;
  rail: 'upi' | 'venmo' | 'revolut' | 'banksim';
}

export interface ExpectedOrder {
  expectedAmount: string;
  expectedCurrency: string;
  expectedReceiver: string;
}

export type OrderLookup = (orderId: string) => Promise<ExpectedOrder | null>;

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? '';
const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS ?? '';
// RPC for the chain where Escrow.sol is deployed (Base Sepolia, etc.)
const ESCROW_RPC_URL = process.env.ESCROW_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
// RPC for 0G Storage on-chain submissions — must always be 0G Galileo since
// 0G's storage SDK calls Galileo-only contracts (e.g., flow.market()).
const STORAGE_RPC_URL = process.env.ZEROG_STORAGE_RPC ?? 'https://evmrpc-testnet.0g.ai';
const OPERATOR_PRIVATE_KEY = process.env.PRIVATE_KEY ?? '';

/** Timing-safe HMAC-SHA256 verify. Returns false on any malformed input. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string = WEBHOOK_SECRET,
): boolean {
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const received = (signatureHeader ?? '').replace(/^sha256=/, '');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(received, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function validatePayment(
  payload: PaymentWebhookPayload,
  expected: ExpectedOrder,
): { valid: boolean; reason?: string } {
  const paid = parseFloat(payload.amount);
  const want = parseFloat(expected.expectedAmount);
  if (Math.abs(paid - want) > 0.01) {
    return { valid: false, reason: `amount mismatch ${payload.amount} vs ${expected.expectedAmount}` };
  }
  if (payload.currency.toUpperCase() !== expected.expectedCurrency.toUpperCase()) {
    return { valid: false, reason: `currency mismatch ${payload.currency} vs ${expected.expectedCurrency}` };
  }
  if (payload.receiver !== expected.expectedReceiver) {
    return { valid: false, reason: `receiver mismatch ${payload.receiver} vs ${expected.expectedReceiver}` };
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - payload.timestamp) > 600) {
    return { valid: false, reason: 'timestamp outside ±10 min window' };
  }
  return { valid: true };
}

/**
 * Pin the verified payload + its signature to 0G Storage. Returns the
 * Merkle root hash, which is what we store on-chain as `evidenceHash`.
 */
export async function pinEvidence(
  payload: PaymentWebhookPayload,
  signatureHeader: string,
  privateKey: string = OPERATOR_PRIVATE_KEY,
): Promise<string> {
  if (!privateKey) throw new Error('PRIVATE_KEY missing for 0G Storage upload');
  const storage = new ZeroGStorage(privateKey);
  const blob = new TextEncoder().encode(
    JSON.stringify({ payload, signature: signatureHeader, verifiedAt: Date.now() }, null, 2),
  );
  const rootHash = await storage.uploadProof(blob);
  console.log(`[Webhook] Evidence pinned to 0G Storage: ${rootHash}`);
  return rootHash;
}

const ESCROW_ABI = [
  'function release(bytes32 orderId, bytes32 evidenceHash) external',
] as const;

const KEEPERHUB_WORKFLOW_ID = process.env.KEEPERHUB_PAYMENT_WORKFLOW_ID ?? '';
const KEEPERHUB_API_URL = process.env.KEEPERHUB_API_URL ?? 'https://api.keeperhub.xyz';
const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY ?? '';

/**
 * Trigger KeeperHub workflow for payment release.
 * Returns execution ID if successful, null if KeeperHub not configured.
 */
export async function triggerKeeperHubRelease(
  orderId: string,
  evidenceHash: string,
  amount: string,
  currency: string,
): Promise<string | null> {
  if (!KEEPERHUB_WORKFLOW_ID || !KEEPERHUB_API_KEY) {
    console.log('[Webhook] KeeperHub not configured, using direct release');
    return null;
  }

  try {
    const res = await fetch(`${KEEPERHUB_API_URL}/v1/workflows/${KEEPERHUB_WORKFLOW_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEEPERHUB_API_KEY}`,
      },
      body: JSON.stringify({
        input: { orderId, evidenceHash, amount, currency },
      }),
    });

    if (!res.ok) {
      console.error('[Webhook] KeeperHub trigger failed:', await res.text());
      return null;
    }

    const data = await res.json();
    console.log(`[Webhook] KeeperHub workflow triggered: ${data.executionId}`);
    return data.executionId;
  } catch (err) {
    console.error('[Webhook] KeeperHub trigger error:', err);
    return null;
  }
}

/** Calls Escrow.release(orderId, evidenceHash). */
export async function releaseEscrow(
  orderId: string,
  evidenceHash: string,
): Promise<string> {
  if (!ESCROW_ADDRESS) {
    console.log('[Webhook] ESCROW_ADDRESS unset → skipping on-chain release (Section 8 not deployed)');
    return '';
  }
  const provider = new ethers.JsonRpcProvider(ESCROW_RPC_URL);
  const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, wallet);
  // orderId is an off-chain UTF-8 string → keccak256 it to match the
  // contract's `keccak256(bytes(orderRefId))`. evidenceHash is already a
  // bytes32 (the 0G Storage Merkle root) — pass it through unchanged.
  const tx = await escrow.release(ethers.id(orderId), evidenceHash as `0x${string}`);
  const receipt = await tx.wait();
  console.log(`[Webhook] Escrow released order=${orderId} tx=${receipt?.hash}`);
  return receipt?.hash ?? '';
}

export interface WebhookServerOptions {
  orderLookup: OrderLookup;
  port?: number;
  /** Skip the on-chain release call (useful for offline tests). */
  skipRelease?: boolean;
  /** Skip the 0G Storage pin (useful for offline tests / CI). */
  skipPin?: boolean;
}

export function createWebhookServer(opts: WebhookServerOptions) {
  const app = new Hono();

  app.post('/webhook/payment', async (c) => {
    const rawBody = await c.req.text();
    const sig = c.req.header('X-Webhook-Signature') ?? '';

    if (!verifyWebhookSignature(rawBody, sig)) {
      console.error(
        `[Webhook] BAD SIG  sig=${sig}  body.len=${rawBody.length}  body=${rawBody}`,
      );
      return c.json({ error: 'invalid signature' }, 401);
    }

    let payload: PaymentWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ error: 'invalid JSON' }, 400);
    }

    const expected = await opts.orderLookup(payload.orderId);
    if (!expected) return c.json({ error: 'unknown orderId' }, 404);

    const v = validatePayment(payload, expected);
    if (!v.valid) return c.json({ error: v.reason }, 400);

    const evidenceHash = opts.skipPin
      ? `dryrun:${payload.transactionId}`
      : await pinEvidence(payload, sig);

    let txHash = '';
    let keeperExecId: string | null = null;

    if (!opts.skipRelease) {
      // Try KeeperHub first, fall back to direct release
      keeperExecId = await triggerKeeperHubRelease(
        payload.orderId, evidenceHash, payload.amount, payload.currency
      );
      if (!keeperExecId) {
        txHash = await releaseEscrow(payload.orderId, evidenceHash);
      }
    }

    return c.json({
      ok: true,
      orderId: payload.orderId,
      evidenceHash,
      txHash,
      keeperExecId,
    });
  });

  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Debug: echo back all incoming headers + body. Used to introspect what
  // KeeperHub's webhook/send-webhook action actually sends.
  app.all('/echo', async (c) => {
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((v, k) => { headers[k] = v; });
    const body = await c.req.text();
    console.log(`[echo] ${c.req.method} headers=${JSON.stringify(headers)} body=${body}`);
    return c.json({ method: c.req.method, headers, body });
  });

  const port = opts.port ?? 4001;
  const server = serve({ fetch: app.fetch, port });
  console.log(`[Webhook] listening on :${port}`);
  return { app, server };
}
