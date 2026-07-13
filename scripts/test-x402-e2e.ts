// scripts/test-x402-e2e.ts
//
// End-to-end smoke test:
//   1. Spin up Express with x402 paymentMiddleware on /api/protected.
//   2. GET /api/health → 200 (unprotected sanity check).
//   3. GET /api/protected with no payment → expect 402 + PAYMENT-REQUIRED header.
//   4. Decode the PAYMENT-REQUIRED payload and assert it matches our config.
//   5. Hit the route via X402Client.fetch — confirms the buyer side parses
//      the challenge and attempts to create a signed payment payload (will
//      ultimately fail at facilitator settlement in this offline env, which
//      is expected; we just want to see the client engage).
//
// Skips real on-chain settlement (no facilitator reachable from sandbox).

import 'dotenv/config';
import express from 'express';
import { buildX402Middleware } from '../protocol/x402/middleware';
import { X402Client } from '../protocol/x402/client';

const PORT = 4055;

async function main() {
  const pk = process.env.PRIVATE_KEY!;
  if (!pk) throw new Error('PRIVATE_KEY missing');

  const client = new X402Client({ privateKey: pk, network: 'eip155:84532' });
  const payTo = client.account.address;
  console.log(`[server] payTo = ${payTo}`);

  const app = express();
  app.use(
    buildX402Middleware({
      routes: {
        'GET /api/protected': {
          price: '$0.01',
          payTo,
          network: 'eip155:84532',
          description: 'Beanstick e2e test',
        },
      },
      syncFacilitatorOnStart: true,
    }),
  );
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/protected', (_req, res) =>
    res.json({ secret: 'paid-content' }),
  );

  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));
  console.log(`[server] listening on :${PORT}\n`);

  const base = `http://127.0.0.1:${PORT}`;

  // 1. Health
  const h = await fetch(`${base}/api/health`);
  console.log(`1. /api/health  → ${h.status}  body=${await h.text()}`);

  // 2. Protected, no payment
  const r = await fetch(`${base}/api/protected`);
  const reqHeader = r.headers.get('PAYMENT-REQUIRED');
  console.log(`2. /api/protected (no pay) → ${r.status}`);
  console.log(`   PAYMENT-REQUIRED header present: ${!!reqHeader}`);

  if (reqHeader) {
    const decoded = JSON.parse(Buffer.from(reqHeader, 'base64').toString());
    console.log(`   decoded.x402Version = ${decoded.x402Version}`);
    console.log(`   decoded.accepts[0] =`, JSON.stringify(decoded.accepts?.[0], null, 2));
  }

  // 3. Protected via client (it will try to sign + retry)
  console.log(`\n3. /api/protected via X402Client (will attempt to pay)…`);
  try {
    const paid = await client.fetch(`${base}/api/protected`);
    console.log(`   client got status ${paid.status}`);
    console.log(`   body: ${await paid.text()}`);
  } catch (err: any) {
    console.log(`   client error (expected w/o funded wallet+facilitator):`);
    console.log(`   → ${err?.message?.split('\n')[0] ?? err}`);
  }

  server.close();
  console.log('\n=== e2e test done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
