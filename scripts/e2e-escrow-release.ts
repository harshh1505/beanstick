// scripts/e2e-escrow-release.ts
//
// Real end-to-end exercise of the §7 webhook → 0G pin → on-chain release path
// against the live Section 8 Escrow on 0G Galileo.
//
//   1. LP (deployer) approves Escrow to pull bUSD.
//   2. LP calls Escrow.lock(buyer=deployer, token=bUSD, amount=100, fiatAmt=10000,
//      "INR", "banksim", 600s, orderRefId="order-e2e-<ts>").
//   3. Boot the Hono webhook receiver with skipPin=false, skipRelease=false.
//   4. BankSim emitter fires a signed PSP webhook for that orderId.
//   5. Receiver verifies HMAC → validates → pins to 0G Storage → calls
//      Escrow.release(orderIdHash, evidenceHash) (deployer is keeper).
//   6. Wait for `Released(orderIdHash, evidenceHash)` event; assert state +
//      that buyer balance increased by 100 bUSD.

import 'dotenv/config';
import { ethers } from 'ethers';
import {
  createWebhookServer,
  type PaymentWebhookPayload,
  type ExpectedOrder,
} from '../agents/payment-verify/webhook';
import { simulatePayment } from '../agents/payment-verify/banksim';

const RPC = process.env.ZEROG_TESTNET_RPC!;
const PK = process.env.PRIVATE_KEY!;
const ESCROW = process.env.ESCROW_ADDRESS!;
const TOKEN = process.env.TEST_ERC20_ADDRESS!;
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET!;
const PORT = 4101;
const WEBHOOK_URL = `http://127.0.0.1:${PORT}/webhook/payment`;

