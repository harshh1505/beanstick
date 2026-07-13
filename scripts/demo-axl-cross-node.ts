// scripts/demo-axl-cross-node.ts
// Demonstrates 2 AXL nodes communicating for hackathon demo video

import 'dotenv/config';
import { AXLBridge } from '../protocol/axl/bridge';

const NODE_A_URL = 'http://127.0.0.1:9002';
const NODE_B_URL = 'http://127.0.0.1:9012';

async function demo() {
  console.log('=== AXL Cross-Node Demo ===\n');

  const nodeA = new AXLBridge(NODE_A_URL);
  const nodeB = new AXLBridge(NODE_B_URL);

  // Get topology from both nodes
  console.log('1. Getting node identities...\n');

  const topoA = await nodeA.getTopology();
  const topoB = await nodeB.getTopology();

  console.log(`   Node A pubkey: ${topoA.our_public_key.slice(0, 32)}...`);
  console.log(`   Node B pubkey: ${topoB.our_public_key.slice(0, 32)}...`);
  console.log(`   Node A peers:  ${topoA.peers.length}`);
  console.log(`   Node B peers:  ${topoB.peers.length}\n`);

  // Send RFQ from Node A (buyer) to Node B (LP)
  console.log('2. Sending RFQ from Node A → Node B...\n');

  const rfq = {
    type: 'rfq.get',
    rfqId: `demo-${Date.now()}`,
    buyerAgent: topoA.our_public_key,
    intent: {
      action: 'buy',
      fiatAmount: '100',
      fiatCurrency: 'USD',
      cryptoToken: 'ETH',
      rail: 'banksim',
    },
    timestamp: Date.now(),
  };

  await nodeA.send(topoB.our_public_key, rfq);
  console.log(`   ✓ RFQ sent: ${rfq.rfqId}\n`);

  // Wait and receive on Node B
  console.log('3. Receiving on Node B...\n');

  await new Promise((r) => setTimeout(r, 1000));

  const message = await nodeB.recv();
  if (message) {
    console.log(`   ✓ Received message`);
    console.log(`   From peer: ${message.from.slice(0, 32)}...`);
    console.log(`   Message type: ${message.data.type}`);
    console.log(`   Buyer: ${message.data.buyerAgent?.slice(0, 32)}...`);
    console.log(`   Intent: ${JSON.stringify(message.data.intent)}\n`);
  } else {
    console.log('   (no messages yet - may need retry)\n');
  }

  // Send quote back from Node B → Node A
  console.log('4. Sending quote from Node B → Node A...\n');

  const quote = {
    type: 'quote.sign',
    rfqId: rfq.rfqId,
    lpAgent: topoB.our_public_key,
    rate: '0.00033',
    cryptoAmount: '0.033',
    expiresAt: Date.now() + 300000,
    fiatDetails: { rail: 'banksim', account: 'lp@banksim' },
  };

  await nodeB.send(topoA.our_public_key, quote);
  console.log(`   ✓ Quote sent: rate ${quote.rate} ETH/USD\n`);

  // Receive quote on Node A
  console.log('5. Receiving quote on Node A...\n');

  await new Promise((r) => setTimeout(r, 1000));

  const quoteMsg = await nodeA.recv();
  if (quoteMsg) {
    console.log(`   ✓ Received quote`);
    console.log(`   From peer: ${quoteMsg.from.slice(0, 32)}...`);
    console.log(`   LP: ${quoteMsg.data.lpAgent?.slice(0, 32)}...`);
    console.log(`   Rate: ${quoteMsg.data.rate} ETH/USD`);
    console.log(`   Amount: ${quoteMsg.data.cryptoAmount} ETH\n`);
  } else {
    console.log('   (no quotes yet)\n');
  }

  console.log('=== Demo Complete ===');
  console.log('\nThis demonstrates:');
  console.log('  • Two separate AXL nodes with different keys');
  console.log('  • P2P encrypted communication (no central server)');
  console.log('  • RFQ broadcast and quote response flow');
}

demo().catch(console.error);
