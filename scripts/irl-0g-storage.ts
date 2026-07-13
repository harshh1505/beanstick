// IRL: actually upload bytes to 0G Storage, then download and verify round-trip.
import 'dotenv/config';
import { ZeroGStorage } from '../zerog/storage/client';
import { ethers } from 'ethers';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

async function main() {
  const pk = process.env.PRIVATE_KEY!;
  const provider = new ethers.JsonRpcProvider(process.env.ZEROG_TESTNET_RPC);
  const wallet = new ethers.Wallet(pk, provider);
  console.log(`Wallet: ${wallet.address}`);
  const bal = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(bal)} 0G`);

  const storage = new ZeroGStorage(pk);

  const payload = new TextEncoder().encode(
    JSON.stringify({ msg: 'beanstick-irl-test', rand: crypto.randomBytes(8).toString('hex'), ts: Date.now() }),
  );
  const sha = crypto.createHash('sha256').update(payload).digest('hex');
  console.log(`Uploading ${payload.byteLength}B, sha256=${sha}`);

  const rootHash = await storage.uploadProof(payload);
  console.log(`rootHash=${rootHash}`);

  // wait a bit for indexer to propagate
  await new Promise((r) => setTimeout(r, 8000));

  const out = path.join(os.tmpdir(), `beanstick-irl-${Date.now()}.bin`);
  await storage.downloadProof(rootHash, out);
  const downloaded = fs.readFileSync(out);
  const downSha = crypto.createHash('sha256').update(downloaded).digest('hex');
  console.log(`downloaded ${downloaded.byteLength}B sha256=${downSha}`);
  console.log(downSha === sha ? '✅ round-trip OK' : '❌ hash mismatch');
  fs.unlinkSync(out);
}
main().catch((e) => { console.error(e); process.exit(1); });
