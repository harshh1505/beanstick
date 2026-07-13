import {
  MCP_TOOLS,
  RfqGetSchema,
  QuoteSignSchema,
  ProofSubmitSchema,
} from '../protocol/mcp/schemas';
import { MCPAgentServer, createFiatAgentMCPServer } from '../protocol/mcp/server';
import { MCPAgentClient } from '../protocol/mcp/client';
import { AXLBridge } from '../protocol/axl/bridge';

async function main() {
  console.log('=== MCP Verification ===\n');

  // 1. Tool registry
  const toolNames = Object.keys(MCP_TOOLS);
  console.log(`[1/4] Registered tools (${toolNames.length}): ${toolNames.join(', ')}`);

  // 2. Schema parse — valid RFQ
  const rfq = RfqGetSchema.parse({
    intent: {
      fromCurrency: 'USD',
      toCurrency: 'ETH',
      toChain: '0g',
      amount: '100.00',
      rails: ['upi', 'venmo'],
    },
    buyerAgent: 'b14d8078246fdbfc1fa1a5aa68e0568925476f4f979806a2d40ee766c7662acc',
    timestamp: Date.now(),
    ttl: 30,
  });
  console.log(`[2/4] RFQ parsed OK: ${rfq.intent.amount} ${rfq.intent.fromCurrency} -> ${rfq.intent.toCurrency}`);

  // 3. Schema parse — reject invalid
  const invalid = QuoteSignSchema.safeParse({ rfqId: 'x' });
  console.log(`[3/4] Invalid quote rejected: ${!invalid.success}`);

  // 4. Server + Client instantiate cleanly
  const server: MCPAgentServer = createFiatAgentMCPServer();
  const client = new MCPAgentClient(new AXLBridge());
  console.log(`[4/4] Server + Client instantiated: ${!!server && !!client}`);

  // Sanity: ProofSubmit shape
  ProofSubmitSchema.parse({
    orderId: 'order-1',
    proofType: 'zktls',
    railType: 'upi',
    proof: {
      circuit: 'upi',
      publicSignals: ['1'],
      groth16Proof: { a: ['0', '0'], b: [['0', '0'], ['0', '0']], c: ['0', '0'] },
    },
    metadata: { amount: '100', currency: 'INR', timestamp: 0, transactionId: 'tx' },
    storageRootHash: '0xabc',
  });

  console.log('\nMCP OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
