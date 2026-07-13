// agents/manager.ts
import { FiatAgent } from './fiat-agent';
import { CryptoAgent } from './crypto-agent';
import { WatcherAgent } from './watcher-agent';
import { AttestationAgent } from './attestation-agent';

export interface AgentPair {
  fiat: FiatAgent;
  crypto: CryptoAgent;
  walletAddress: string;
  createdAt: number;
}

export interface AgentQuad {
  fiat: FiatAgent;
  crypto: CryptoAgent;
  watcher: WatcherAgent;
  attestor: AttestationAgent;
  walletAddress: string;
  createdAt: number;
}

export interface AgentStatus {
  walletAddress: string;
  fiatPubkey: string;
  cryptoPubkey: string;
  watcherPubkey?: string;
  attestorPubkey?: string;
  isRunning: boolean;
  createdAt: number;
}

const WEBHOOK_URL = process.env.WEBHOOK_RECEIVER_URL || 'http://127.0.0.1:4001/webhook/payment';
const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS || '';
const ESCROW_RPC_URL = process.env.ESCROW_RPC_URL || 'https://evmrpc-testnet.0g.ai';

class AgentManager {
  private agents: Map<string, AgentPair> = new Map();
  private quads: Map<string, AgentQuad> = new Map();
  private lpAgents: Map<string, CryptoAgent> = new Map();
  private watcherAgents: Map<string, WatcherAgent> = new Map();
  private attestorAgents: Map<string, AttestationAgent> = new Map();

  async getOrCreate(
    walletAddress: string,
    privateKey: string,
    rpcUrl: string,
    axlPort: number = 9002
  ): Promise<AgentPair> {
    const existing = this.agents.get(walletAddress.toLowerCase());
    if (existing) return existing;

    const fiat = new FiatAgent({
      name: `fiat-${walletAddress.slice(0, 8)}`,
      privateKey,
      rpcUrl,
      axlPort,
      supportedRails: ['banksim', 'upi', 'venmo'],
      demoMode: true,
      webhookUrl: WEBHOOK_URL,
    });

    const crypto = new CryptoAgent({
      name: `crypto-${walletAddress.slice(0, 8)}`,
      privateKey,
      rpcUrl,
      axlPort,
      inventory: [
        { token: 'ETH', balance: '10', minOrder: '0.01' },
        { token: 'USDC', balance: '10000', minOrder: '1' },
      ],
      spreadBps: 50,
      supportedRails: ['banksim', 'upi', 'venmo'],
      fiatDetails: {
        banksim: { account: 'lp@banksim' },
        upi: { vpa: 'lp@upi' },
        venmo: { handle: '@lp-venmo' },
      },
    });

    await fiat.initialize();
    await crypto.initialize();

    fiat.start();
    crypto.start();

    const pair: AgentPair = {
      fiat,
      crypto,
      walletAddress: walletAddress.toLowerCase(),
      createdAt: Date.now(),
    };

    this.agents.set(walletAddress.toLowerCase(), pair);
    this.lpAgents.set(await crypto.getAXLPublicKey(), crypto);

    console.log(`[AgentManager] Created agent pair for ${walletAddress}`);
    return pair;
  }

  get(walletAddress: string): AgentPair | undefined {
    return this.agents.get(walletAddress.toLowerCase());
  }

