// keepers/jobs/pushExpire.ts
//
// Background keeper that polls the Escrow contract for LOCKED orders whose
// deadline is approaching, and submits expire(orderId) before the deadline
// passes. Run by KeeperHub (or any host) with a wallet that holds gas on the
// target chain. Runs forever until stop() is called.
//
// The escrow ABI (see contracts/src/Escrow.sol — Section 8) is intentionally
// minimal: only the functions this job needs.

import { ethers } from 'ethers';

export interface KeeperJobConfig {
  escrowAddress: string;
  rpcUrl: string;
  privateKey: string;
  /** Poll interval in milliseconds. */
  checkIntervalMs: number;
  /**
   * If a locked order is within this many seconds of its deadline (and still
   * before it), push expire(). Tuning trade-off: too small = misses; too
   * large = wastes gas on orders that may still be paid.
   */
  deadlineBufferSeconds: number;
}

const ESCROW_ABI = [
  'function getLockedOrders() view returns (uint256[])',
  'function getOrderDeadline(uint256 orderId) view returns (uint256)',
  'function expire(uint256 orderId) external',
] as const;

export class PushExpireJob {
  private readonly config: KeeperJobConfig;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly signer: ethers.Wallet;
  private readonly escrow: ethers.Contract;
  private running = false;

  constructor(config: KeeperJobConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    this.escrow = new ethers.Contract(config.escrowAddress, ESCROW_ABI, this.signer);
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(
      `[Keeper:pushExpire] started → escrow=${this.config.escrowAddress} buffer=${this.config.deadlineBufferSeconds}s`,
    );

    while (this.running) {
      try {
        await this.tick();
      } catch (err) {
        console.error('[Keeper:pushExpire] tick error:', err);
      }
      await new Promise((r) => setTimeout(r, this.config.checkIntervalMs));
    }
  }

  /** Single poll iteration — exposed for test harnesses. */
  async tick(): Promise<void> {
    const lockedOrders: bigint[] = await this.escrow.getLockedOrders();
    if (lockedOrders.length === 0) return;

    const now = Math.floor(Date.now() / 1000);

    for (const orderId of lockedOrders) {
      const deadline: bigint = await this.escrow.getOrderDeadline(orderId);
      const timeLeft = Number(deadline) - now;

      if (timeLeft <= this.config.deadlineBufferSeconds && timeLeft > 0) {
        console.log(
          `[Keeper:pushExpire] order=${orderId} expires in ${timeLeft}s → pushing expire()`,
        );
        try {
          const tx = await this.escrow.expire(orderId);
          const receipt = await tx.wait();
          console.log(
            `[Keeper:pushExpire] order=${orderId} expired tx=${receipt?.hash}`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Keeper:pushExpire] order=${orderId} expire failed: ${msg}`);
        }
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}
