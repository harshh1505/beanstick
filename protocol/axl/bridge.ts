// protocol/axl/bridge.ts
// HTTP bridge client for a local Gensyn AXL node (see services/axl-node).

const AXL_BASE_URL = process.env.AXL_BRIDGE_URL || 'http://127.0.0.1:9002';

export interface AXLTopology {
  our_public_key: string;
  our_ipv6: string;
  peers: string[];
}

export interface AXLMessage {
  from: string;
  data: any;
  timestamp: number;
}

export class AXLBridge {
  private baseUrl: string;
  private publicKey: string | null = null;

  constructor(baseUrl: string = AXL_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getTopology(): Promise<AXLTopology> {
    const response = await fetch(`${this.baseUrl}/topology`);
    if (!response.ok) {
      throw new Error(`Topology request failed: ${response.status}`);
    }
    const topology = (await response.json()) as AXLTopology;
    this.publicKey = topology.our_public_key;
    return topology;
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) await this.getTopology();
    return this.publicKey!;
  }

  async send(peerId: string, message: unknown): Promise<void> {
    const response = await fetch(`${this.baseUrl}/send`, {
      method: 'POST',
      headers: {
        'X-Destination-Peer-Id': peerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error(`Send failed: ${response.status}`);
  }

  async recv(): Promise<AXLMessage | null> {
    const response = await fetch(`${this.baseUrl}/recv`);
    if (response.status === 204) return null;
    if (!response.ok) throw new Error(`Recv failed: ${response.status}`);

    const fromPeerId = response.headers.get('X-From-Peer-Id');
    const data = await response.json();
    return { from: fromPeerId || 'unknown', data, timestamp: Date.now() };
  }

  async mcpCall(
    peerId: string,
    serviceName: string,
    method: string,
    params: object = {},
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/mcp/${peerId}/${serviceName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, id: Date.now(), params }),
      },
    );
    if (!response.ok) throw new Error(`MCP call failed: ${response.status}`);
    return response.json();
  }

  async getAgentCard(peerId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/a2a/${peerId}`);
    if (!response.ok) throw new Error(`A2A card request failed: ${response.status}`);
    return response.json();
  }

  async a2aSend(peerId: string, message: object): Promise<any> {
    const response = await fetch(`${this.baseUrl}/a2a/${peerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'message/send',
        id: Date.now(),
        params: { message },
      }),
    });
    if (!response.ok) throw new Error(`A2A send failed: ${response.status}`);
    return response.json();
  }
}

export class AXLMessageHandler {
  private bridge: AXLBridge;
  private handlers: Map<string, (msg: AXLMessage) => Promise<void>> = new Map();
  private running = false;

  constructor(bridge: AXLBridge) {
    this.bridge = bridge;
  }

  on(type: string, handler: (msg: AXLMessage) => Promise<void>): void {
    this.handlers.set(type, handler);
  }

  async start(pollIntervalMs: number = 200): Promise<void> {
    this.running = true;
    console.log('[AXL] Message handler started');

    while (this.running) {
      try {
        const msg = await this.bridge.recv();
        if (msg) {
          const type = msg.data?.type || 'unknown';
          const handler = this.handlers.get(type);
          if (handler) await handler(msg);
          else console.log(`[AXL] Unhandled message type: ${type}`);
        }
      } catch (err) {
        console.error('[AXL] Recv error:', err);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  stop(): void {
    this.running = false;
  }
}

export async function verifyAXLSetup(): Promise<boolean> {
  console.log('[AXL] Verifying setup...');
  const bridge = new AXLBridge();
  try {
    const topology = await bridge.getTopology();
    console.log(`[AXL] Our public key: ${topology.our_public_key}`);
    console.log(`[AXL] Our IPv6: ${topology.our_ipv6}`);
    console.log(`[AXL] Connected peers: ${topology.peers?.length || 0}`);
    return true;
  } catch (err) {
    console.error('[AXL] Setup verification failed:', err);
    return false;
  }
}
