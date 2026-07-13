// Quick: lock 1 bUSD with orderRefId "order-kh-test-1" on Base Sepolia.
import 'dotenv/config';
import { ethers } from 'ethers';

const RPC = 'https://sepolia.base.org';
const PK = process.env.PRIVATE_KEY!;
const ESCROW = process.env.ESCROW_ADDRESS_BASESEP!;
const TOKEN = process.env.TEST_ERC20_ADDRESS_BASESEP!;
const REF = 'order-kh-test-1';

const ESCROW_ABI = [
  'function lock(address buyer,address token,uint256 tokenAmount,uint256 fiatAmount,string fiatCurrency,string railType,uint256 deadlineSeconds,string orderRefId) payable returns (uint256)',
  'function orderIdByHash(bytes32) view returns (uint256)',
];
const ERC20 = ['function approve(address,uint256) returns (bool)'];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const escrow = new ethers.Contract(ESCROW, ESCROW_ABI, wallet);
  const token = new ethers.Contract(TOKEN, ERC20, wallet);
  const amount = ethers.parseUnits('1', 18);

  const existing: bigint = await escrow.orderIdByHash(ethers.id(REF));
  if (existing > 0n) {
    console.log(`order ${REF} already locked at id=${existing}`);
    return;
  }

  console.log('approving…');
  const a = await token.approve(ESCROW, amount);
  await a.wait();
  console.log('locking…');
  const tx = await escrow.lock(
    wallet.address, TOKEN, amount, 10000n, 'INR', 'banksim', 600, REF,
    { value: amount / 100n },
  );
  await tx.wait();
  const id = await escrow.orderIdByHash(ethers.id(REF));
  console.log(`locked order ${REF} → id=${id}, tx=${tx.hash}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