const ESCROW_ABI = [
  'function lock(address buyer,address token,uint256 tokenAmount,uint256 fiatAmount,string fiatCurrency,string railType,uint256 deadlineSeconds,string orderRefId) payable returns (uint256)',
  'function orderIdByHash(bytes32) view returns (uint256)',
  'function getOrder(uint256) view returns (tuple(uint256 id,address buyer,address lp,address token,uint256 tokenAmount,uint256 fiatAmount,string fiatCurrency,string railType,uint256 buyerBond,uint256 lpBond,uint256 deadline,uint8 state,bytes32 proofHash,bytes32 evidenceHash))',
  'event OrderLocked(uint256 indexed orderId, uint256 tokenAmount, uint256 deadline)',
  'event Released(bytes32 indexed orderIdHash, bytes32 evidenceHash)',
];
const ERC20_ABI = [
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

async function main() {
  for (const [k, v] of Object.entries({ RPC, PK, ESCROW, TOKEN, SECRET })) {
    if (!v) throw new Error(`env ${k} missing`);
  }
  const provider = new ethers.JsonRpcProvider(RPC);
  const lp = new ethers.Wallet(PK, provider); // also keeper, also buyer (for test)
  const buyer = lp.address;
  const lpAddr = lp.address;
  // Wallet only has ~0.09 0G; bond is 1% of tokenAmount in native token, so
  // keep tokenAmount small (1 bUSD → 0.01 0G bond + gas fits comfortably).
  const tokenAmount = ethers.parseUnits('1', 18);
  const fiatAmount = 10000n;
  const orderRefId = `order-e2e-${Date.now()}`;
  const orderRefHash = ethers.id(orderRefId);

  console.log('=== Live e2e: webhook → 0G pin → Escrow.release ===\n');
  console.log(`buyer/lp/keeper: ${buyer}`);
  console.log(`escrow         : ${ESCROW}`);
  console.log(`token          : ${TOKEN}`);
  console.log(`orderRefId     : ${orderRefId}`);
  console.log(`orderRefHash   : ${orderRefHash}\n`);

  const escrow = new ethers.Contract(ESCROW, ESCROW_ABI, lp);
  const token = new ethers.Contract(TOKEN, ERC20_ABI, lp);

  // 1. approve
  const beforeBuyer: bigint = await token.balanceOf(buyer);
  console.log(`buyer balance before lock+release : ${ethers.formatUnits(beforeBuyer, 18)} bUSD`);
  const opts = {
    gasPrice: 5_000_000_000n,
    maxPriorityFeePerGas: 2_000_000_000n,
    maxFeePerGas: 5_000_000_000n,
  };
  console.log('1. approve(escrow, 1 bUSD)…');
  const a = await token.approve(ESCROW, tokenAmount, { gasPrice: 5_000_000_000n });
  await a.wait();
  console.log(`   tx=${a.hash}`);

  // 2. lock
  console.log('2. escrow.lock(buyer, token, 1, 10000 INR, "banksim", 600s, orderRefId)…');
  const lpBond = (tokenAmount * 100n) / 10000n; // 1%
  const lockTx = await escrow.lock(
    buyer,
    TOKEN,
    tokenAmount,
    fiatAmount,
    'INR',
    'banksim',
    600,
    orderRefId,
    { value: lpBond, gasPrice: 5_000_000_000n },
  );
  const lockReceipt = await lockTx.wait();
  console.log(`   tx=${lockTx.hash}`);
  const id: bigint = await escrow.orderIdByHash(orderRefHash);
  console.log(`   on-chain orderId=${id}`);
  if (id === 0n) throw new Error('lock did not register orderRefHash');

  // 3. Boot webhook receiver (live: pins + releases for real)
  const expected: ExpectedOrder = {
    expectedAmount: '100.00',
    expectedCurrency: 'INR',
    expectedReceiver: 'lp@upi',
  };
  const { server } = createWebhookServer({
    orderLookup: async (oid) => (oid === orderRefId ? expected : null),
    port: PORT,
    skipPin: false,
    skipRelease: false,
  });
  await new Promise((r) => setTimeout(r, 200));

  // Pre-arm event listener BEFORE firing the webhook
  const releasedPromise = new Promise<{ evidenceHash: string }>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Released event not seen in 120s')), 120_000);
    const escrowRO = new ethers.Contract(ESCROW, ESCROW_ABI, provider);
    escrowRO.on('Released', (hash: string, evidenceHash: string) => {
      if (hash.toLowerCase() === orderRefHash.toLowerCase()) {
        clearTimeout(t);
        escrowRO.removeAllListeners('Released');
        resolve({ evidenceHash });
      }
    });
  });

  // 4. fire webhook
  console.log('\n3. fire signed BankSim webhook…');
  const payload: PaymentWebhookPayload = {
    orderId: orderRefId,
    amount: '100.00',
    currency: 'INR',
    sender: 'buyer@upi',
    receiver: 'lp@upi',
    transactionId: `tx-${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    rail: 'banksim',
  };
  const result = (await simulatePayment(WEBHOOK_URL, payload, SECRET)) as {
    ok?: boolean;
    evidenceHash?: string;
    txHash?: string;
  };
  if (!result.ok) throw new Error('webhook did not return ok');
  console.log(`   evidenceHash = ${result.evidenceHash}`);
  console.log(`   release txHash = ${result.txHash}`);

  // 5. wait for on-chain Released event
  console.log('\n4. waiting for Released event on-chain…');
  const ev = await releasedPromise;
  console.log(`   ✅ Released seen, evidenceHash from event = ${ev.evidenceHash}`);

  // 6. Verify state + balance
  const order = await escrow.getOrder(id);
  const stateNames = [
    'INIT','LOCKED','PAID','RELEASED','EXPIRED','DISPUTED','RESOLVED_BUYER','RESOLVED_LP',
  ];
  const stateName = stateNames[Number(order.state)];
  console.log(`   order.state    = ${stateName}`);
  if (stateName !== 'RELEASED') throw new Error(`expected RELEASED, got ${stateName}`);
  if (order.evidenceHash.toLowerCase() !== ev.evidenceHash.toLowerCase()) {
    throw new Error('evidenceHash on order does not match event');
  }

  const afterBuyer: bigint = await token.balanceOf(buyer);
  console.log(`   buyer balance after release  = ${ethers.formatUnits(afterBuyer, 18)} bUSD`);
  // Net effect: buyer received tokenAmount, but LP also paid them (same wallet),
  // so net delta is 0; we just check the contract no longer holds them.
  const escrowBal: bigint = await token.balanceOf(ESCROW);
  console.log(`   escrow balance after release = ${ethers.formatUnits(escrowBal, 18)} bUSD`);
  if (escrowBal !== 0n) throw new Error('escrow still holds tokens after release');

  (server as { close?: (cb?: () => void) => void }).close?.();
  console.log('\n=== ✅ live e2e success ===');
  // ethers keeps the provider's polling open; force exit.
  setTimeout(() => process.exit(0), 250);
}

main().catch((err) => {
  console.error('\n❌ e2e failed:', err);
  process.exit(1);
});
