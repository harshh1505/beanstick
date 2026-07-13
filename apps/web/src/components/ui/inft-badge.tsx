'use client';

import { useState } from 'react';
import { useINFT, INFTDetails } from '@/hooks/useINFT';

interface INFTBadgeProps {
  tokenId: string;
  agentType: 'fiat' | 'crypto';
  compact?: boolean;
}

export function INFTBadge({ tokenId, agentType, compact = false }: INFTBadgeProps) {
  const { fetchINFTDetails, loading } = useINFT();
  const [details, setDetails] = useState<INFTDetails | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleClick = async () => {
    if (!details && !loading) {
      const data = await fetchINFTDetails(tokenId);
      setDetails(data);
    }
    setExpanded(!expanded);
  };

  const typeColor = agentType === 'fiat' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  const typeIcon = agentType === 'fiat' ? '$' : 'C';

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${typeColor}`}>
        <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
          {typeIcon}
        </span>
        #{tokenId}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:scale-105 ${typeColor}`}
      >
        <div className="w-6 h-6 rounded-full bg-current/20 flex items-center justify-center font-bold">
          {typeIcon}
        </div>
        <div className="text-left">
          <div className="text-xs opacity-70">iNFT</div>
          <div className="font-mono text-sm">#{tokenId}</div>
        </div>
        {loading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      {expanded && details && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[280px]">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold capitalize">{details.metadata.agentType} Agent</h4>
              <span className={`px-2 py-0.5 rounded text-xs ${details.metadata.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {details.metadata.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">AXL Pubkey</span>
                <span className="font-mono text-xs">{details.metadata.axlPubkey.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">State Hash</span>
                <span className="font-mono text-xs">{details.metadata.stateHash.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Created</span>
                <span className="text-xs">{new Date(Number(details.metadata.createdAt) * 1000).toLocaleString()}</span>
              </div>
            </div>

            {details.intelligentData.length > 0 && (
              <div className="pt-2 border-t border-zinc-700">
                <div className="text-xs text-zinc-500 mb-1">Intelligent Data</div>
                {details.intelligentData.slice(0, 3).map((d, i) => (
                  <div key={i} className="text-xs font-mono truncate">{d.dataDescription}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface INFTPairProps {
  fiatTokenId: string | null;
  cryptoTokenId: string | null;
}

export function INFTPair({ fiatTokenId, cryptoTokenId }: INFTPairProps) {
  if (!fiatTokenId && !cryptoTokenId) {
    return (
      <div className="text-xs text-zinc-500 italic">No iNFTs minted</div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {fiatTokenId && <INFTBadge tokenId={fiatTokenId} agentType="fiat" />}
      {cryptoTokenId && <INFTBadge tokenId={cryptoTokenId} agentType="crypto" />}
    </div>
  );
}
