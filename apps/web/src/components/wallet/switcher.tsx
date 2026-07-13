'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Wallet, Plus, Check, Cpu } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useWalletContext, type DerivedWallet } from '@/context/wallet-context';
import { CreateWalletModal } from './create-modal';

export function WalletSwitcher() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { wallets, activeWallet, selectWallet, createWallet } = useWalletContext();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-full font-medium transition-all"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    );
  }

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 bg-zinc-800/50 hover:bg-zinc-700/50 pl-3 pr-2 py-2 rounded-full border border-zinc-700/50 transition-all group"
        >
          {/* Status indicator */}
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

          {/* Wallet info */}
          <div className="text-left min-w-0">
            <p className="text-xs text-zinc-400 leading-none">
              {activeWallet ? activeWallet.label : 'No wallet'}
            </p>
            <p className="text-sm font-mono text-white truncate">
              {activeWallet
                ? `${activeWallet.address.slice(0, 6)}...${activeWallet.address.slice(-4)}`
                : `${address?.slice(0, 6)}...${address?.slice(-4)}`
              }
            </p>
          </div>

          {/* Dropdown indicator */}
          <div className="flex items-center gap-1">
            {wallets.length > 0 && (
              <span className="text-[10px] font-medium bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                {wallets.length}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Connected parent wallet */}
              <div className="p-3 border-b border-zinc-800/50 bg-zinc-800/30">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Connected via MetaMask</p>
                <p className="text-sm font-mono text-zinc-300">
                  {address?.slice(0, 10)}...{address?.slice(-8)}
                </p>
              </div>

              {/* Wallet list */}
              <div className="max-h-64 overflow-y-auto">
                {wallets.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-zinc-500">No wallets yet</p>
                    <p className="text-xs text-zinc-600 mt-1">Create one to get started</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {wallets.map((wallet) => (
                      <WalletItem
                        key={wallet.id}
                        wallet={wallet}
                        isActive={activeWallet?.id === wallet.id}
                        onSelect={() => {
                          selectWallet(wallet.id);
                          setIsOpen(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-2 border-t border-zinc-800/50 bg-zinc-800/20">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add Wallet</span>
                </button>
                <button
                  onClick={() => {
                    disconnect();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors mt-1"
                >
                  <span className="text-sm">Disconnect</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CreateWalletModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (label) => {
          await createWallet(label);
        }}
      />
    </>
  );
}

function WalletItem({
  wallet,
  isActive,
  onSelect,
}: {
  wallet: DerivedWallet;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
        ${isActive
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'hover:bg-zinc-800 border border-transparent'
        }
      `}
    >
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center
        ${isActive ? 'bg-emerald-500' : 'bg-zinc-700'}
      `}>
        <Wallet className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-zinc-300'}`}>
          {wallet.label}
        </p>
        <p className="text-xs font-mono text-zinc-500">
          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {wallet.hasAgents && (
          <div className="flex items-center gap-1 text-emerald-400">
            <Cpu className="w-3 h-3" />
            <span className="text-[10px]">2</span>
          </div>
        )}
        {isActive && <Check className="w-4 h-4 text-emerald-400" />}
      </div>
    </button>
  );
}
