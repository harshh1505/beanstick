'use client';

import { useState, useCallback } from 'react';

export interface INFTData {
  fiatTokenId: string | null;
  cryptoTokenId: string | null;
  txHash: string | null;
}

export interface INFTMetadata {
  agentType: string;
  walletAddress: string;
  axlPubkey: string;
  stateHash: string;
  createdAt: string; // Unix timestamp as string
  isActive: boolean;
}

export interface INFTDetails {
  metadata: INFTMetadata;
  intelligentData: { dataDescription: string; dataHash: string }[];
  tokenURI: string;
}

export function useINFT() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchINFTDetails = useCallback(async (tokenId: string): Promise<INFTDetails | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inft/${tokenId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch iNFT');
      }
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchINFTDetails, loading, error };
}
