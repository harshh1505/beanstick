'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { Wallet } from 'ethers';

export interface INFTInfo {
  fiatTokenId: string;
  cryptoTokenId: string;
  txHash: string;
}

export interface DerivedWallet {
  id: string;
  address: string;
  privateKey: string;
  label: string;
  createdAt: number;
  parentAddress: string;
  hasAgents: boolean;
  inft?: INFTInfo;
}

interface WalletContextValue {
  wallets: DerivedWallet[];
  activeWallet: DerivedWallet | null;
  isLoading: boolean;
  createWallet: (label: string) => Promise<DerivedWallet>;
  selectWallet: (id: string) => void;
  deleteWallet: (id: string) => Promise<void>;
  updateLabel: (id: string, label: string) => void;
  updateINFT: (id: string, inft: INFTInfo) => void;
  refreshWallets: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = 'beanstick_wallets';
const ACTIVE_KEY = 'beanstick_active_wallet';

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address: parentAddress, isConnected } = useAccount();
  const [wallets, setWallets] = useState<DerivedWallet[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWallets = useCallback(() => {
    if (!parentAddress) {
      setWallets([]);
      setActiveWalletId(null);
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${parentAddress.toLowerCase()}`);
      if (stored) {
        const parsed = JSON.parse(stored) as DerivedWallet[];
        setWallets(parsed);

        const savedActive = localStorage.getItem(`${ACTIVE_KEY}_${parentAddress.toLowerCase()}`);
        if (savedActive && parsed.find(w => w.id === savedActive)) {
          setActiveWalletId(savedActive);
        } else if (parsed.length > 0) {
          setActiveWalletId(parsed[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load wallets:', err);
    }
    setIsLoading(false);
  }, [parentAddress]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const saveWallets = useCallback((newWallets: DerivedWallet[]) => {
    if (!parentAddress) return;
    localStorage.setItem(
      `${STORAGE_KEY}_${parentAddress.toLowerCase()}`,
      JSON.stringify(newWallets)
    );
  }, [parentAddress]);

  const createWallet = useCallback(async (label: string): Promise<DerivedWallet> => {
    if (!parentAddress) throw new Error('No parent wallet connected');

    const ethersWallet = Wallet.createRandom();
    const newWallet: DerivedWallet = {
      id: `wallet_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      address: ethersWallet.address,
      privateKey: ethersWallet.privateKey,
      label: label || `Wallet ${wallets.length + 1}`,
      createdAt: Date.now(),
      parentAddress: parentAddress.toLowerCase(),
      hasAgents: false,
    };

    const updated = [...wallets, newWallet];
    setWallets(updated);
    saveWallets(updated);

    await fetch('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: newWallet.address,
        label: newWallet.label,
        parentAddress: parentAddress,
      }),
    });

    if (!activeWalletId) {
      setActiveWalletId(newWallet.id);
      localStorage.setItem(`${ACTIVE_KEY}_${parentAddress.toLowerCase()}`, newWallet.id);
    }

    return newWallet;
  }, [parentAddress, wallets, saveWallets, activeWalletId]);

  const selectWallet = useCallback((id: string) => {
    if (!parentAddress) return;
    setActiveWalletId(id);
    localStorage.setItem(`${ACTIVE_KEY}_${parentAddress.toLowerCase()}`, id);
  }, [parentAddress]);

  const deleteWallet = useCallback(async (id: string) => {
    const wallet = wallets.find(w => w.id === id);
    if (!wallet) return;

    const updated = wallets.filter(w => w.id !== id);
    setWallets(updated);
    saveWallets(updated);

    if (activeWalletId === id) {
      const newActive = updated.length > 0 ? updated[0].id : null;
      setActiveWalletId(newActive);
      if (parentAddress && newActive) {
        localStorage.setItem(`${ACTIVE_KEY}_${parentAddress.toLowerCase()}`, newActive);
      }
    }

    await fetch(`/api/wallets?id=${wallet.id}`, { method: 'DELETE' });
  }, [wallets, activeWalletId, parentAddress, saveWallets]);

  const updateLabel = useCallback((id: string, label: string) => {
    const updated = wallets.map(w => w.id === id ? { ...w, label } : w);
    setWallets(updated);
    saveWallets(updated);
  }, [wallets, saveWallets]);

  const updateINFT = useCallback((id: string, inft: INFTInfo) => {
    const updated = wallets.map(w => w.id === id ? { ...w, inft, hasAgents: true } : w);
    setWallets(updated);
    saveWallets(updated);
  }, [wallets, saveWallets]);

  const refreshWallets = useCallback(async () => {
    loadWallets();
  }, [loadWallets]);

  const activeWallet = wallets.find(w => w.id === activeWalletId) || null;

  return (
    <WalletContext.Provider
      value={{
        wallets,
        activeWallet,
        isLoading,
        createWallet,
        selectWallet,
        deleteWallet,
        updateLabel,
        updateINFT,
        refreshWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within WalletProvider');
  }
  return context;
}
