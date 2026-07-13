// agents/runtime/index.ts
import { AXLBridge, AXLMessageHandler } from '../../protocol/axl/bridge';
import { MCPAgentClient } from '../../protocol/mcp/client';
import { X402Client } from '../../protocol/x402/client';
import { ZeroGStorage } from '../../zerog/storage/client';
import { ZeroGCompute } from '../../zerog/compute/client';
import { ethers } from 'ethers';
import * as crypto from 'crypto';

export interface AgentConfig {
  name: string;
  role: 'buyer' | 'lp' | 'keeper';
  privateKey: string;
  rpcUrl: string;
  axlPort?: number;
  version?: string;
  sourceHash?: string;
}

export interface AgentAttestation {
  codeHash: string;
  chatId: string;
  verified: boolean;
  attestedAt: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected axl: AXLBridge;
  protected mcpClient: MCPAgentClient;
  protected x402: X402Client;
  protected storage: ZeroGStorage;
  protected compute: ZeroGCompute;
  protected signer: ethers.Wallet;
  protected messageHandler: AXLMessageHandler;
  protected decisionLog: { ts: number; action: string; data: any }[] = [];
  private memoryHash: string | null = null;
  private attestation: AgentAttestation | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.axl = new AXLBridge(`http://127.0.0.1:${config.axlPort || 9002}`);
    this.x402 = new X402Client({ privateKey: config.privateKey });
    this.mcpClient = new MCPAgentClient(this.axl, this.x402);
    this.storage = new ZeroGStorage(config.privateKey);
    this.compute = new ZeroGCompute();

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, provider);

    this.messageHandler = new AXLMessageHandler(this.axl);
  }

  async initialize(): Promise<void> {
    console.log(`[${this.config.name}] Initializing...`);

    const topology = await this.axl.getTopology();
    console.log(`[${this.config.name}] AXL Public Key: ${topology.our_public_key}`);

    await this.loadState();
    this.setupMessageHandlers();

    // Get agent attestation from 0G Compute
    await this.attestSelf();

    console.log(`[${this.config.name}] Initialized`);
  }

  private async attestSelf(): Promise<void> {
    const codeHash = this.config.sourceHash || this.computeSourceHash();
    const version = this.config.version || '1.0.0';

    try {
      await this.compute.initialize(this.config.privateKey);
      const result = await this.compute.attestAgent(codeHash, this.config.name, version);

      this.attestation = {
        codeHash,
        chatId: result.chatId,
        verified: result.verified,
        attestedAt: Date.now(),
      };

      this.logDecision('agent.attested', {
        codeHash,
        chatId: result.chatId,
        verified: result.verified,
      });

      console.log(`[${this.config.name}] Attested via 0G Compute: ${result.verified ? '✓' : '○'}`);
    } catch (err) {
      console.warn(`[${this.config.name}] Attestation failed (non-blocking):`, (err as Error).message);
      this.attestation = { codeHash, chatId: '', verified: false, attestedAt: Date.now() };
    }
  }

  private computeSourceHash(): string {
    // Hash the agent's class name + role as a simple fingerprint
    // In production, hash actual source file content
    const fingerprint = `${this.constructor.name}:${this.config.role}:${this.config.name}`;
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  }

  getAttestation(): AgentAttestation | null {
    return this.attestation;
  }

  protected abstract setupMessageHandlers(): void;
  protected abstract getStateSnapshot(): object;
  protected abstract restoreState(state: object): void;

  protected logDecision(action: string, data: any): void {
    this.decisionLog.push({ ts: Date.now(), action, data });
    if (this.decisionLog.length > 100) this.decisionLog.shift();
  }

  async saveState(): Promise<string | null> {
    try {
      const snapshot = {
        ...this.getStateSnapshot(),
        decisions: this.decisionLog.slice(-20),
      };
      this.memoryHash = await this.storage.uploadMemory(this.config.name, snapshot);
      console.log(`[${this.config.name}] State saved to 0G: ${this.memoryHash.slice(0, 16)}...`);
      return this.memoryHash;
    } catch (err) {
      console.error(`[${this.config.name}] Failed to save state:`, err);
      return null;
    }
  }

  protected async loadState(): Promise<void> {
    const hash = this.storage.getLatestMemoryHash(this.config.name);
    if (!hash) {
      console.log(`[${this.config.name}] No previous state found`);
      return;
    }

    try {
      const state = await this.storage.downloadMemory(hash);
      if (state) {
        this.restoreState(state);
        console.log(`[${this.config.name}] State restored from 0G: ${hash.slice(0, 16)}...`);
      }
    } catch (err) {
      console.error(`[${this.config.name}] Failed to load state:`, err);
    }
  }

  getMemoryHash(): string | null {
    return this.memoryHash;
  }

  getName(): string {
    return this.config.name;
  }

  getDecisionLog(): { ts: number; action: string; data: any }[] {
    return [...this.decisionLog];
  }

  /**
   * Call a remote agent's MCP tool with automatic x402 payment handling.
   */
  async callAgentTool(
    peerPubkey: string,
    serviceName: string,
    toolName: string,
    params: object,
  ): Promise<any> {
    return this.mcpClient.callTool(peerPubkey, serviceName, toolName, params);
  }

  async start(): Promise<void> {
    console.log(`[${this.config.name}] Starting...`);
    await this.messageHandler.start();
  }

  stop(): void {
    console.log(`[${this.config.name}] Stopping...`);
    this.messageHandler.stop();
  }

  getAddress(): string {
    return this.signer.address;
  }

  async getAXLPublicKey(): Promise<string> {
    return this.axl.getPublicKey();
  }
}
