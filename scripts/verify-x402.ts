// scripts/verify-x402.ts
//
// Smoke-tests the x402 v2 client + middleware wiring without hitting the live
// facilitator. We:
//   1. Construct an X402Client from PRIVATE_KEY and confirm the viem account
//      derives a valid 0x address.
//   2. Build an Express paymentMiddleware for a sample route and assert it
//      returns a function (i.e. all imports resolved + facilitator client
//      constructed cleanly).
//
// To exercise an end-to-end paid call, point X402_FACILITATOR_URL at a real
// facilitator and a paywalled resource — out of scope for this verifier.

import 'dotenv/config';
import { X402Client } from '../protocol/x402/client';
import { buildX402Middleware } from '../protocol/x402/middleware';

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('❌ PRIVATE_KEY not set');
    process.exit(1);
  }

  console.log('=== x402 v2 Verification ===\n');

  // 1. Client
  const client = new X402Client({ privateKey: pk, network: 'eip155:84532' });
  if (!/^0x[0-9a-fA-F]{40}$/.test(client.account.address)) {
    throw new Error(`Bad address derived: ${client.account.address}`);
  }
  console.log(`✅ Client wallet: ${client.account.address}`);

  // 2. Middleware
  const mw = buildX402Middleware({
    routes: {
      'GET /api/protected': {
        price: '$0.01',
        payTo: client.account.address,
        network: 'eip155:84532',
        description: 'Beanstick demo paywalled resource',
      },
    },
    syncFacilitatorOnStart: false,
  });
  if (typeof mw !== 'function') {
    throw new Error('paymentMiddleware did not return a function');
  }
  console.log('✅ Middleware constructed (paymentMiddleware is a function)');

  console.log(
    `\nFacilitator: ${process.env.X402_FACILITATOR_URL || 'https://facilitator.x402.org'}`,
  );
  console.log('=== Verification Complete ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
