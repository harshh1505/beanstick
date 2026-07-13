// contracts/src/inft-client.ts
import { ethers } from 'ethers';

const INFT_ABI = [
  'function mintAgentPair(address to, address walletAddress, string fiatAxlPubkey, string cryptoAxlPubkey, bytes32 initialStateHash) external returns (uint256, uint256)',
  'function updateAgentState(uint256 tokenId, bytes32 newStateHash) external',
  'function authorizeUsage(uint256 tokenId, address user) external',
  'function revokeAuthorization(uint256 tokenId, address user) external',
  'function getAgentsByWallet(address wallet) external view returns (uint256[])',
  'function getAgentMetadata(uint256 tokenId) external view returns (tuple(string agentType, address walletAddress, string axlPubkey, bytes32 stateHash, uint256 createdAt, bool isActive))',
  'function intelligentDataOf(uint256 tokenId) external view returns (tuple(string dataDescription, bytes32 dataHash)[])',
  'function authorizedUsersOf(uint256 tokenId) external view returns (address[])',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function deactivateAgent(uint256 tokenId) external',
  'event AgentMinted(uint256 indexed tokenId, address indexed owner, string agentType, string axlPubkey)',
  'event AgentStateUpdated(uint256 indexed tokenId, bytes32 newStateHash)',
];

export interface AgentMetadata {
  agentType: string;
  walletAddress: string;
  axlPubkey: string;
  stateHash: string;
  createdAt: string;
  isActive: boolean;
}

export interface IntelligentData {
  dataDescription: string;
  dataHash: string;
}

export interface MintResult {
  fiatTokenId: bigint;
  cryptoTokenId: bigint;
  txHash: string;
}

export class INFTClient {
  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor(contractAddress: string, privateKey: string, rpcUrl: string) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, provider);
    this.contract = new ethers.Contract(contractAddress, INFT_ABI, this.signer);
  }

  async mintAgentPair(
    to: string,
    walletAddress: string,
    fiatAxlPubkey: string,
    cryptoAxlPubkey: string,
    initialStateHash?: string
  ): Promise<MintResult> {
    // Validate addresses
    if (!ethers.isAddress(to)) {
      throw new Error(`Invalid 'to' address: ${to}`);
    }
    if (!ethers.isAddress(walletAddress)) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    const stateHash = initialStateHash || ethers.keccak256(
      ethers.toUtf8Bytes(`${walletAddress}-${Date.now()}`)
    );

    const tx = await this.contract.mintAgentPair(
      to,
      walletAddress,
      fiatAxlPubkey,
      cryptoAxlPubkey,
      stateHash
    );
    const receipt = await tx.wait();

    const mintEvents = receipt.logs
      .map((log: any) => {
        try {
          return this.contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((e: any) => e?.name === 'AgentMinted');

    const fiatTokenId = mintEvents.find((e: any) => e.args[2] === 'fiat')?.args[0] || 0n;
    const cryptoTokenId = mintEvents.find((e: any) => e.args[2] === 'crypto')?.args[0] || 0n;

    return {
      fiatTokenId,
      cryptoTokenId,
      txHash: receipt.hash,
    };
  }

  async updateAgentState(tokenId: bigint, newStateHash: string): Promise<string> {
    const tx = await this.contract.updateAgentState(tokenId, newStateHash);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getAgentsByWallet(walletAddress: string): Promise<bigint[]> {
    return this.contract.getAgentsByWallet(walletAddress);
  }

  async getAgentMetadata(tokenId: bigint): Promise<AgentMetadata> {
    const meta = await this.contract.getAgentMetadata(tokenId);
    return {
      agentType: meta[0],
      walletAddress: meta[1],
      axlPubkey: meta[2],
      stateHash: meta[3],
      createdAt: meta[4].toString(),
      isActive: meta[5],
    };
  }

  async getIntelligentData(tokenId: bigint): Promise<IntelligentData[]> {
    const data = await this.contract.intelligentDataOf(tokenId);
    return data.map((d: any) => ({
      dataDescription: d[0],
      dataHash: d[1],
    }));
  }

  async getTokenURI(tokenId: bigint): Promise<string> {
    return this.contract.tokenURI(tokenId);
  }

  async authorizeUsage(tokenId: bigint, user: string): Promise<string> {
    const tx = await this.contract.authorizeUsage(tokenId, user);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async revokeAuthorization(tokenId: bigint, user: string): Promise<string> {
    const tx = await this.contract.revokeAuthorization(tokenId, user);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async deactivateAgent(tokenId: bigint): Promise<string> {
    const tx = await this.contract.deactivateAgent(tokenId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  getContractAddress(): string {
    return this.contract.target as string;
  }
}
