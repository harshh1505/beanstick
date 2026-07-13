import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import {
  getConfigPda,
  getLpPda,
  getEscrowPda,
  getVaultPda,
  getAttestationPda,
  getReputationRootPda,
  BEANSTICK_PROGRAM_ID,
} from './pda';

export * from './pda';

export interface PriorityFeeConfig {
  microLamportsPerCu: number;
  computeUnitLimit: number;
}

export class BeanstickSolanaClient {
  constructor(
    public readonly connection: Connection,
    public readonly programId: PublicKey = BEANSTICK_PROGRAM_ID
  ) {}

  /**
   * Helper to wrap instructions in a Solana VersionedTransaction (v0)
   * with Compute Budget Priority Fees and Address Lookup Tables (ALTs).
   */
  public async buildVersionedTransaction(
    payer: PublicKey,
    instructions: TransactionInstruction[],
    priorityFee: PriorityFeeConfig = { microLamportsPerCu: 50_000, computeUnitLimit: 300_000 },
    lookupTables: AddressLookupTableAccount[] = []
  ): Promise<VersionedTransaction> {
    const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');

    const budgetInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: priorityFee.computeUnitLimit,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee.microLamportsPerCu,
      }),
    ];

    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [...budgetInstructions, ...instructions],
    }).compileToV0Message(lookupTables);

    return new VersionedTransaction(messageV0);
  }
}
