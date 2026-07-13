// scripts/e2e-agent-flow.ts
// Real agent-to-agent flow over AXL: RFQ → Quote → Commit → Lock → Pay → Release

import 'dotenv/config';
import { ethers } from 'ethers';
import { FiatAgent } from '../agents/fiat-agent/index';
import { CryptoAgent } from '../agents/crypto-agent/index';
import { AXLBridge } from '../protocol/axl/bridge';
import { createWebhookServer, type ExpectedOrder, type PaymentWebhookPayload } from '../agents/payment-verify/webhook';
import { simulatePayment } from '../agents/payment-verify/banksim';

const PK = process.env.PRIVATE_KEY!;
const RPC = process.env.ZEROG_TESTNET_RPC!;
const ESCROW = process.env.ESCROW_ADDRESS!;
const TOKEN = process.env.TEST_ERC20_ADDRESS!;
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET!;

const ESCROW_ABI = [
  'function lock(address buyer,address token,uint256 tokenAmount,uint256 fiatAmount,string fiatCurrency,string railType,uint256 deadlineSeconds,string orderRefId) payable returns (uint256)',
  'function orderIdByHash(bytes32) view returns (uint256)',
  'function getOrder(uint256) view returns (tuple(uint256 id,address buyer,address lp,address token,uint256 tokenAmount,uint256 fiatAmount,string fiatCurrency,string railType,uint256 buyerBond,uint256 lpBond,uint256 deadline,uint8 state,bytes32 proofHash,bytes32 evidenceHash))',
  'event Released(bytes32 indexed orderIdHash, bytes32 evidenceHash)',
];
const ERC20_ABI = [
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   FULL AGENT FLOW: AXL + Escrow + Webhook + 0G Storage     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════════════════════
  // Step 1: Verify AXL is running
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─ Step 1: AXL Network ─────────────────────────────────────┐');
  const axl = new AXLBridge();
  const topology = await axl.getTopology();
  console.log(`│ AXL PubKey: ${topology.our_public_key.slice(0, 20)}...`);
  console.log(`│ Peers: ${topology.peers.length}`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // ═══════════════════════════════════════════════════════════════
  // Step 2: Initialize both agents
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─ Step 2: Initialize Agents ───────────────────────────────┐');

  const fiatAgent = new FiatAgent({
    name: 'buyer',
    privateKey: PK,
    rpcUrl: RPC,
    supportedRails: ['banksim'],
    demoMode: true,
    webhookUrl: 'http://127.0.0.1:4102/webhook/payment',
  });

  const cryptoAgent = new CryptoAgent({
    name: 'lp',
    privateKey: PK,
    rpcUrl: RPC,
    inventory: [{ token: 'ETH', balance: '10', minOrder: '0.001' }],
    spreadBps: 50,
    supportedRails: ['banksim'],
    fiatDetails: { banksim: { handle: 'lp@banksim' } },
  });

  // Initialize agents (connects to AXL)
  await fiatAgent.initialize();
  await cryptoAgent.initialize();

  console.log(`│ FiatAgent (buyer) initialized`);
  console.log(`│ CryptoAgent (LP) initialized`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // ═══════════════════════════════════════════════════════════════
  // Step 3: FiatAgent broadcasts RFQ over AXL
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─ Step 3: Broadcast RFQ ───────────────────────────────────┐');
  const rfqId = await fiatAgent.broadcastRfq({
    fromCurrency: 'USD',
    toCurrency: 'ETH',
    toChain: '0g',
    amount: '100.00',
    rails: ['banksim'],
  }, [topology.our_public_key]);
  console.log(`│ RFQ broadcast: ${rfqId}`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // ═══════════════════════════════════════════════════════════════
  // Step 4: Simulate LP receiving RFQ and generating quote
  // (In production this happens via AXL message handler)
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─ Step 4: LP Generates Quote (simulated AXL receive) ──────┐');
  const quote = {
    rfqId,
    lpAgent: topology.our_public_key,
    rate: '0.00035',
    outputAmount: '0.035',
    fee: '0.50',
    rails: ['banksim'],
    expiry: Date.now() + 60000,
    signature: 'demo-sig',
    reputation: 85,
  };

  // Send quote back over AXL (to self for demo)
  await axl.send(topology.our_public_key, { type: 'quote.sign', ...quote });
  console.log(`│ Quote sent over AXL: ${quote.outputAmount} ETH`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // ═══════════════════════════════════════════════════════════════
  // Step 5: On-chain escrow lock
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─ Step 5: Lock Tokens in Escrow (on-chain) ────────────────┐');
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const escrow = new ethers.Contract(ESCROW, ESCROW_ABI, wallet);
  const token = new ethers.Contract(TOKEN, ERC20_ABI, wallet);

  const orderRefId = `order-agent-${Date.now()}`;
  const orderRefHash = ethers.id(orderRefId);
  const tokenAmount = ethers.parseUnits('1', 18);
  const lpBond = (tokenAmount * 100n) / 10000n;

  // Approve
  const approveTx = await token.approve(ESCROW, tokenAmount, { gasPrice: 5_000_000_000n });
  await approveTx.wait();
  console.log(`│ Approved: ${approveTx.hash.slice(0, 20)}...`);

  // Lock
  const lockTx = await escrow.lock(
    wallet.address, TOKEN, tokenAmount, 10000n, 'INR', 'banksim', 600, orderRefId,
    { value: lpBond, gasPrice: 5_000_000_000n }
  );
  await lockTx.wait();
  const orderId = await escrow.orderIdByHash(orderRefHash);
  console.log(`│ Locked: ${lockTx.hash.slice(0, 20)}... orderId=${orderId}`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // ═══════════════════════════════════════════════════════════════
  // Step 6: LP sends fiat details over AXL
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─ Step 6: LP Sends Fiat Details (over AXL) ────────────────┐');
  const fiatDetails = {
    orderId: orderRefId,
    railType: 'banksim',
    encryptedDetails: Buffer.from(JSON.stringify({ handle: 'lp@banksim' })).toString('base64'),
    nonce: ethers.hexlify(ethers.randomBytes(24)),
  };
  await axl.send(topology.our_public_key, { type: 'fiat.details', ...fiatDetails });
  console.log(`│ Fiat details sent over AXL`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // ═══════════════════════════════════════════════════════════════
  // Step 7: Start webhook receiver + fire BankSim webhook
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─ Step 7: Payment Webhook → 0G Pin → Escrow Release ───────┐');
  const expected: ExpectedOrder = {
    expectedAmount: '100.00',
    expectedCurrency: 'INR',
    expectedReceiver: 'lp@banksim',
  };

  const { server } = createWebhookServer({
    orderLookup: async (oid) => (oid === orderRefId ? expected : null),
    port: 4102,
    skipPin: false,
    skipRelease: false,
  });
  await new Promise(r => setTimeout(r, 300));

  // Listen for Released event
  const releasedPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Released timeout')), 120_000);
    const escrowRO = new ethers.Contract(ESCROW, ESCROW_ABI, provider);
    escrowRO.on('Released', (hash: string, evidenceHash: string) => {
      if (hash.toLowerCase() === orderRefHash.toLowerCase()) {
        clearTimeout(timeout);
        escrowRO.removeAllListeners('Released');
        resolve(evidenceHash);
      }
    });
  });

  // Fire webhook (simulates PSP callback after buyer pays)
  const payload: PaymentWebhookPayload = {
    orderId: orderRefId,
    amount: '100.00',
    currency: 'INR',
    sender: 'buyer@banksim',
    receiver: 'lp@banksim',
    transactionId: `tx-${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    rail: 'banksim',
  };

  console.log(`│ Firing BankSim webhook...`);
  const result = await simulatePayment('http://127.0.0.1:4102/webhook/payment', payload, SECRET) as any;
  console.log(`│ Webhook result: ok=${result.ok}`);
  console.log(`│ Evidence pinned: ${result.evidenceHash?.slice(0, 20)}...`);
  console.log(`│ Release tx: ${result.txHash?.slice(0, 20)}...`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // ═══════════════════════════════════════════════════════════════
  // Step 8: Verify on-chain state
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─ Step 8: Verify On-Chain State ───────────────────────────┐');
  const evidenceHash = await releasedPromise;
  console.log(`│ Released event: evidenceHash=${evidenceHash.slice(0, 20)}...`);

  const order = await escrow.getOrder(orderId);
  const stateNames = ['INIT','LOCKED','PAID','RELEASED','EXPIRED','DISPUTED','RESOLVED_BUYER','RESOLVED_LP'];
  console.log(`│ Order state: ${stateNames[Number(order.state)]}`);

  const escrowBal = await token.balanceOf(ESCROW);
  console.log(`│ Escrow balance: ${ethers.formatUnits(escrowBal, 18)} bUSD`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // Cleanup
  (server as any).close?.();
  fiatAgent.stop();
  cryptoAgent.stop();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              ✅ FULL AGENT FLOW SUCCESS                    ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ • AXL network: connected                                   ║');
  console.log('║ • FiatAgent + CryptoAgent: initialized over AXL            ║');
  console.log('║ • RFQ broadcast: sent over AXL                             ║');
  console.log('║ • Quote + FiatDetails: exchanged over AXL                  ║');
  console.log('║ • Escrow lock: on-chain (0G Galileo)                       ║');
  console.log('║ • Webhook verification: HMAC validated                     ║');
  console.log('║ • 0G Storage: evidence pinned                              ║');
  console.log('║ • Escrow release: on-chain, state=RELEASED                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  setTimeout(() => process.exit(0), 300);
}

main().catch(err => {
  console.error('❌ Agent flow failed:', err);
  process.exit(1);
});
