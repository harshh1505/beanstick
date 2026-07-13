// scripts/verify-section7.ts
//
// End-to-end smoke test for the KeeperHub-webhook payment-verify path.
//   1. HMAC: tampered body rejected, valid body accepted.
//   2. validatePayment: catches amount/currency/receiver/timestamp drift.
//   3. Boots the Hono receiver on a free port and uses the BankSim emitter to
//      POST a signed payload through the real handler. Storage pin + on-chain
//      release are skipped (skipPin / skipRelease) so this runs offline.
//   4. Negative path: tampered signature returns 401 from the live server.

import 'dotenv/config';
import {
  verifyWebhookSignature,
  validatePayment,
  createWebhookServer,
  type PaymentWebhookPayload,
  type ExpectedOrder,
} from '../agents/payment-verify/webhook';
import { simulatePayment } from '../agents/payment-verify/banksim';

const SECRET = process.env.PAYMENT_WEBHOOK_SECRET;
const PORT = 4099;
const URL = `http://127.0.0.1:${PORT}/webhook/payment`;

function basePayload(): PaymentWebhookPayload {
  return {
    orderId: 'order-test-1',
    amount: '100.00',
    currency: 'INR',
    sender: 'buyer@upi',
    receiver: 'lp@upi',
    transactionId: 'tx-demo-1',
    timestamp: Math.floor(Date.now() / 1000),
    rail: 'upi',
  };
}

const expected: ExpectedOrder = {
  expectedAmount: '100.00',
  expectedCurrency: 'INR',
  expectedReceiver: 'lp@upi',
};

async function main() {
  if (!SECRET) {
    console.error('❌ PAYMENT_WEBHOOK_SECRET not set');
    process.exit(1);
  }
  console.log('=== Section 7: Payment Verification ===\n');

  // 1. HMAC unit tests
  const body = JSON.stringify(basePayload());
  const crypto = await import('node:crypto');
  const goodSig =
    'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  if (!verifyWebhookSignature(body, goodSig)) throw new Error('valid HMAC rejected');
  if (verifyWebhookSignature(body + 'x', goodSig)) throw new Error('tampered body accepted');
  if (verifyWebhookSignature(body, 'sha256=deadbeef')) throw new Error('bad sig accepted');
  console.log('✅ HMAC verify: rejects tampered body and bad signatures');

  // 2. validatePayment
  const okV = validatePayment(basePayload(), expected);
  if (!okV.valid) throw new Error('valid payload flagged invalid');
  const badAmt = validatePayment({ ...basePayload(), amount: '99.50' }, expected);
  if (badAmt.valid) throw new Error('amount mismatch slipped through');
  const badRcv = validatePayment({ ...basePayload(), receiver: 'attacker@upi' }, expected);
  if (badRcv.valid) throw new Error('receiver mismatch slipped through');
  const stale = validatePayment(
    { ...basePayload(), timestamp: Math.floor(Date.now() / 1000) - 9999 },
    expected,
  );
  if (stale.valid) throw new Error('stale timestamp slipped through');
  console.log('✅ validatePayment: rejects amount/receiver/timestamp drift');

  // 3. Boot the live Hono receiver
  const { server } = createWebhookServer({
    orderLookup: async (id) => (id === 'order-test-1' ? expected : null),
    port: PORT,
    skipPin: false,
    skipRelease: true, // Escrow.sol not deployed yet (Section 8)
  });
  await new Promise((r) => setTimeout(r, 250));

  // health
  const h = await fetch(`http://127.0.0.1:${PORT}/health`);
  console.log(`✅ /health → ${h.status}`);

  // 3a. Happy path via BankSim
  const result = (await simulatePayment(URL, basePayload(), SECRET)) as {
    ok?: boolean;
    evidenceHash?: string;
  };
  if (!result.ok) throw new Error('happy-path webhook did not return ok');
  if (!result.evidenceHash || !/^0x[0-9a-f]{64}$/i.test(result.evidenceHash)) {
    throw new Error(`expected 0x-prefixed 32-byte root, got ${result.evidenceHash}`);
  }
  console.log(`✅ happy-path: evidence=${result.evidenceHash}`);

  // 3b. Negative path: tampered signature → 401
  const bad = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': 'sha256=00',
    },
    body: JSON.stringify(basePayload()),
  });
  if (bad.status !== 401) throw new Error(`expected 401, got ${bad.status}`);
  console.log('✅ tampered signature → 401');

  // 3c. Unknown order → 404
  const unknown = await simulatePayment(
    URL,
    { ...basePayload(), orderId: 'order-does-not-exist' },
    SECRET,
  );
  if ((unknown as { error?: string }).error !== 'unknown orderId') {
    throw new Error(`unknown order: unexpected response ${JSON.stringify(unknown)}`);
  }
  console.log('✅ unknown orderId → 404');

  // shutdown
  (server as { close?: (cb?: () => void) => void }).close?.();
  console.log('\n=== Section 7 verification complete ===');
}

main()
  .then(() => setTimeout(() => process.exit(0), 100))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
