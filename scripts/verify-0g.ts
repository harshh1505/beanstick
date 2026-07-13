import 'dotenv/config';
import { verifyStorageSetup } from '../zerog/storage/client';
import { verifyComputeSetup } from '../zerog/compute/client';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey.startsWith('<')) {
    console.error('PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  console.log('=== 0G Platform Verification ===\n');

  let storageOk = false;
  try {
    storageOk = await verifyStorageSetup();
  } catch (e: any) {
    console.error('[0G Storage] Error:', e.message);
  }
  console.log(storageOk ? 'Storage OK' : 'Storage FAILED');

  let computeOk = false;
  try {
    computeOk = await verifyComputeSetup(privateKey);
  } catch (e: any) {
    console.error('[0G Compute] Error:', e.message);
  }
  console.log(computeOk ? 'Compute OK' : 'Compute FAILED');

  console.log('\n=== Verification Complete ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
