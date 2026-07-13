'use client';

import { motion } from 'framer-motion';
import { Check, Trash2, Edit3, Cpu, Wallet, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { DerivedWallet } from '@/context/wallet-context';
import { INFTBadge } from '@/components/ui/inft-badge';

interface WalletCardProps {
  wallet: DerivedWallet;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdateLabel: (label: string) => void;
  index: number;
}

export function WalletCard({
  wallet,
  isActive,
  onSelect,
  onDelete,
  onUpdateLabel,
  index,
}: WalletCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(wallet.label);

  const handleSaveLabel = () => {
    if (editLabel.trim()) {
      onUpdateLabel(editLabel.trim());
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      onClick={onSelect}
      className={`
        group relative cursor-pointer rounded-2xl transition-all duration-300
        border bg-white/[0.02]
        ${isActive
          ? 'border-white/30'
          : 'border-white/10 hover:border-white/20'
        }
      `}
    >
      <div className="relative h-full rounded-2xl p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className={`
              relative w-12 h-12 rounded-xl flex items-center justify-center border
              ${isActive
                ? 'bg-white/10 border-white/30'
                : 'bg-white/[0.02] border-white/10 group-hover:border-white/20'
              }
              transition-all duration-300
            `}>
              <Wallet className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/50'}`} />
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-black" strokeWidth={3} />
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={handleSaveLabel}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel()}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-sm w-full text-white focus:outline-none focus:border-white/40"
                />
              ) : (
                <h3 className="font-medium text-white truncate">{wallet.label}</h3>
              )}
              <p className="text-xs text-white/40 font-mono mt-1">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Agent status */}
        <div className={`
          flex items-center gap-3 px-4 py-3 rounded-xl border
          ${wallet.hasAgents
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-white/[0.02] border-white/10'
          }
        `}>
          <Cpu className={`w-4 h-4 ${wallet.hasAgents ? 'text-emerald-400' : 'text-white/40'}`} />
          <span className={`text-xs font-medium ${wallet.hasAgents ? 'text-emerald-400' : 'text-white/40'}`}>
            {wallet.hasAgents ? '2 Agents Active' : 'No Agents'}
          </span>
          {wallet.hasAgents && (
            <div className="ml-auto flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
            </div>
          )}
        </div>

        {/* iNFT Badges */}
        {wallet.inft && (
          <div className="mt-3 p-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">iNFTs (ERC-7857)</span>
            </div>
            <div className="flex gap-2">
              <INFTBadge tokenId={wallet.inft.fiatTokenId} agentType="fiat" compact />
              <INFTBadge tokenId={wallet.inft.cryptoTokenId} agentType="crypto" compact />
            </div>
          </div>
        )}

        {/* Created date */}
        <p className="text-[10px] text-white/30 mt-4 text-right">
          Created {new Date(wallet.createdAt).toLocaleDateString()}
        </p>
      </div>
    </motion.div>
  );
}
