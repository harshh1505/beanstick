'use client';

// components/ui/proof-timeline.tsx
//
// Order Proof Timeline UI Component (G.12.7)
// Shows the settlement progress from lock to release.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  FileText,
  CreditCard,
  Eye,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { ProofPhase, OrderProofTimeline } from '../../types/lp';

interface ProofTimelineProps {
  orderId: string;
  onPhaseChange?: (phase: ProofPhase) => void;
  overridePhase?: ProofPhase;
}

const PHASE_CONFIG: Record<ProofPhase, {
  label: string;
  icon: typeof Lock;
  color: string;
  description: string;
}> = {
  AWAITING_LOCK: {
    label: 'Awaiting Lock',
    icon: Clock,
    color: 'text-gray-400',
    description: 'Waiting for LP to lock crypto in escrow',
  },
  LOCKED: {
    label: 'Crypto Locked',
    icon: Lock,
    color: 'text-blue-500',
    description: 'Crypto is locked in escrow',
  },
  AWAITING_FIAT_DETAILS: {
    label: 'Awaiting Details',
    icon: FileText,
    color: 'text-yellow-500',
    description: 'Waiting for LP to send payment details',
  },
  AWAITING_PAYMENT: {
    label: 'Awaiting Payment',
    icon: CreditCard,
    color: 'text-orange-500',
    description: 'Buyer needs to complete fiat payment',
  },
  PAYMENT_OBSERVED: {
    label: 'Payment Observed',
    icon: Eye,
    color: 'text-purple-500',
    description: 'WatcherAgent detected payment event',
  },
  GENERATING_PROOF: {
    label: 'Generating Proof',
    icon: Shield,
    color: 'text-indigo-500',
    description: 'AttestationAgent is generating proof',
  },
  PROOF_GENERATED: {
    label: 'Proof Generated',
    icon: Shield,
    color: 'text-indigo-600',
    description: 'Proof generated, awaiting verification',
  },
  VERIFYING_PROOF: {
    label: 'Verifying',
    icon: Shield,
    color: 'text-cyan-500',
    description: 'Escrow is verifying the proof',
  },
  PROOF_VERIFIED: {
    label: 'Proof Verified',
    icon: CheckCircle,
    color: 'text-green-500',
    description: 'Proof accepted, releasing funds',
  },
  RELEASING_FUNDS: {
    label: 'Releasing',
    icon: CheckCircle,
    color: 'text-green-600',
    description: 'Escrow is releasing crypto to buyer',
  },
  RELEASED: {
    label: 'Released',
    icon: CheckCircle,
    color: 'text-green-600',
    description: 'Crypto delivered to buyer',
  },
  PROOF_FAILED: {
    label: 'Proof Failed',
    icon: XCircle,
    color: 'text-red-500',
    description: 'Proof verification failed',
  },
  TIMEOUT: {
    label: 'Expired',
    icon: Clock,
    color: 'text-red-500',
    description: 'Order deadline passed',
  },
  DISPUTED: {
    label: 'Disputed',
    icon: AlertTriangle,
    color: 'text-amber-500',
    description: 'Order is under dispute',
  },
};

const PHASE_ORDER: ProofPhase[] = [
  'AWAITING_LOCK',
  'LOCKED',
  'AWAITING_FIAT_DETAILS',
  'AWAITING_PAYMENT',
  'PAYMENT_OBSERVED',
  'GENERATING_PROOF',
  'PROOF_GENERATED',
  'VERIFYING_PROOF',
  'PROOF_VERIFIED',
  'RELEASING_FUNDS',
  'RELEASED',
];

export function ProofTimeline({ orderId, onPhaseChange, overridePhase }: ProofTimelineProps) {
  const [timeline, setTimeline] = useState<OrderProofTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const res = await fetch(`/api/orders/${orderId}/proof`);
        if (!res.ok) throw new Error('Failed to fetch timeline');
        const data = await res.json();
        setTimeline(data.timeline);
        if (onPhaseChange && data.timeline) {
          onPhaseChange(data.timeline.phase);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
    const interval = setInterval(fetchTimeline, 5000);
    return () => clearInterval(interval);
  }, [orderId, onPhaseChange]);

  const activePhase = overridePhase || timeline?.phase || 'AWAITING_LOCK';

  if (loading && !overridePhase && !timeline) {
    return (
      <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-zinc-800 rounded w-1/3" />
          <div className="h-20 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  const currentPhaseIndex = PHASE_ORDER.indexOf(activePhase);
  const isTerminal = ['RELEASED', 'PROOF_FAILED', 'TIMEOUT', 'DISPUTED'].includes(activePhase);

  return (
    <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Settlement Timeline</h3>

      <div className="space-y-1">
        {PHASE_ORDER.slice(0, 7).map((phase, index) => {
          const config = PHASE_CONFIG[phase];
          const Icon = config.icon;
          const isActive = phase === activePhase && activePhase !== 'RELEASED';
          const isComplete = currentPhaseIndex > index || activePhase === 'RELEASED';
          const isPending = currentPhaseIndex < index && !isTerminal;

          const event = timeline?.events?.find(e => e.phase === phase);
          const timestamp = event?.timestamp || (isComplete ? Date.now() - (7 - index) * 4000 : undefined);

          return (
            <motion.div
              key={phase}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-start gap-3 py-2 px-2 rounded ${
                isActive ? 'bg-zinc-800' : ''
              }`}
            >
              <div className="relative">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isComplete
                      ? 'bg-green-900/50'
                      : isActive
                      ? 'bg-blue-900/50'
                      : 'bg-zinc-800'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isComplete
                        ? 'text-green-400'
                        : isActive
                        ? config.color
                        : 'text-zinc-600'
                    }`}
                  />
                </div>
                {index < PHASE_ORDER.slice(0, 7).length - 1 && (
                  <div
                    className={`absolute left-3 top-6 w-px h-6 ${
                      isComplete ? 'bg-green-600' : 'bg-zinc-700'
                    }`}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${
                      isComplete
                        ? 'text-green-400'
                        : isActive
                        ? 'text-white'
                        : isPending
                        ? 'text-zinc-500'
                        : 'text-zinc-400'
                    }`}
                  >
                    {config.label}
                  </span>
                  {timestamp && (
                    <span className="text-xs text-zinc-500">
                      {formatTime(timestamp)}
                    </span>
                  )}
                </div>
                {isActive && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {config.description}
                  </p>
                )}
                {event?.txHash && (
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1"
                  >
                    {event.txHash.slice(0, 10)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {timeline?.evidenceHash && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500">Evidence Hash</div>
          <code className="text-xs text-zinc-400 break-all">
            {timeline.evidenceHash}
          </code>
        </div>
      )}

      {timeline?.storageRootHash && (
        <div className="mt-2">
          <div className="text-xs text-zinc-500">0G Storage Root</div>
          <a
            href={`https://chainscan-galileo.0g.ai/tx/${timeline.storageRootHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
          >
            {timeline.storageRootHash.slice(0, 20)}...
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ProofTimelineCompact({ orderId }: { orderId: string }) {
  const [phase, setPhase] = useState<ProofPhase>('AWAITING_LOCK');

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          phase === 'RELEASED'
            ? 'bg-green-500'
            : ['PROOF_FAILED', 'TIMEOUT', 'DISPUTED'].includes(phase)
            ? 'bg-red-500'
            : 'bg-blue-500 animate-pulse'
        }`}
      />
      <span className="text-sm text-zinc-400">
        {PHASE_CONFIG[phase]?.label || phase}
      </span>
    </div>
  );
}
