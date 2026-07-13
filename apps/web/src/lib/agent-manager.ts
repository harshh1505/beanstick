// Web app client for the agent server
// Communicates with services/agent-server running on :4002

const AGENT_SERVER_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'http://127.0.0.1:4002';

interface AgentPair {
  fiatPubkey: string;
  cryptoPubkey: string;
  walletAddress: string;
}

interface Quote {
  quoteId: string;
  rfqId: string;
  lpAgent: string;
  rate: string;
  outputAmount: string;
  fee: string;
  rails: string[];
  reputation: number;
  expiry: number;
}

class WebAgentClient {
  private cache: Map<string, AgentPair> = new Map();

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${AGENT_SERVER_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getOrCreate(walletAddress: string): Promise<AgentPair> {
    const cached = this.cache.get(walletAddress.toLowerCase());
    if (cached) return cached;

    const res = await fetch(`${AGENT_SERVER_URL}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create agents');
    }

    const data = await res.json();
    const pair: AgentPair = {
      fiatPubkey: data.fiatPubkey,
      cryptoPubkey: data.cryptoPubkey,
      walletAddress: walletAddress.toLowerCase(),
    };

    this.cache.set(walletAddress.toLowerCase(), pair);
    return pair;
  }

  get(walletAddress: string): AgentPair | undefined {
    return this.cache.get(walletAddress.toLowerCase());
  }

  async broadcastRfq(walletAddress: string, intent: any): Promise<string> {
    const res = await fetch(`${AGENT_SERVER_URL}/rfq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, intent }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'RFQ broadcast failed');
    }

    const data = await res.json();
    return data.rfqId;
  }

  async getQuotes(walletAddress: string, rfqId: string): Promise<Quote[]> {
    const res = await fetch(
      `${AGENT_SERVER_URL}/quotes/${rfqId}?wallet=${walletAddress}`
    );

    if (!res.ok) return [];

    const data = await res.json();
    return data.quotes || [];
  }

  async commitToQuote(
    walletAddress: string,
    rfqId: string,
    quoteIndex: number
  ): Promise<Quote | null> {
    const res = await fetch(`${AGENT_SERVER_URL}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, rfqId, quoteIndex }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Commit failed');
    }

    const data = await res.json();
    return data.quote;
  }

  async verifyDecision(context: any): Promise<{ verified: boolean; chatId: string }> {
    const res = await fetch(`${AGENT_SERVER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    });

    if (!res.ok) {
      return { verified: false, chatId: 'request-failed' };
    }

    return res.json();
  }

  async getDecisions(walletAddress: string): Promise<{
    fiat: { agentName: string; attestation: any; decisions: any[]; memoryHash: string | null };
    crypto: { agentName: string; attestation: any; decisions: any[]; memoryHash: string | null };
  } | null> {
    try {
      const res = await fetch(`${AGENT_SERVER_URL}/decisions/${walletAddress}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  getActiveCount(): number {
    return this.cache.size;
  }

  listLPAgents(): { pubkey: string; address: string }[] {
    const result: { pubkey: string; address: string }[] = [];
    this.cache.forEach((pair) => {
      result.push({ pubkey: pair.cryptoPubkey, address: pair.walletAddress });
    });
    return result;
  }
}

export const agentManager = new WebAgentClient();
