// scripts/verify-section9.ts
import { FiatAgent } from '../agents/fiat-agent/index';
import { CryptoAgent } from '../agents/crypto-agent/index';

async function main() {
  console.log('=== Section 9: Agent Runtime Verification ===\n');

  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.ZEROG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai';

  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not set');
    process.exit(1);
  }

  console.log('1. Verifying FiatAgent instantiation...');
  const fiatAgent = new FiatAgent({
    name: 'test-fiat-agent',
    privateKey,
    rpcUrl,
    supportedRails: ['banksim', 'upi'],
    demoMode: true,
    webhookUrl: 'http://localhost:4001/webhook/payment',
  });
  console.log(`   ✅ FiatAgent created, wallet: ${fiatAgent.getAddress()}`);

  console.log('\n2. Verifying CryptoAgent instantiation...');
  const cryptoAgent = new CryptoAgent({
    name: 'test-crypto-agent',
    privateKey,
    rpcUrl,
    inventory: [
      { token: 'ETH', balance: '1.0', minOrder: '0.01' },
      { token: 'USDC', balance: '1000', minOrder: '10' },
    ],
    spreadBps: 50,
    supportedRails: ['banksim', 'upi', 'venmo'],
    fiatDetails: {
      banksim: { handle: 'lp@banksim' },
      upi: { vpa: 'lp@upi' },
    },
  });
  console.log(`   ✅ CryptoAgent created, wallet: ${cryptoAgent.getAddress()}`);

  console.log('\n3. Testing RFQ broadcast (requires AXL node on :9002)...');
  try {
    const rfqId = await fiatAgent.broadcastRfq({
      fromCurrency: 'USD',
      toCurrency: 'ETH',
      toChain: '0g',
      amount: '100.00',
      rails: ['banksim'],
    }, []);
    console.log(`   ✅ RFQ created: ${rfqId}`);
  } catch (err: any) {
    if (err.cause?.code === 'ECONNREFUSED') {
      console.log('   ⚠️  Skipped (AXL node not running)');
    } else {
      throw err;
    }
  }

  console.log('\n=== Section 9 Verification Complete ===');
  console.log('Note: Full e2e test requires AXL node running on :9002');
}

main().catch(console.error);
