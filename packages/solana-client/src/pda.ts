import { PublicKey } from '@solana/web3.js';

export const BEANSTICK_PROGRAM_ID = new PublicKey(
  'Bean111111111111111111111111111111111111111'
);

export function getConfigPda(programId: PublicKey = BEANSTICK_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    programId
  );
}

export function getLpPda(
  lpAuthority: PublicKey,
  programId: PublicKey = BEANSTICK_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('lp'), lpAuthority.toBuffer()],
    programId
  );
}

export function getEscrowPda(
  orderId: bigint | number,
  programId: PublicKey = BEANSTICK_PROGRAM_ID
): [PublicKey, number] {
  const orderIdBuf = Buffer.alloc(8);
  orderIdBuf.writeBigUInt64LE(BigInt(orderId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), orderIdBuf],
    programId
  );
}

export function getVaultPda(
  escrowPda: PublicKey,
  programId: PublicKey = BEANSTICK_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), escrowPda.toBuffer()],
    programId
  );
}

export function getAttestationPda(
  escrowPda: PublicKey,
  programId: PublicKey = BEANSTICK_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('attestation'), escrowPda.toBuffer()],
    programId
  );
}

export function getReputationRootPda(
  epoch: bigint | number,
  programId: PublicKey = BEANSTICK_PROGRAM_ID
): [PublicKey, number] {
  const epochBuf = Buffer.alloc(8);
  epochBuf.writeBigUInt64LE(BigInt(epoch));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reputation_root'), epochBuf],
    programId
  );
}
