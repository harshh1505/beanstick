import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const ZEROG_RPC = process.env.ZEROG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai';

export class ZeroGCompute {
  private broker: any;
  private initialized = false;

  async initialize(privateKey: string): Promise<void> {
    const provider = new ethers.JsonRpcProvider(ZEROG_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    this.broker = await createZGComputeNetworkBroker(wallet);
    this.initialized = true;
    console.log('[0G Compute] Broker initialized');
  }

  async listServices(): Promise<any[]> {
    if (!this.initialized) throw new Error('Broker not initialized');
    return this.broker.inference.listService();
  }

  async verifyProof(
    providerAddress: string,
    proofPayload: object,
  ): Promise<{ valid: boolean; chatId: string }> {
    if (!this.initialized) throw new Error('Broker not initialized');

    const { endpoint, model } = await this.broker.inference.getServiceMetadata(providerAddress);
    const headers = await this.broker.inference.getRequestHeaders(providerAddress);

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a zkTLS proof verifier. Validate the proof structure and return JSON: {"valid": true/false, "reason": "..."}',
          },
          { role: 'user', content: JSON.stringify(proofPayload) },
        ],
      }),
    });

    const data: any = await response.json();
    const chatId = response.headers.get('ZG-Res-Key') || data.id;

    if (chatId) {
      await this.broker.inference.processResponse(providerAddress, chatId);
    }

    const result = JSON.parse(data.choices[0].message.content);
    return { valid: result.valid, chatId };
  }

  async attestAgent(
    codeHash: string,
    agentName: string,
    version: string
  ): Promise<{ attestation: object; chatId: string; verified: boolean }> {
    if (!this.initialized) throw new Error('Broker not initialized');

    const services = await this.listServices();
    const chatbot = services.find((s: any) => s.serviceType === 'chatbot');
    if (!chatbot) throw new Error('No chatbot service available');

    const { endpoint, model } = await this.broker.inference.getServiceMetadata(chatbot.provider);
    const headers = await this.broker.inference.getRequestHeaders(chatbot.provider);

    const attestPayload = {
      type: 'agent_attestation',
      agentName,
      version,
      codeHash,
      timestamp: Date.now(),
    };

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an agent attestation service. Verify the agent code hash and return attestation. Return JSON: {"attested": true, "agentName": "...", "codeHash": "...", "attestedAt": <unix_ms>}`,
          },
          { role: 'user', content: JSON.stringify(attestPayload) },
        ],
      }),
    });

    const data: any = await response.json();
    const chatId = response.headers.get('ZG-Res-Key') || data.id || `attest-${Date.now()}`;

    let verified = false;
    if (chatId && !chatId.startsWith('attest-')) {
      try {
        await this.broker.inference.processResponse(chatbot.provider, chatId);
        verified = true;
      } catch {
        verified = false;
      }
    }

    let attestation;
    try {
      attestation = JSON.parse(data.choices[0].message.content);
    } catch {
      attestation = { raw: data.choices[0].message.content, attested: false };
    }

    console.log(`[0G Compute] Agent attested: ${agentName}, chatId: ${chatId}, verified: ${verified}`);
    return { attestation, chatId, verified };
  }

  async makeVerifiableDecision(
    prompt: string,
    context: object
  ): Promise<{ decision: any; chatId: string; verified: boolean }> {
    if (!this.initialized) throw new Error('Broker not initialized');

    const services = await this.listServices();
    const chatbot = services.find((s: any) => s.serviceType === 'chatbot');
    if (!chatbot) throw new Error('No chatbot service available');

    const { endpoint, model } = await this.broker.inference.getServiceMetadata(chatbot.provider);
    const headers = await this.broker.inference.getRequestHeaders(chatbot.provider);

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an AI agent making financial decisions. Return only valid JSON. ${prompt}`,
          },
          { role: 'user', content: JSON.stringify(context) },
        ],
      }),
    });

    const data: any = await response.json();
    const chatId = response.headers.get('ZG-Res-Key') || data.id || `decision-${Date.now()}`;

    let verified = false;
    if (chatId && chatId !== `decision-${Date.now()}`) {
      try {
        await this.broker.inference.processResponse(chatbot.provider, chatId);
        verified = true;
      } catch {
        verified = false;
      }
    }

    let decision;
    try {
      decision = JSON.parse(data.choices[0].message.content);
    } catch {
      decision = { raw: data.choices[0].message.content };
    }

    console.log(`[0G Compute] Decision made, chatId: ${chatId}, verified: ${verified}`);
    return { decision, chatId, verified };
  }
}

export async function verifyComputeSetup(privateKey: string): Promise<boolean> {
  console.log('[0G Compute] Verifying setup...');

  const compute = new ZeroGCompute();
  await compute.initialize(privateKey);

  const services = await compute.listServices();
  console.log(`[0G Compute] Found ${services.length} inference services`);

  const chatbots = services.filter((s: any) => s.serviceType === 'chatbot');
  console.log(`[0G Compute] Chatbot services: ${chatbots.map((s: any) => s.model).join(', ')}`);

  return services.length > 0;
}
