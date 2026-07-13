// Live stdio MCP test: spawn the fiat-agent server, speak JSON-RPC to it,
// assert that tools/list returns 6 tools and tools/call rfq.get works.
import { spawn } from 'node:child_process';
import path from 'node:path';

async function main() {
  const entry = path.resolve(__dirname, 'mcp-server-entry.ts');
  const child = spawn('npx', ['tsx', entry], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env,
  });

  const pending = new Map<number, (msg: any) => void>();
  let buf = '';
  child.stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString('utf8');
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)!(msg);
          pending.delete(msg.id);
        }
      } catch {
        // non-JSON (e.g., "[MCP Server] Started") — ignore
      }
    }
  });

  let nextId = 1;
  const rpc = (method: string, params: any) =>
    new Promise<any>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 5000);
    });

  await new Promise((r) => setTimeout(r, 1500)); // let server boot

  // 1. Initialize
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'verify-mcp-stdio', version: '1.0.0' },
  });
  console.log(`[1/3] initialize OK: server=${init.result.serverInfo.name}`);

  child.stdin.write(
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n',
  );

  // 2. tools/list
  const list = await rpc('tools/list', {});
  const tools: any[] = list.result.tools;
  const names = tools.map((t) => t.name).sort();
  const expected = ['dispute.open', 'fiat.details', 'order.commit', 'proof.submit', 'quote.sign', 'rfq.get'];
  const match = JSON.stringify(names) === JSON.stringify(expected);
  console.log(`[2/3] tools/list -> ${tools.length} tools, names match: ${match}`);
  if (!match) throw new Error(`expected ${expected} got ${names}`);

  // 3. tools/call rfq.get
  const call = await rpc('tools/call', {
    name: 'rfq.get',
    arguments: {
      intent: {
        fromCurrency: 'USD',
        toCurrency: 'ETH',
        toChain: '0g',
        amount: '100.00',
        rails: ['upi'],
      },
      buyerAgent: 'b14d8078246fdbfc1fa1a5aa68e0568925476f4f979806a2d40ee766c7662acc',
      timestamp: Date.now(),
      ttl: 30,
    },
  });
  const payload = JSON.parse(call.result.content[0].text);
  const ok = payload.status === 'broadcast' && typeof payload.rfqId === 'string';
  console.log(`[3/3] tools/call rfq.get -> rfqId=${payload.rfqId} status=${payload.status} OK=${ok}`);
  if (!ok) throw new Error('rfq.get response invalid');

  child.kill();
  console.log('\n✅ MCP stdio integration OK');
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
