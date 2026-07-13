// protocol/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOLS, RfqGetSchema } from './schemas.js';

export class MCPAgentServer {
  private server: Server;
  private handlers: Map<string, (params: any) => Promise<any>> = new Map();

  constructor(agentName: string) {
    this.server = new Server(
      { name: `fiat-crypto-${agentName}`, version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.values(MCP_TOOLS).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: (tool.inputSchema as any).shape,
        },
      })),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = this.handlers.get(name);
      if (!handler) throw new Error(`Unknown tool: ${name}`);

      try {
        const result = await handler(args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  onTool(name: string, handler: (params: any) => Promise<any>): void {
    this.handlers.set(name, handler);
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('[MCP Server] Started');
  }
}

// Example: Fiat Agent MCP Server
export function createFiatAgentMCPServer(): MCPAgentServer {
  const server = new MCPAgentServer('fiat-agent');

  server.onTool('rfq.get', async (params) => {
    const rfq = RfqGetSchema.parse(params);
    console.log(
      `[Fiat Agent] Broadcasting RFQ for ${rfq.intent.amount} ${rfq.intent.fromCurrency}`,
    );
    return { rfqId: `rfq_${Date.now()}`, status: 'broadcast', ttl: rfq.ttl };
  });

  server.onTool('proof.submit', async (params) => {
    console.log(`[Fiat Agent] Submitting proof for order ${params.orderId}`);
    return { status: 'submitted', txHash: '0x...' };
  });

  return server;
}
