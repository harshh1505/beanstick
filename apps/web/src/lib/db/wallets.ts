// apps/web/src/lib/db/wallets.ts
// JSON file-based storage for derived wallets

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.BEANSTICK_DATA_DIR || '/tmp/beanstick';
const WALLETS_FILE = path.join(DATA_DIR, 'wallets.json');

export interface StoredWallet {
  id: string;
  address: string;
  label: string;
  parentAddress: string;
  createdAt: number;
  hasAgents: boolean;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err);
  }
  return defaultValue;
}

function writeJson<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getAllWallets(): Record<string, StoredWallet> {
  return readJson<Record<string, StoredWallet>>(WALLETS_FILE, {});
}

export function getWalletsForParent(parentAddress: string): StoredWallet[] {
  const wallets = getAllWallets();
  return Object.values(wallets).filter(
    w => w.parentAddress.toLowerCase() === parentAddress.toLowerCase()
  );
}

export function getWallet(id: string): StoredWallet | null {
  const wallets = getAllWallets();
  return wallets[id] || null;
}

export function saveWallet(wallet: StoredWallet): void {
  const wallets = getAllWallets();
  wallets[wallet.id] = wallet;
  writeJson(WALLETS_FILE, wallets);
}

export function createWallet(
  address: string,
  label: string,
  parentAddress: string
): StoredWallet {
  const wallet: StoredWallet = {
    id: `wallet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    address: address.toLowerCase(),
    label,
    parentAddress: parentAddress.toLowerCase(),
    createdAt: Date.now(),
    hasAgents: false,
  };
  saveWallet(wallet);
  return wallet;
}

export function updateWalletAgentStatus(id: string, hasAgents: boolean): boolean {
  const wallet = getWallet(id);
  if (!wallet) return false;
  wallet.hasAgents = hasAgents;
  saveWallet(wallet);
  return true;
}

export function updateWalletLabel(id: string, label: string): boolean {
  const wallet = getWallet(id);
  if (!wallet) return false;
  wallet.label = label;
  saveWallet(wallet);
  return true;
}

export function deleteWallet(id: string): boolean {
  const wallets = getAllWallets();
  if (!wallets[id]) return false;
  delete wallets[id];
  writeJson(WALLETS_FILE, wallets);
  return true;
}
