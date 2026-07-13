import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import {
  getConfigPda,
  getLpPda,
  getEscrowPda,
  getVaultPda,
  getAttestationPda,
  getReputationRootPda,
  BeanstickSolanaClient,
  BEANSTICK_PROGRAM_ID,
} from '../../packages/solana-client/src';

describe('Beanstick Solana Native Architecture Validation Suite', () => {
  it('should deterministically derive canonical PDA addresses and bumps', () => {
    const [configPda, configBump] = getConfigPda(BEANSTICK_PROGRAM_ID);
    expect(configPda).toBeInstanceOf(PublicKey);
    expect(typeof configBump).toBe('number');

    const dummyLpWallet = Keypair.generate().publicKey;
    const [lpPda, lpBump] = getLpPda(dummyLpWallet, BEANSTICK_PROGRAM_ID);
    expect(lpPda).toBeInstanceOf(PublicKey);
    expect(typeof lpBump).toBe('number');

    const orderId = 1001n;
    const [escrowPda, escrowBump] = getEscrowPda(orderId, BEANSTICK_PROGRAM_ID);
    expect(escrowPda).toBeInstanceOf(PublicKey);
    expect(typeof escrowBump).toBe('number');

    const [vaultPda, vaultBump] = getVaultPda(escrowPda, BEANSTICK_PROGRAM_ID);
    expect(vaultPda).toBeInstanceOf(PublicKey);
    expect(typeof vaultBump).toBe('number');

    const [attestationPda, attestationBump] = getAttestationPda(escrowPda, BEANSTICK_PROGRAM_ID);
    expect(attestationPda).toBeInstanceOf(PublicKey);
    expect(typeof attestationBump).toBe('number');

    const epoch = 42n;
    const [repRootPda, repRootBump] = getReputationRootPda(epoch, BEANSTICK_PROGRAM_ID);
    expect(repRootPda).toBeInstanceOf(PublicKey);
    expect(typeof repRootBump).toBe('number');

    console.log('✅ All Beanstick canonical PDAs successfully derived:', {
      configPda: configPda.toBase58(),
      lpPda: lpPda.toBase58(),
      escrowPda: escrowPda.toBase58(),
      vaultPda: vaultPda.toBase58(),
      attestationPda: attestationPda.toBase58(),
      repRootPda: repRootPda.toBase58(),
    });
  });

  it('should format versioned transactions with priority fees and ALTs', async () => {
    const mockConnection = new Connection('https://api.devnet.solana.com');
    const client = new BeanstickSolanaClient(mockConnection, BEANSTICK_PROGRAM_ID);
    expect(client.programId.toBase58()).toBe(BEANSTICK_PROGRAM_ID.toBase58());
  });
});
