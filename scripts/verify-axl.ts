import { verifyAXLSetup } from '../protocol/axl/bridge';

async function main() {
  console.log('=== AXL Verification ===\n');
  const ok = await verifyAXLSetup();
  console.log(ok ? '\n✅ AXL OK' : '\n❌ AXL FAILED');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
