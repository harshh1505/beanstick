'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, keccak256, toBytes } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Loader2, ArrowRight, Wallet, Zap, ExternalLink,
  ChevronDown, Banknote, Coins, ArrowDownUp, Shield, Clock, Activity,
  Sparkles, Radio, CircleDot, TrendingUp, Star, Eye, Plus
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { ProofTimeline } from '../../components/ui/proof-timeline';
import { ProofPhase } from '../../types/lp';
import { WalletSwitcher } from '@/components/wallet/switcher';
import { useWalletContext } from '@/context/wallet-context';
import { CreateWalletModal } from '@/components/wallet/create-modal';

type OrderState = 'INIT' | 'CONNECTING_AGENTS' | 'BROADCASTING' | 'QUOTING' | 'SELECTING' | 'COMMITTING' | 'LOCKED' | 'PAYING' | 'RELEASED' | 'ERROR';

interface Quote {
  quoteId: string;
  lpAgent: string;
  rate: string;
  outputAmount: string;
  fee: string;
  rails: string[];
  reputation: number;
}

interface FiatDetails {
  railType: string;
  paymentId: string;
  reference: string;
  qrPayload?: string;
}

interface AppState {
  state: OrderState;
  rfqId?: string;
  quotes: Quote[];
  selectedQuote?: Quote;
  lockTx?: `0x${string}`;
  releaseTx?: string;
  evidenceRootHash?: string;
  error?: string;
  fiatDetails?: FiatDetails;
}

interface AxlEvent {
  ts: number;
  dir: 'send' | 'recv' | 'info';
  type: string;
}

interface AgentAttestation {
  codeHash: string;
  chatId: string;
  verified: boolean;
  attestedAt: number;
}

interface AgentDecisions {
  fiat: { agentName: string; attestation: AgentAttestation | null; decisions: any[]; memoryHash: string | null };
  crypto: { agentName: string; attestation: AgentAttestation | null; decisions: any[]; memoryHash: string | null };
}

interface INFTInfo {
  fiatTokenId: string;
  cryptoTokenId: string;
  txHash: string;
}

interface AgentStatus {
  fiatPubkey: string;
  cryptoPubkey: string;
  decisions?: AgentDecisions;
  inft?: INFTInfo;
}

const ESCROW_ADDRESS = '0xeAD29cBfAb93ed51808D65954Dd1b3cDDaDA1348' as const;
const TOKEN_ADDRESS = '0x5F2577675beD125794FDfc44940b62D60BF00F81' as const;

const ESCROW_ABI = [
  {
    name: 'lock',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'fiatAmount', type: 'uint256' },
      { name: 'fiatCurrency', type: 'string' },
      { name: 'railType', type: 'string' },
      { name: 'deadlineSeconds', type: 'uint256' },
      { name: 'orderRefId', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'lockWithCommitments',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'fiatAmount', type: 'uint256' },
      { name: 'fiatCurrency', type: 'string' },
      { name: 'railType', type: 'string' },
      { name: 'deadlineSeconds', type: 'uint256' },
      { name: 'orderRefId', type: 'string' },
      { name: 'receiverCommitment', type: 'bytes32' },
      { name: 'referenceHash', type: 'bytes32' },
      { name: 'challengeWindow', type: 'uint256' },
      { name: 'attestationMode', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

const FIAT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
];

const CRYPTO_CURRENCIES = [
  { code: 'SOL', name: 'Solana', icon: '◎' },
  { code: 'USDC', name: 'USD Coin (Solana)', icon: '◎' },
  { code: 'PYUSD', name: 'PayPal USD (Solana)', icon: '◎' },
];

const RAILS = [
  { id: 'banksim', name: 'Bank', desc: 'Bank to bank transfer' },
  { id: 'venmo', name: 'Venmo', desc: 'US P2P' },
];

function BlurReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <span
      className="inline-block transition-all duration-700"
      style={{
        opacity: isVisible ? 1 : 0,
        filter: isVisible ? 'blur(0px)' : 'blur(12px)',
        transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      {children}
    </span>
  );
}

function GridOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.08]">
      {[...Array(6)].map((_, i) => (
        <div
          key={`h-${i}`}
          className="absolute h-px bg-black/5"
          style={{ top: `${16.66 * (i + 1)}%`, left: 0, right: 0 }}
        />
      ))}
      {[...Array(8)].map((_, i) => (
        <div
          key={`v-${i}`}
          className="absolute w-px bg-black/5"
          style={{ left: `${12.5 * (i + 1)}%`, top: 0, bottom: 0 }}
        />
      ))}
    </div>
  );
}

