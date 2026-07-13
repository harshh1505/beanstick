'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface CreateWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (label: string) => Promise<void>;
}

export function CreateWalletModal({ isOpen, onClose, onCreate }: CreateWalletModalProps) {
  const [label, setLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await onCreate(label || `Wallet ${Date.now().toString().slice(-4)}`);
      setLabel('');
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="relative border border-white/10 rounded-2xl bg-black overflow-hidden">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white/70" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display text-white">Create Wallet</h2>
                    <p className="text-sm text-white/50 mt-1">Generate a new agent wallet</p>
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm text-white/50 mb-3">
                      Wallet Label
                    </label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g., Trading, Savings, DeFi..."
                      className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-all"
                    />
                  </div>

                  <div className="bg-white/[0.02] rounded-xl p-4 border border-white/10">
                    <p className="text-xs text-white/40 leading-relaxed">
                      A new wallet will be generated with its own private key.
                      Each wallet can have its own Fiat and Crypto agents for trading.
                    </p>
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="w-full bg-white hover:bg-white/90 text-black font-medium py-4 px-4 rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Create Wallet
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
