// scripts/e2e-kh-webhook.ts
//
// Live end-to-end through KeeperHub:
//   PSP (BankSim) → KeeperHub webhook trigger → KeeperHub Send Webhook action
//   → cloudflared tunnel → local receiver → 0G Storage pin → Base Sepolia
//   Escrow.release(orderRefHash, evidenceHash) → on-chain Released event.

import 'dotenv/config';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ethers } from 'ethers';

// Webhook trigger requires a `wfb_` (user-scoped) key per KH docs at
// /api/authentication. Org `kh_` keys return 'Invalid API key format' here.
const WFB_KEY = process.env.WFB_KEY!;
const KH_WORKFLOW_ID = 'kap46a2jtab0dex082u0y';
const KH_WEBHOOK_URL = `https://app.keeperhub.com/api/workflows/${KH_WORKFLOW_ID}/webhook`;
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET!;
const ESCROW = process.env.ESCROW_ADDRESS_BASESEP!;
const TOKEN = process.env.TEST_ERC20_ADDRESS_BASESEP!;
const PK = process.env.PRIVATE_KEY!;
const ORDERS_FILE = '/tmp/beanstick-orders.json';
// Fresh ref per run so we always lock a brand-new order (prevents
// InvalidState reverts from re-attempting release on an already-RELEASED id).
const REF = `order-kh-${Date.now()}`;

const ESCROW_ABI = [
  'function lock(address buyer,address token,uint256 tokenAmount,uint256 fiatAmount,string fiatCurrency,string railType,uint256 deadlineSeconds,string orderRefId) payable returns (uint256)',
  'function orderIdByHash(bytes32) view returns (uint256)',
  'event Released(bytes32 indexed orderIdHash, bytes32 evidenceHash)',
];
const ERC20_ABI = ['function approve(address,uint256) returns (bool)'];

async function lockFreshOrder() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const wallet = new ethers.Wallet(PK, provider);
  const escrow = new ethers.Contract(ESCROW, ESCROW_ABI, wallet);
  const token = new ethers.Contract(TOKEN, ERC20_ABI, wallet);
  const amount = ethers.parseUnits('1', 18);
  console.log(`[setup] approve+lock fresh order ${REF}`);
  const a = await token.approve(ESCROW, amount);
  await a.wait();
  const tx = await escrow.lock(
    wallet.address, TOKEN, amount, 10000n, 'INR', 'banksim', 600, REF,
    { value: amount / 100n },
  );
  await tx.wait();
  console.log(`[setup] locked, tx=${tx.hash}`);
  // Register expected payment in receiver's order lookup file.
  let orders: Record<string, unknown> = {};
  try { orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); } catch {}
  orders[REF] = { expectedAmount: '100.00', expectedCurrency: 'INR', expectedReceiver: 'lp@upi' };
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

async function main() {
  await lockFreshOrder();
  // Canonical body matches the field order Code reconstructs in KH.
  const canonical = {
    orderId: REF,
    amount: '100.00',
    currency: 'INR',
    sender: 'buyer@upi',
    receiver: 'lp@upi',
    transactionId: `tx-kh-${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    rail: 'banksim',
  };
  const canonicalStr = JSON.stringify(canonical);
  const sig =
    'sha256=' + crypto.createHmac('sha256', SECRET).update(canonicalStr).digest('hex');
  // PSP sends body PLUS _signature. Code node will recompute HMAC over the
  // canonical body (excluding _signature) and verify it matches.
  const body = JSON.stringify({ ...canonical, _signature: sig });

  // Use polling for the Released event — public Base Sepolia RPC GCs filter
  // subscriptions aggressively, breaking provider.on('event') after ~60s.
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const escrow = new ethers.Contract(
    ESCROW,
    ['event Released(bytes32 indexed orderIdHash, bytes32 evidenceHash)'],
    provider,
  );
  const refHash = ethers.id(REF);
  const fromBlock = await provider.getBlockNumber();
  const releasedP = (async () => {
    const deadline = Date.now() + 180_000;
    const topic = escrow.filters.Released(refHash);
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      const logs = await escrow.queryFilter(topic, fromBlock, 'latest');
      if (logs.length > 0) {
        const ev = logs[0] as ethers.EventLog;
        return { evidenceHash: ev.args.evidenceHash as string, txHash: ev.transactionHash };
      }
    }
    throw new Error('Released not seen in 180s');
  })();

  console.log('=== Live e2e: PSP → KeeperHub → tunnel → receiver → Escrow ===');
  console.log(`POST ${KH_WEBHOOK_URL}`);
  const res = await fetch(KH_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WFB_KEY}`,
      'Content-Type': 'application/json',
    },
    body, // _signature is INSIDE the body now
  });
  const text = await res.text();
  console.log(`KH webhook trigger response: ${res.status} ${text.slice(0, 400)}`);

  console.log('\nWaiting for on-chain Released event…');
  const ev = await releasedP;
  console.log(`✅ Released seen on Base Sepolia. evidenceHash=${ev.evidenceHash}  tx=${ev.txHash}`);
  setTimeout(() => process.exit(0), 200);
}

main().catch((e) => { console.error(e); process.exit(1); });
