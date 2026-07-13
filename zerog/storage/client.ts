import { Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';

const ZEROG_RPC = process.env.ZEROG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai';
const INDEXER_RPC = process.env.ZEROG_INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai';

const memoryIndex: Map<string, { rootHash: string; timestamp: number }[]> = new Map();

export class ZeroGStorage {
  private indexer: Indexer;
  private signer: ethers.Wallet;
  private uploadQueue: Promise<any> = Promise.resolve();
  private lastNonce: number = -1;

  constructor(privateKey: string) {
    const provider = new ethers.JsonRpcProvider(ZEROG_RPC);
    this.signer = new ethers.Wallet(privateKey, provider);
    this.indexer = new Indexer(INDEXER_RPC);
  }

  async uploadProof(proofData: Uint8Array): Promise<string> {
    return this.queueUpload(async () => {
      const memData = new MemData(proofData);
      const [tree, treeErr] = await memData.merkleTree();
      if (treeErr !== null) {
        throw new Error(`Merkle tree error: ${treeErr}`);
      }

      const rootHash = tree?.rootHash();
      console.log(`[0G Storage] Uploading proof, root: ${rootHash}`);

      // Get fresh nonce to avoid collisions
      const pendingNonce = await this.signer.getNonce('pending');
      const useNonce = Math.max(pendingNonce, this.lastNonce + 1);
      this.lastNonce = useNonce;

      const [tx, uploadErr] = await this.indexer.upload(memData, ZEROG_RPC, this.signer, {
        nonce: BigInt(useNonce),
      });
      if (uploadErr !== null) {
        throw new Error(`Upload error: ${uploadErr}`);
      }

      console.log(`[0G Storage] Upload complete, tx: ${JSON.stringify(tx)}`);
      return rootHash!;
    });
  }

  private async queueUpload<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.uploadQueue.then(fn, fn);
    this.uploadQueue = result.catch(() => {});
    return result;
  }

  async downloadProof(rootHash: string, outputPath: string): Promise<void> {
    const err = await this.indexer.download(rootHash, outputPath, true);
    if (err !== null) {
      throw new Error(`Download error: ${err}`);
    }
  }

  async uploadMemory(agentId: string, memoryState: object): Promise<string> {
    const timestamp = Date.now();
    const data = new TextEncoder().encode(JSON.stringify({
      agentId,
      timestamp,
      state: memoryState,
    }));
    const rootHash = await this.uploadProof(data);

    const entries = memoryIndex.get(agentId) || [];
    entries.push({ rootHash, timestamp });
    if (entries.length > 10) entries.shift();
    memoryIndex.set(agentId, entries);

    console.log(`[0G Storage] Agent memory saved: ${agentId} → ${rootHash.slice(0, 16)}...`);
    return rootHash;
  }

  getLatestMemoryHash(agentId: string): string | null {
    const entries = memoryIndex.get(agentId);
    if (!entries || entries.length === 0) return null;
    return entries[entries.length - 1].rootHash;
  }

  async downloadMemory(rootHash: string): Promise<object | null> {
    try {
      const tmpPath = `/tmp/beanstick-memory-${Date.now()}.json`;
      await this.downloadProof(rootHash, tmpPath);
      const fs = await import('fs/promises');
      const content = await fs.readFile(tmpPath, 'utf-8');
      await fs.unlink(tmpPath);
      const parsed = JSON.parse(content);
      return parsed.state;
    } catch (err) {
      console.error(`[0G Storage] Failed to download memory: ${err}`);
      return null;
    }
  }
}

export async function verifyStorageSetup(): Promise<boolean> {
  console.log('[0G Storage] Verifying setup...');

  const provider = new ethers.JsonRpcProvider(ZEROG_RPC);
  const blockNumber = await provider.getBlockNumber();
  console.log(`[0G Storage] Connected to 0G testnet, block: ${blockNumber}`);

  new Indexer(INDEXER_RPC);
  console.log('[0G Storage] Indexer connected');

  return true;
}