  /**
   * Create a full 4-agent quad: Fiat, Crypto, Watcher, Attestor.
   * This is the Appendix G architecture for trust-minimized settlement.
   */
  async getOrCreateQuad(
    walletAddress: string,
    privateKey: string,
    rpcUrl: string,
    axlPort: number = 9002
  ): Promise<AgentQuad> {
    const existing = this.quads.get(walletAddress.toLowerCase());
    if (existing) return existing;

    const fiat = new FiatAgent({
      name: `fiat-${walletAddress.slice(0, 8)}`,
      privateKey,
      rpcUrl,
      axlPort,
      supportedRails: ['banksim', 'upi', 'venmo'],
      demoMode: true,
      webhookUrl: WEBHOOK_URL,
    });

    const crypto = new CryptoAgent({
      name: `crypto-${walletAddress.slice(0, 8)}`,
      privateKey,
      rpcUrl,
      axlPort,
      inventory: [
        { token: 'ETH', balance: '10', minOrder: '0.01' },
        { token: 'USDC', balance: '10000', minOrder: '1' },
      ],
      spreadBps: 50,
      supportedRails: ['banksim', 'upi', 'venmo'],
      fiatDetails: {
        banksim: { account: 'lp@banksim' },
        upi: { vpa: 'lp@upi' },
        venmo: { handle: '@lp-venmo' },
      },
    });

    await fiat.initialize();
    await crypto.initialize();

    const attestorPubkey = await crypto.getAXLPublicKey();
    const watcherPubkey = await fiat.getAXLPublicKey();

    const watcher = new WatcherAgent({
      name: `watcher-${walletAddress.slice(0, 8)}`,
      privateKey,
      rpcUrl,
      axlPort,
      escrowAddress: ESCROW_ADDRESS,
      escrowRpcUrl: ESCROW_RPC_URL,
      attestorPubkeys: [attestorPubkey],
    });

    const attestor = new AttestationAgent({
      name: `attestor-${walletAddress.slice(0, 8)}`,
      privateKey,
      rpcUrl,
      axlPort,
      escrowAddress: ESCROW_ADDRESS,
      escrowRpcUrl: ESCROW_RPC_URL,
      watcherPubkeys: [watcherPubkey],
    });

    await watcher.initialize();
    await attestor.initialize();

    fiat.start();
    crypto.start();
    watcher.start();
    attestor.start();

    const quad: AgentQuad = {
      fiat,
      crypto,
      watcher,
      attestor,
      walletAddress: walletAddress.toLowerCase(),
      createdAt: Date.now(),
    };

    this.quads.set(walletAddress.toLowerCase(), quad);
    this.agents.set(walletAddress.toLowerCase(), { fiat, crypto, walletAddress: walletAddress.toLowerCase(), createdAt: quad.createdAt });
    this.lpAgents.set(await crypto.getAXLPublicKey(), crypto);
    this.watcherAgents.set(await watcher.getAXLPublicKey(), watcher);
    this.attestorAgents.set(await attestor.getAXLPublicKey(), attestor);

    console.log(`[AgentManager] Created 4-agent quad for ${walletAddress}`);
    return quad;
  }

  getQuad(walletAddress: string): AgentQuad | undefined {
    return this.quads.get(walletAddress.toLowerCase());
  }

  getWatcher(pubkey: string): WatcherAgent | undefined {
    return this.watcherAgents.get(pubkey);
  }

  getAttestor(pubkey: string): AttestationAgent | undefined {
    return this.attestorAgents.get(pubkey);
  }

  async getStatus(walletAddress: string): Promise<AgentStatus | null> {
    const quad = this.quads.get(walletAddress.toLowerCase());
    if (quad) {
      return {
        walletAddress: quad.walletAddress,
        fiatPubkey: await quad.fiat.getAXLPublicKey(),
        cryptoPubkey: await quad.crypto.getAXLPublicKey(),
        watcherPubkey: await quad.watcher.getAXLPublicKey(),
        attestorPubkey: await quad.attestor.getAXLPublicKey(),
        isRunning: true,
        createdAt: quad.createdAt,
      };
    }

    const pair = this.agents.get(walletAddress.toLowerCase());
    if (!pair) return null;

    return {
      walletAddress: pair.walletAddress,
      fiatPubkey: await pair.fiat.getAXLPublicKey(),
      cryptoPubkey: await pair.crypto.getAXLPublicKey(),
      isRunning: true,
      createdAt: pair.createdAt,
    };
  }

  listLPAgents(): { pubkey: string; address: string }[] {
    const result: { pubkey: string; address: string }[] = [];
    for (const [pubkey, agent] of this.lpAgents) {
      result.push({ pubkey, address: agent.getAddress() });
    }
    return result;
  }

  getLPAgent(pubkey: string): CryptoAgent | undefined {
    return this.lpAgents.get(pubkey);
  }

  async shutdown(walletAddress: string): Promise<boolean> {
    const quad = this.quads.get(walletAddress.toLowerCase());
    if (quad) {
      quad.fiat.stop();
      quad.crypto.stop();
      quad.watcher.stop();
      quad.attestor.stop();

      this.lpAgents.delete(await quad.crypto.getAXLPublicKey());
      this.watcherAgents.delete(await quad.watcher.getAXLPublicKey());
      this.attestorAgents.delete(await quad.attestor.getAXLPublicKey());
      this.quads.delete(walletAddress.toLowerCase());
      this.agents.delete(walletAddress.toLowerCase());

      console.log(`[AgentManager] Shutdown quad for ${walletAddress}`);
      return true;
    }

    const pair = this.agents.get(walletAddress.toLowerCase());
    if (!pair) return false;

    pair.fiat.stop();
    pair.crypto.stop();

    const cryptoPubkey = await pair.crypto.getAXLPublicKey();
    this.lpAgents.delete(cryptoPubkey);
    this.agents.delete(walletAddress.toLowerCase());

    console.log(`[AgentManager] Shutdown agents for ${walletAddress}`);
    return true;
  }

  async shutdownAll(): Promise<void> {
    for (const [wallet] of this.quads) {
      await this.shutdown(wallet);
    }
    for (const [wallet] of this.agents) {
      await this.shutdown(wallet);
    }
  }

  getActiveCount(): number {
    return this.agents.size;
  }

  getQuadCount(): number {
    return this.quads.size;
  }
}

export const agentManager = new AgentManager();
