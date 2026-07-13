'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import Link from 'next/link';
import {
  Wallet, Plus, ArrowRight, ArrowLeft,
  Shield, Cpu, Sparkles, Copy, Check
} from 'lucide-react';
import { useWalletContext } from '@/context/wallet-context';
import { WalletCard } from '@/components/wallet/wallet-card';
import { CreateWalletModal } from '@/components/wallet/create-modal';

export default function WalletsPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { wallets, activeWallet, createWallet, selectWallet, deleteWallet, updateLabel } = useWalletContext();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Subtle grid lines - matching landing */}
      <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-white/10"
            style={{
              top: `${12.5 * (i + 1)}%`,
              left: 0,
              right: 0,
            }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-white/10"
            style={{
              left: `${8.33 * (i + 1)}%`,
              top: 0,
              bottom: 0,
            }}
          />
        ))}
      </div>

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black/80 pointer-events-none z-[2]" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 h-20">
        <Link href="/" className="flex items-center gap-3 text-white/70 hover:text-white transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Back</span>
        </Link>

        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-2xl text-white tracking-tight">BEANSTICK</span>
        </Link>

        {isConnected ? (
          <button
            onClick={() => disconnect()}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <div className="w-24" />
        )}
      </nav>

      <main className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
        {/* Header */}
        <div className={`mb-8 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-sm font-mono text-white/60">
            <span className="w-8 h-px bg-white/30" />
            Multi-wallet Management
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <h1 className="text-[clamp(2.5rem,5vw,5rem)] font-display leading-[0.92] tracking-tight text-white mb-6">
            Your Wallets
          </h1>
          <p className="text-white/50 text-lg max-w-xl">
            Manage multiple trading identities. Each wallet gets its own Fiat and Crypto agents.
          </p>
        </motion.div>

        {/* Not connected state */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md"
          >
            <div className="border border-white/10 rounded-2xl p-10 bg-white/[0.02] backdrop-blur-sm">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                <Wallet className="w-8 h-8 text-white/70" />
              </div>
              <h2 className="text-2xl font-display text-white mb-3">Connect Your Wallet</h2>
              <p className="text-white/50 text-sm mb-8 leading-relaxed">
                Connect MetaMask to create and manage your trading wallets
              </p>
              <button
                onClick={() => connect({ connector: connectors[0] })}
                className="w-full bg-white hover:bg-white/90 text-black font-medium py-4 px-6 rounded-full flex items-center justify-center gap-3 transition-all"
              >
                <Wallet className="w-5 h-5" />
                Connect MetaMask
              </button>
            </div>
          </motion.div>
        )}

        {/* Connected state */}
        {isConnected && (
          <>
            {/* Parent wallet info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-12 p-6 border border-white/10 rounded-2xl bg-white/[0.02]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Parent Wallet</p>
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-white text-lg">
                        {address?.slice(0, 10)}...{address?.slice(-8)}
                      </p>
                      <button
                        onClick={() => copyAddress(address!)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
                      >
                        {copiedAddress === address ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </div>
              </div>
            </motion.div>

            {/* Wallet grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              <AnimatePresence mode="popLayout">
                {wallets.map((wallet, index) => (
                  <WalletCard
                    key={wallet.id}
                    wallet={wallet}
                    isActive={activeWallet?.id === wallet.id}
                    onSelect={() => selectWallet(wallet.id)}
                    onDelete={() => deleteWallet(wallet.id)}
                    onUpdateLabel={(label) => updateLabel(wallet.id, label)}
                    index={index}
                  />
                ))}
              </AnimatePresence>

              {/* Add wallet card */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: wallets.length * 0.08 + 0.1 }}
                onClick={() => setShowCreateModal(true)}
                className="group relative rounded-2xl border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500 min-h-[200px]"
              >
                <div className="h-full p-6 flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-2xl border border-white/10 group-hover:border-white/20 bg-white/[0.02] flex items-center justify-center transition-all">
                    <Plus className="w-7 h-7 text-white/40 group-hover:text-white transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-white/60 group-hover:text-white transition-colors">Add Wallet</p>
                    <p className="text-xs text-white/30 group-hover:text-white/50 transition-colors mt-1">Create new identity</p>
                  </div>
                </div>
              </motion.button>
            </div>

            {/* Empty state */}
            {wallets.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center py-12"
              >
                <Sparkles className="w-8 h-8 text-white/30 mx-auto mb-4" />
                <p className="text-white/50">Create your first wallet to start trading</p>
              </motion.div>
            )}

            {/* Continue button */}
            {wallets.length > 0 && activeWallet && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex justify-start"
              >
                <Link
                  href="/p2p"
                  className="group inline-flex items-center gap-3 bg-white hover:bg-white/90 text-black font-medium py-4 px-8 rounded-full transition-all"
                >
                  <span>Continue to Trading</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            )}

            {/* Info cards */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 pt-12 border-t border-white/10"
            >
              {[
                {
                  icon: Shield,
                  title: 'Secure Keys',
                  desc: 'Private keys stored locally in your browser',
                },
                {
                  icon: Cpu,
                  title: 'Agent Pairs',
                  desc: 'Each wallet gets its own trading agents',
                },
                {
                  icon: Sparkles,
                  title: 'Multiple Identities',
                  desc: 'Segregate trades across different wallets',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-white/50" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white text-sm">{item.title}</h3>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </main>

      <CreateWalletModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (label) => {
          await createWallet(label);
        }}
      />
    </div>
  );
}
