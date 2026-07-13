// scripts/test-inft.ts
import 'dotenv/config';
import { INFTClient } from '../contracts/src/inft-client';

const INFT_ADDRESS = process.env.INFT_CONTRACT_ADDRESS!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const RPC_URL = process.env.ZEROG_TESTNET_RPC!;

async function main() {
  console.log('Testing iNFT contract at:', INFT_ADDRESS);

  const client = new INFTClient(INFT_ADDRESS, PRIVATE_KEY, RPC_URL);

  // Test wallet
  const testWallet = '0x1234567890123456789012345678901234567890';
  const ownerWallet = '0x' + PRIVATE_KEY.slice(-40); // derive from private key

  console.log('\n1. Minting agent pair...');
  try {
    const result = await client.mintAgentPair(
      ownerWallet,
      testWallet,
      'axl_fiat_pubkey_test_123',
      'axl_crypto_pubkey_test_456'
    );
    console.log('   Fiat Token ID:', result.fiatTokenId.toString());
    console.log('   Crypto Token ID:', result.cryptoTokenId.toString());
    console.log('   TX Hash:', result.txHash);

    console.log('\n2. Fetching metadata for fiat agent...');
    const fiatMeta = await client.getAgentMetadata(result.fiatTokenId);
    console.log('   Agent Type:', fiatMeta.agentType);
    console.log('   Wallet:', fiatMeta.walletAddress);
    console.log('   AXL Pubkey:', fiatMeta.axlPubkey);
    console.log('   Active:', fiatMeta.isActive);

    console.log('\n3. Fetching intelligent data...');
    const data = await client.getIntelligentData(result.fiatTokenId);
    console.log('   Data entries:', data.length);
    data.forEach((d, i) => console.log(`   [${i}] ${d.dataDescription}`));

    console.log('\n4. Fetching tokenURI...');
    const uri = await client.getTokenURI(result.fiatTokenId);
    console.log('   URI:', uri.slice(0, 100) + '...');

    console.log('\n5. Updating agent state...');
    const newHash = '0x' + 'ab'.repeat(32);
    const updateTx = await client.updateAgentState(result.fiatTokenId, newHash);
    console.log('   Update TX:', updateTx);

    console.log('\n✅ All tests passed!');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.data) console.error('   Data:', err.data);
  }
}

main();
