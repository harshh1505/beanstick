// IRL: actually call the qwen inference service on 0G Compute.
import 'dotenv/config';
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

async function main() {
  const pk = process.env.PRIVATE_KEY!;
  const provider = new ethers.JsonRpcProvider(process.env.ZEROG_TESTNET_RPC);
  const wallet = new ethers.Wallet(pk, provider);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} 0G`);

  const broker = await createZGComputeNetworkBroker(wallet);

  // Ensure ledger is funded (required for inference billing)
  let ledger;
  try {
    ledger = await broker.ledger.getLedger();
    const balA0gi = ethers.formatEther(ledger.totalBalance ?? 0n);
    console.log(`Ledger: total=${balA0gi} A0GI`);
  } catch (e: any) {
    console.log(`No ledger yet (${e.message}), creating with 0.01 OG...`);
    await broker.ledger.addLedger(0.01);
    ledger = await broker.ledger.getLedger();
    console.log(`Ledger created: total=${ethers.formatEther(ledger.totalBalance ?? 0n)} A0GI`);
  }

  // Pick the qwen service
  const services = await broker.inference.listService();
  const svc = services.find((s: any) => String(s.model).includes('qwen')) ?? services[0];
  console.log(`Service: provider=${svc.provider} model=${svc.model}`);

  // Acknowledge provider (required before first use)
  try {
    await broker.inference.acknowledgeProviderSigner(svc.provider);
    console.log('Provider acknowledged');
  } catch (e: any) {
    console.log(`Acknowledge skipped: ${e.message}`);
  }

  const { endpoint, model } = await broker.inference.getServiceMetadata(svc.provider);
  console.log(`Endpoint: ${endpoint} (model=${model})`);

  const question = 'Reply with exactly the single word: PONG';
  const headers = await broker.inference.getRequestHeaders(svc.provider, question);

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: question }],
    }),
  });
  const data: any = await res.json();
  if (!res.ok) { console.error('HTTP', res.status, data); process.exit(1); }
  const answer = data.choices?.[0]?.message?.content ?? '(no content)';
  console.log(`Response: ${answer.trim()}`);

  // TEE verify response
  const chatId = res.headers.get('ZG-Res-Key') || data.id;
  if (chatId) {
    const valid = await broker.inference.processResponse(svc.provider, answer, chatId);
    console.log(`TEE verified: ${valid}`);
  }
  console.log('✅ Compute IRL OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