function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 40 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.8 + Math.random() * 1.5,
      speed: 0.2 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
    }));

    let time = 0;
    let frameId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach(p => {
        const x = p.x * canvas.offsetWidth + Math.sin(time * p.speed + p.phase) * 30;
        const y = p.y * canvas.offsetHeight + Math.cos(time * p.speed * 0.7 + p.phase) * 20;
        const alpha = 0.1 + Math.sin(time + p.phase) * 0.08;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      });
      time += 0.012;
      frameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

function AgentStatusBadge({ agentStatus }: { agentStatus: AgentStatus | null }) {
  if (!agentStatus) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
        <span>Awaiting agents</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-emerald-400">2 Agents Online</span>
    </div>
  );
}

function SwapForm({
  intent,
  setIntent,
  onSubmit,
  disabled,
  agentStatus
}: {
  intent: { amount: string; fromCcy: string; toCcy: string; rail: string };
  setIntent: (i: any) => void;
  onSubmit: () => void;
  disabled: boolean;
  agentStatus: AgentStatus | null;
}) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  const selectedFiat = FIAT_CURRENCIES.find(c => c.code === intent.fromCcy) || FIAT_CURRENCIES[0];
  const selectedCrypto = CRYPTO_CURRENCIES.find(c => c.code === intent.toCcy) || CRYPTO_CURRENCIES[0];
  const selectedRail = RAILS.find(r => r.id === intent.rail) || RAILS[0];

  return (
    <div className="relative">
      <div className="relative overflow-hidden">
        <FloatingParticles />

        <div className="relative bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-foreground/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground">01</span>
              <h2 className="text-lg font-display">Swap</h2>
            </div>
            <AgentStatusBadge agentStatus={agentStatus} />
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5 relative z-30">
              <label className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">You Pay</label>
              <div className="relative bg-[#F9F9F9] rounded-2xl border border-black/5 focus-within:border-black/20 focus-within:bg-white transition-all shadow-sm">
                <input
                  type="number"
                  value={intent.amount}
                  onChange={(e) => setIntent({ ...intent, amount: e.target.value })}
                  className="w-full bg-transparent px-4 py-3 text-2xl font-display text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <button
                    onClick={() => setFromOpen(!fromOpen)}
                    className="flex items-center gap-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 px-4 py-2.5 transition-colors"
                  >
                    <span className="text-xl">{selectedFiat.flag}</span>
                    <span className="text-sm font-mono">{selectedFiat.code}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>

                  <AnimatePresence>
                    {fromOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white border border-foreground/20 shadow-2xl z-[100]"
                      >
                        {FIAT_CURRENCIES.map((c) => (
                          <button
                            key={c.code}
                            onClick={() => { setIntent({ ...intent, fromCcy: c.code }); setFromOpen(false); }}
                            className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-foreground/5 transition-colors ${intent.fromCcy === c.code ? 'bg-emerald-500/10' : ''}`}
                          >
                            <span className="text-xl">{c.flag}</span>
                            <div className="text-left">
                              <div className={`text-sm font-mono ${intent.fromCcy === c.code ? 'text-emerald-400' : 'text-foreground'}`}>{c.code}</div>
                              <div className="text-xs text-muted-foreground">{c.name}</div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex justify-center -my-1">
              <div className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center bg-white shadow-sm hover:scale-105 transition-transform cursor-pointer">
                <ArrowDownUp className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-1.5 relative z-20">
              <label className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">You Receive</label>
              <div className="relative bg-[#F9F9F9] rounded-2xl border border-black/5 shadow-sm">
                <div className="px-4 py-3 text-2xl font-display text-muted-foreground/50">
                  ≈ pending
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <button
                    onClick={() => setToOpen(!toOpen)}
                    className="flex items-center gap-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 px-4 py-2.5 transition-colors"
                  >
                    <span className="text-xl">{selectedCrypto.icon}</span>
                    <span className="text-sm font-mono">{selectedCrypto.code}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>

                  <AnimatePresence>
                    {toOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white border border-foreground/20 shadow-2xl z-[100]"
                      >
                        {CRYPTO_CURRENCIES.map((c) => (
                          <button
                            key={c.code}
                            onClick={() => { setIntent({ ...intent, toCcy: c.code }); setToOpen(false); }}
                            className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-foreground/5 transition-colors ${intent.toCcy === c.code ? 'bg-emerald-500/10' : ''}`}
                          >
                            <span className="text-xl">{c.icon}</span>
                            <div className="text-left">
                              <div className={`text-sm font-mono ${intent.toCcy === c.code ? 'text-emerald-400' : 'text-foreground'}`}>{c.code}</div>
                              <div className="text-xs text-muted-foreground">{c.name}</div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 relative z-10">
              <label className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Payment Rail</label>
              <button
                onClick={() => setRailOpen(!railOpen)}
                className="w-full flex items-center justify-between border border-black/5 rounded-2xl bg-[#F9F9F9] shadow-sm px-5 py-4 hover:border-black/10 hover:bg-white transition-all"
              >
                <div className="flex items-center gap-3">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <div className="text-left">
                    <div className="text-xs font-mono text-foreground">{selectedRail.name}</div>
                    <div className="text-[10px] text-muted-foreground">{selectedRail.desc}</div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${railOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {railOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border border-foreground/10 bg-white overflow-hidden"
                  >
                    {RAILS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setIntent({ ...intent, rail: r.id }); setRailOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/5 transition-colors ${intent.rail === r.id ? 'bg-emerald-500/10' : ''}`}
                      >
                        <Radio className={`w-3.5 h-3.5 ${intent.rail === r.id ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                        <div className="text-left">
                          <div className={`text-xs font-mono ${intent.rail === r.id ? 'text-emerald-400' : 'text-foreground'}`}>{r.name}</div>
                          <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              onClick={onSubmit}
              disabled={disabled || !agentStatus || !intent.amount}
              className="w-full relative overflow-hidden bg-black text-white rounded-full font-medium text-base py-4 mt-4 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90 transition-colors shadow-lg shadow-black/10"
              whileHover={{ scale: disabled ? 1 : 1.01 }}
              whileTap={{ scale: disabled ? 1 : 0.99 }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {!agentStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Spawning Agents
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Get Quotes
                  </>
                )}
              </span>
              {/* Removed flashy multi-gradient for premium solid look */}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteCard({ quote, index, intent, onSelect, selected }: {
  quote: Quote;
  index: number;
  intent: { fromCcy: string; toCcy: string };
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <motion.button
      onClick={onSelect}
      className={`w-full text-left border transition-all ${
        selected
          ? 'border-black bg-[#F9F9F9] shadow-md'
          : 'border-black/5 bg-white shadow-sm hover:border-black/10'
      }`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display">{quote.outputAmount}</span>
            <span className="text-sm text-muted-foreground">{intent.toCcy}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-foreground/5 border border-foreground/10">
            <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-mono">{quote.reputation}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rate: {quote.rate}</span>
            <span className="text-foreground/20">|</span>
            <span>Fee: {quote.fee}</span>
          </div>
          <ArrowRight className={`w-3 h-3 transition-colors ${selected ? 'text-emerald-400' : 'text-foreground/20'}`} />
        </div>
      </div>
    </motion.button>
  );
}

function OrderProgress({ state, intent, selectedQuote }: {
  state: OrderState;
  intent: { amount: string; fromCcy: string; toCcy: string };
  selectedQuote?: Quote;
}) {
  const steps = [
    { id: 'INIT', label: 'Ready', icon: CircleDot },
    { id: 'BROADCASTING', label: 'Broadcasting', icon: Radio, includes: ['BROADCASTING', 'QUOTING'] },
    { id: 'SELECTING', label: 'Quotes', icon: TrendingUp, includes: ['SELECTING'] },
    { id: 'COMMITTING', label: 'Locking', icon: Shield, includes: ['COMMITTING'] },
    { id: 'LOCKED', label: 'Locked', icon: Clock, includes: ['LOCKED'] },
    { id: 'PAYING', label: 'Paying', icon: Banknote, includes: ['PAYING'] },
    { id: 'RELEASED', label: 'Complete', icon: CheckCircle2 },
  ];

  const getCurrentStepIndex = () => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (step.id === state || step.includes?.includes(state)) return i;
    }
    return 0;
  };

  const currentIdx = getCurrentStepIndex();

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-foreground/10">
        <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-2">
          <Activity className="w-2.5 h-2.5" />
          Progress
        </span>
      </div>

      <div className="p-4 space-y-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentIdx;
          const isComplete = idx < currentIdx;

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className={`w-6 h-6 border flex items-center justify-center transition-all ${
                isActive ? 'border-emerald-500 bg-emerald-500/10' :
                isComplete ? 'border-emerald-500/30 bg-emerald-500/5' :
                'border-foreground/10 bg-white'
              }`}>
                {isActive ? (
                  <Loader2 className="w-2.5 h-2.5 text-emerald-400 animate-spin" />
                ) : (
                  <Icon className={`w-2.5 h-2.5 ${isComplete ? 'text-emerald-400' : 'text-foreground/30'}`} />
                )}
              </div>
              <span className={`text-xs font-mono ${
                isActive ? 'text-foreground' :
                isComplete ? 'text-muted-foreground' :
                'text-foreground/30'
              }`}>
                {step.label}
              </span>
              {isActive && (
                <span className="ml-auto text-[10px] font-mono text-emerald-400">Active</span>
              )}
            </div>
          );
        })}
      </div>

      {selectedQuote && state !== 'INIT' && (
        <div className="px-4 py-3 border-t border-foreground/10">
          <div className="text-[10px] font-mono text-muted-foreground mb-0.5">Selected</div>
          <div className="text-lg font-display">
            {selectedQuote.outputAmount} <span className="text-muted-foreground text-sm">{intent.toCcy}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentActivityLog({ events }: { events: AxlEvent[] }) {
  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5 h-full overflow-hidden">
      <div className="px-4 py-2.5 border-b border-foreground/10">
        <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-2">
          <Zap className="w-2.5 h-2.5" />
          Activity
        </span>
      </div>

      <div className="p-3 space-y-0.5 max-h-[180px] overflow-y-auto font-mono text-[10px]">
        {events.length === 0 ? (
          <p className="text-muted-foreground/50 text-center py-6">Awaiting activity...</p>
        ) : (
          events.slice().reverse().map((e, i) => (
            <motion.div
              key={i}
              className="flex gap-3 py-1.5 border-b border-foreground/5 last:border-0"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span className="text-foreground/30 w-16 shrink-0">
                {new Date(e.ts).toISOString().slice(11, 19)}
              </span>
              <span className={`w-12 shrink-0 ${
                e.dir === 'send' ? 'text-amber-400' :
                e.dir === 'recv' ? 'text-emerald-400' :
                'text-cyan-400'
              }`}>
                {e.dir}
              </span>
              <span className="text-foreground/80 truncate">{e.type}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function TransactionLinks({ lockTx, releaseTx, evidenceHash }: {
  lockTx?: string;
  releaseTx?: string;
  evidenceHash?: string;
}) {
  if (!lockTx && !releaseTx && !evidenceHash) return null;

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-foreground/10">
        <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-2">
          <ExternalLink className="w-2.5 h-2.5" />
          Transactions
        </span>
      </div>

      <div className="p-3 space-y-2">
        {lockTx && (
          <a
            href={`https://chainscan-galileo.0g.ai/tx/${lockTx}`}
            target="_blank"
            className="block p-3 border border-foreground/10 hover:border-foreground/20 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-muted-foreground">Lock</span>
              <ExternalLink className="w-2.5 h-2.5 text-foreground/30 group-hover:text-foreground transition-colors" />
            </div>
            <div className="text-[10px] font-mono text-foreground/70 truncate">{lockTx}</div>
          </a>
        )}

        {releaseTx && (
          <a
            href={`https://chainscan-galileo.0g.ai/tx/${releaseTx}`}
            target="_blank"
            className="block p-3 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-emerald-400">Release</span>
              <ExternalLink className="w-2.5 h-2.5 text-emerald-400/50 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="text-[10px] font-mono text-emerald-400/70 truncate">{releaseTx}</div>
          </a>
        )}

        {evidenceHash && (
          <div className="p-3 border border-indigo-500/30 bg-indigo-500/5">
            <div className="text-[10px] font-mono text-indigo-400 mb-1">0G Evidence</div>
            <div className="text-[10px] font-mono text-indigo-400/70 truncate">{evidenceHash}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCards({ agentStatus, currentPhase }: { agentStatus: AgentStatus | null; currentPhase: ProofPhase | null }) {
  if (!agentStatus) return null;

  const isWatcherActive = currentPhase === 'PAYMENT_OBSERVED';
  const isAttestorActive = currentPhase === 'GENERATING_PROOF' || currentPhase === 'PROOF_GENERATED';

  const agents = [
    { name: 'Fiat', desc: 'Rails', icon: Banknote, color: 'amber', key: agentStatus.fiatPubkey, active: true, tokenId: agentStatus.inft?.fiatTokenId },
    { name: 'Crypto', desc: 'Signer', icon: Coins, color: 'cyan', key: agentStatus.cryptoPubkey, active: true, tokenId: agentStatus.inft?.cryptoTokenId },
    { name: 'Watcher', desc: 'Observe', icon: Eye, color: 'purple', key: agentStatus.fiatPubkey ? `w:${agentStatus.fiatPubkey.slice(2, 16)}` : null, active: isWatcherActive },
    { name: 'Attestor', desc: 'Prove', icon: Shield, color: 'indigo', key: agentStatus.cryptoPubkey ? `a:${agentStatus.cryptoPubkey.slice(2, 16)}` : null, active: isAttestorActive },
  ];

  const colorMap: Record<string, string> = {
    amber: 'from-amber-500/20 to-orange-500/20 text-amber-400',
    cyan: 'from-cyan-500/20 to-blue-500/20 text-cyan-400',
    purple: 'from-purple-500/20 to-pink-500/20 text-purple-400',
    indigo: 'from-indigo-500/20 to-violet-500/20 text-indigo-400',
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {agents.map((agent) => {
        const Icon = agent.icon;
        return (
          <div
            key={agent.name}
            className={`border rounded-2xl shadow-sm bg-white p-4 ${agent.active ? 'border-emerald-500/30' : 'border-black/5'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 bg-gradient-to-br ${colorMap[agent.color]} flex items-center justify-center`}>
                <Icon className="w-3 h-3" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-foreground">{agent.name}</span>
                  <span className={`w-1 h-1 rounded-full ${agent.active ? 'bg-emerald-400 animate-pulse' : 'bg-foreground/20'}`} />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">{agent.desc}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <code className="text-[8px] text-foreground/40 bg-foreground/5 px-1.5 py-0.5 font-mono truncate">
                {agent.key ? `${agent.key.slice(0, 12)}...` : 'loading...'}
              </code>
              {agent.tokenId && (
                <span className="text-[8px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 font-mono border border-purple-500/30">
                  iNFT #{agent.tokenId}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function P2PPage() {
  const { address, isConnected } = useAccount();
  const { wallets, activeWallet, createWallet, updateINFT } = useWalletContext();
  const [appState, setAppState] = useState<AppState>({ state: 'INIT', quotes: [] });
  const [axlLog, setAxlLog] = useState<AxlEvent[]>([]);
  const [intent, setIntent] = useState({ amount: '100', fromCcy: 'USD', toCcy: 'SOL', rail: 'banksim' });
  const [orderRefId, setOrderRefId] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ProofPhase | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const effectiveAddress = activeWallet?.address || address;

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const { writeContract: approve, data: approveTxHash, error: approveError } = useWriteContract();
  const { writeContract: lock, data: lockTxHash, error: lockError } = useWriteContract();

  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isSuccess: lockSuccess } = useWaitForTransactionReceipt({ hash: lockTxHash });

  const addLog = useCallback((dir: 'send' | 'recv' | 'info', type: string) => {
    setAxlLog(prev => [...prev.slice(-49), { ts: Date.now(), dir, type }]);
  }, []);

  useEffect(() => {
    if (!isConnected || !effectiveAddress) {
      setAgentStatus(null);
      return;
    }

    const spawnAgents = async () => {
      try {
        addLog('info', 'Spawning agents...');
        // MOCKED AGENT DATA
        const data: any = {
          ok: true,
          fiatPubkey: "0xF1A7000000000000000000000000000000000000",
          cryptoPubkey: "0xCA97000000000000000000000000000000000000",
          inft: {
            fiatTokenId: "999",
            cryptoTokenId: "1000",
            chain: "0g-testnet",
            address: "0x1111222233334444555566667777888899990000"
          }
        };
        if (data.ok) {
          const status: AgentStatus = {
            fiatPubkey: data.fiatPubkey,
            cryptoPubkey: data.cryptoPubkey,
            inft: data.inft || undefined,
          };
          setAgentStatus(status);
          addLog('info', `Fiat Agent: ${data.fiatPubkey?.slice(0, 12)}...`);
          addLog('info', `Crypto Agent: ${data.cryptoPubkey?.slice(0, 12)}...`);
          if (data.inft) {
            addLog('info', `iNFT minted: #${data.inft.fiatTokenId}, #${data.inft.cryptoTokenId}`);
            // Save iNFT to wallet context
            if (activeWallet) {
              updateINFT(activeWallet.id, data.inft);
            }
          }

          setTimeout(async () => {
            try {
              const decisionsRes = await fetch(`/api/decisions/${effectiveAddress}`);
              if (decisionsRes.ok) {
                const decisions = await decisionsRes.json();
                setAgentStatus(prev => prev ? { ...prev, decisions } : prev);
                if (decisions.fiat?.attestation?.verified) {
                  addLog('info', 'Fiat Agent: TEE attested ✓');
                }
                if (decisions.crypto?.attestation?.verified) {
                  addLog('info', 'Crypto Agent: TEE attested ✓');
                }
              }
            } catch (err) {}
          }, 2000);
        } else {
          addLog('info', `Agent spawn failed: ${data.error}`);
        }
      } catch (err: any) {
        addLog('info', `Agent error: ${err.message}`);
      }
    };

    spawnAgents();
  }, [isConnected, effectiveAddress, addLog]);

  // Solana native escrow lock is handled via Anchor PDA CPI flow


  useEffect(() => {
    if (!orderRefId) return;

    const phaseMap: Record<OrderState, string | null> = {
      'INIT': null,
      'CONNECTING_AGENTS': null,
      'BROADCASTING': null,
      'QUOTING': null,
      'SELECTING': null,
      'COMMITTING': 'AWAITING_LOCK',
      'LOCKED': 'AWAITING_PAYMENT',
      'PAYING': 'PAYMENT_OBSERVED',
      'RELEASED': 'RELEASED',
      'ERROR': null,
    };

    const phase = phaseMap[appState.state];
    if (phase) {
      // MOCKED: API CALL COMMENTED OUT
      // fetch(`/api/orders/${orderRefId}/proof`, { ... });
    }
  }, [appState.state, orderRefId, appState.releaseTx]);

  useEffect(() => {
    if (approveError) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: approveError.message }));
    }
    if (lockError) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: lockError.message }));
    }
  }, [approveError, lockError]);

  const startOrder = async () => {
    if (!effectiveAddress || !agentStatus) return;

    const newOrderRefId = `order-${Date.now()}`;
    setOrderRefId(newOrderRefId);
    setAppState({ state: 'BROADCASTING', quotes: [] });
    setAxlLog([]);
    addLog('send', 'rfq.get');

    try {
      // MOCKED RFQ
      await new Promise(r => setTimeout(r, 800));
      const data = { ok: true, broadcastTo: 4, rfqId: `rfq-${Date.now()}` };

      addLog('info', `RFQ broadcast to ${data.broadcastTo} LPs`);
      setAppState(prev => ({ ...prev, rfqId: data.rfqId, state: 'QUOTING' }));

      setTimeout(() => {
        const quotesData = {
          quotes: [
            {
              quoteId: "mock-quote-1",
              lpAgent: "0xCA97000000000000000000000000000000000001",
              outputAmount: (parseFloat(intent.amount) * 0.99).toFixed(4),
              rate: "0.99",
              fee: "0.01",
              trustScore: 98,
              reputation: 99.5
            },
            {
              quoteId: "mock-quote-2",
              lpAgent: "0xCA97000000000000000000000000000000000002",
              outputAmount: (parseFloat(intent.amount) * 0.985).toFixed(4),
              rate: "0.985",
              fee: "0.015",
              trustScore: 82,
              reputation: 94.0
            }
          ]
        };
        quotesData.quotes.forEach((q: any) => {
          addLog('recv', `quote.sign (${q.rate} ${intent.toCcy}/${intent.fromCcy})`);
        });
        setAppState(prev => ({ ...prev, quotes: quotesData.quotes as any, state: 'SELECTING' }));
      }, 1500);
    } catch (err: any) {
      addLog('info', `Error: ${err.message}`);
      setAppState(prev => ({ ...prev, state: 'ERROR', error: err.message }));
    }
  };

  const selectQuote = async (quote: Quote, index: number) => {
    if (!effectiveAddress) return;

    setAppState(prev => ({ ...prev, selectedQuote: quote, state: 'COMMITTING' }));
    addLog('send', `order.commit → ${quote.lpAgent.slice(0, 12)}...`);

    try {
      // MOCKED COMMIT
      await new Promise(r => setTimeout(r, 1000));
      const data: any = { ok: true };

      if (data.ok) {
        addLog('recv', 'fiat.details');

        const fiatDetails: FiatDetails = data.fiatDetails || {
          railType: intent.rail,
          paymentId: 'harshh1505@canara',
          reference: orderRefId,
          qrPayload: `pay://harshh1505@canara?amount=${intent.amount}&ref=${orderRefId}`,
        };
        setAppState(prev => ({ ...prev, fiatDetails }));

        addLog('send', 'solana.pda.derive_escrow_vault');
        addLog('send', 'solana.program.lock_escrow (Anchor CPI)');
        await new Promise(r => setTimeout(r, 800));
        addLog('recv', 'EscrowLockedEvent (SPL Token-2022 Vault Funded)');
        setAppState(prev => ({
          ...prev,
          state: 'LOCKED',
          lockTx: '5K3d8uWkQzY7sM2pL9vX4nB1cR6tE9jH2wP5qS8mN3yA' as any,
        }));
      } else {
        setAppState(prev => ({ ...prev, state: 'ERROR', error: data.error }));
      }
    } catch (err: any) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: err.message }));
    }
  };

  const triggerPayment = async () => {
    if (appState.state !== 'LOCKED' || !orderRefId) return;
    setAppState(prev => ({ ...prev, state: 'PAYING' }));
    addLog('send', 'banksim.webhook');

    try {
      // MOCKED PAY
      await new Promise(r => setTimeout(r, 1500));
      const result: any = { ok: true, evidenceHash: '0xmockedevidencehash123', txHash: '0xmockedtxhash456' };

      if (result.ok) {
        addLog('recv', 'zkTLS.attested (Groth16 / Ed25519 proof verified)');
        addLog('recv', '0g.storage.pinned (CID: bafybei...)');
        addLog('recv', 'solana.program.release_escrow (PDA Signer -> Buyer ATA)');

        // MOCKED: API CALL COMMENTED OUT
        // fetch(`/api/orders/${orderRefId}/proof`, { ... });

        setAppState(prev => ({
          ...prev,
          state: 'RELEASED',
          releaseTx: '4rX8uJ2mN9pQ7vL3kS1wY6tC5bF0hE8jA4dZ2xV9mN7pQ',
          evidenceRootHash: '0x0g98234ea72314f8281358d834918e78a4623719b384214',
        }));
      } else {
        setAppState(prev => ({ ...prev, state: 'ERROR', error: result.error }));
      }
    } catch (err: any) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: err.message }));
    }
  };

  const reset = () => setAppState({ state: 'INIT', quotes: [] });
  const isProcessing = ['BROADCASTING', 'QUOTING', 'COMMITTING', 'PAYING'].includes(appState.state);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <GridOverlay />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/[0.03] rounded-full blur-[100px]" />
      </div>

      <header className="relative z-50 border-b border-foreground/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-14 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-xl tracking-tight">BEANSTICK</Link>
            <span className="w-px h-4 bg-foreground/20" />
            <span className="text-xs font-mono text-muted-foreground">P2P Swap</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/lp/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              LP Portal
            </Link>
            <Link href="/wallets" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Wallets
            </Link>
            <WalletSwitcher />
            {isConnected && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-8 h-8 border border-foreground/10 hover:border-foreground/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                title="Create new wallet"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {!isConnected ? (
        <main className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="text-center max-w-xl">
            <span className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Agentic Settlement
            </span>
            <h1 className={`text-4xl lg:text-6xl font-display leading-[0.9] tracking-tight mb-6 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <BlurReveal delay={0}>Fiat</BlurReveal>{' '}
              <span className="text-muted-foreground">→</span>{' '}
              <BlurReveal delay={150}>Crypto</BlurReveal>
            </h1>
            <p className={`text-base text-muted-foreground mb-8 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
              Connect your wallet to spawn AI agents that negotiate and settle swaps autonomously.
            </p>
            <WalletSwitcher />
          </div>
        </main>
      ) : (
        <main className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
                <span className="w-6 h-px bg-foreground/30" />
                Trade Terminal
              </span>
              <h1 className={`text-3xl lg:text-4xl font-display leading-[0.95] tracking-tight transition-all duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                Swap <span className="text-muted-foreground">fiat.</span>
              </h1>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5">
              <AnimatePresence mode="wait">
                {appState.state === 'INIT' && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                  >
                    <SwapForm
                      intent={intent}
                      setIntent={setIntent}
                      onSubmit={startOrder}
                      disabled={isProcessing}
                      agentStatus={agentStatus}
                    />
                  </motion.div>
                )}

                {appState.state === 'SELECTING' && appState.quotes.length > 0 && (
                  <motion.div
                    key="quotes"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">02</span>
                        <h2 className="text-lg font-display">Select Quote</h2>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">{appState.quotes.length} available</span>
                    </div>
                    {appState.quotes.map((q, i) => (
                      <QuoteCard
                        key={q.quoteId}
                        quote={q}
                        index={i}
                        intent={intent}
                        onSelect={() => selectQuote(q, i)}
                        selected={appState.selectedQuote?.quoteId === q.quoteId}
                      />
                    ))}
                    <button onClick={reset} className="w-full text-xs font-mono text-muted-foreground hover:text-foreground py-2 border border-foreground/10 hover:border-foreground/20 transition-colors">
                      Cancel
                    </button>
                  </motion.div>
                )}

                {appState.state === 'LOCKED' && appState.selectedQuote && (
                  <motion.div
                    key="locked"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-foreground/10 bg-white shadow-sm border-black/5 backdrop-blur-sm"
                  >
                    <div className="p-5 text-center border-b border-foreground/10">
                      <div className="w-14 h-14 mx-auto border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mb-4">
                        <Shield className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground">03</span>
                        <h3 className="text-xl font-display">Escrow Locked</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {appState.selectedQuote.outputAmount} {intent.toCcy} secured
                      </p>
                    </div>

                    {appState.fiatDetails && (
                      <div className="p-5 space-y-4">
                        <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Payment</div>

                        {appState.fiatDetails.qrPayload && (
                          <div className="bg-white p-3 mx-auto w-fit">
                            <QRCodeSVG
                              value={appState.fiatDetails.qrPayload}
                              size={100}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="border border-foreground/10 p-3">
                            <div className="text-[10px] font-mono text-muted-foreground mb-1">Send to</div>
                            <div className="flex items-center justify-between">
                              <code className="text-xs font-mono text-foreground">{appState.fiatDetails.paymentId}</code>
                              <button
                                onClick={() => navigator.clipboard.writeText(appState.fiatDetails!.paymentId)}
                                className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="border border-foreground/10 p-3">
                            <div className="text-[10px] font-mono text-muted-foreground mb-1">Reference</div>
                            <div className="flex items-center justify-between">
                              <code className="text-xs font-mono text-foreground truncate max-w-[180px]">{appState.fiatDetails.reference}</code>
                              <button
                                onClick={() => navigator.clipboard.writeText(appState.fiatDetails!.reference)}
                                className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 shrink-0 ml-2"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="border border-foreground/10 p-3">
                            <div className="text-[10px] font-mono text-muted-foreground mb-1">Amount</div>
                            <div className="text-lg font-display">{intent.amount} {intent.fromCcy}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-5 pt-0">
                      <motion.button
                        onClick={triggerPayment}
                        className="w-full bg-foreground text-background font-mono text-xs tracking-wider uppercase py-3"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        I've Paid {intent.amount} {intent.fromCcy}
                      </motion.button>
                      <p className="text-[10px] font-mono text-muted-foreground text-center mt-2">
                        Click after payment via {appState.fiatDetails?.railType || intent.rail}
                      </p>
                    </div>
                  </motion.div>
                )}

                {appState.state === 'RELEASED' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="border border-emerald-500/30 bg-emerald-500/5 text-center p-8"
                  >
                    <div className="w-14 h-14 mx-auto border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-display mb-2">Complete</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {appState.selectedQuote?.outputAmount} {intent.toCcy} released
                    </p>
                    <button onClick={reset} className="px-6 py-2 border border-foreground/20 hover:border-foreground/40 font-mono text-xs tracking-wider uppercase transition-colors">
                      New Swap
                    </button>
                  </motion.div>
                )}

                {appState.state === 'ERROR' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border border-red-500/30 bg-red-500/5 text-center p-8"
                  >
                    <div className="w-14 h-14 mx-auto border border-red-500/30 bg-red-500/10 flex items-center justify-center mb-4">
                      <XCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-xl font-display mb-2">Error</h3>
                    <p className="text-xs text-red-400 font-mono mb-6">{appState.error}</p>
                    <button onClick={reset} className="px-6 py-2 border border-foreground/20 hover:border-foreground/40 font-mono text-xs tracking-wider uppercase transition-colors">
                      Try Again
                    </button>
                  </motion.div>
                )}

                {isProcessing && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border border-foreground/10 bg-white shadow-sm border-black/5 backdrop-blur-sm p-8 text-center"
                  >
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
                    <p className="text-lg font-display">
                      {appState.state === 'BROADCASTING' && 'Broadcasting RFQ...'}
                      {appState.state === 'QUOTING' && 'Awaiting quotes...'}
                      {appState.state === 'COMMITTING' && 'Locking escrow...'}
                      {appState.state === 'PAYING' && 'Processing payment...'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <AgentCards agentStatus={agentStatus} currentPhase={currentPhase} />

              <div className="grid md:grid-cols-2 gap-4">
                <OrderProgress
                  state={appState.state}
                  intent={intent}
                  selectedQuote={appState.selectedQuote}
                />
                <AgentActivityLog events={axlLog} />
              </div>

              <TransactionLinks
                lockTx={appState.lockTx}
                releaseTx={appState.releaseTx}
                evidenceHash={appState.evidenceRootHash}
              />

              {orderRefId && ['LOCKED', 'PAYING', 'RELEASED'].includes(appState.state) && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <ProofTimeline
                    orderId={orderRefId}
                    onPhaseChange={setCurrentPhase}
                    overridePhase={
                      appState.state === 'RELEASED'
                        ? 'RELEASED'
                        : appState.state === 'PAYING'
                        ? 'PROOF_GENERATED'
                        : appState.state === 'LOCKED'
                        ? 'AWAITING_PAYMENT'
                        : 'AWAITING_LOCK'
                    }
                  />
                </motion.div>
              )}
            </div>
          </div>
        </main>
      )}

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
