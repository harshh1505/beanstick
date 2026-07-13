'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Plus,
  Check,
  X,
  QrCode,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

type RailType = 'banksim' | 'upi' | 'venmo' | 'revolut';

interface RailRegistration {
  id: string;
  railType: RailType;
  receiverLabel: string;
  beneficiaryName: string;
  receiverCommitment: string;
  qrCommitment?: string;
  currency: string;
  minAmount: string;
  maxAmount: string;
  reversibilityClass: string;
  ownershipVerificationStatus: 'pending' | 'verified' | 'failed';
  createdAt: number;
}

const RAIL_INFO: Record<RailType, { name: string; icon: string; description: string }> = {
  banksim: { name: 'BankSim', icon: '🏦', description: 'Demo rail for testing' },
  upi: { name: 'UPI', icon: '🇮🇳', description: 'Unified Payments Interface' },
  venmo: { name: 'Venmo', icon: '💸', description: 'Venmo P2P payments' },
  revolut: { name: 'Revolut', icon: '🔄', description: 'Revolut transfers' },
};

function GridOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.06]">
      {[...Array(6)].map((_, i) => (
        <div key={`h-${i}`} className="absolute h-px bg-white/40" style={{ top: `${16.66 * (i + 1)}%`, left: 0, right: 0 }} />
      ))}
      {[...Array(8)].map((_, i) => (
        <div key={`v-${i}`} className="absolute w-px bg-white/40" style={{ left: `${12.5 * (i + 1)}%`, top: 0, bottom: 0 }} />
      ))}
    </div>
  );
}

export default function LpRailsPage() {
  const { address } = useAccount();
  const [rails, setRails] = useState<RailRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRail, setSelectedRail] = useState<RailType>('banksim');
  const [isVisible, setIsVisible] = useState(false);

  const [formData, setFormData] = useState({
    receiverLabel: '',
    beneficiaryName: '',
    account: '',
    vpa: '',
    handle: '',
    tag: '',
    qrPayload: '',
    currency: 'USD',
    minAmount: '1',
    maxAmount: '10000',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (address) fetchRails();
  }, [address]);

  async function fetchRails() {
    try {
      const res = await fetch(`/api/lp/rails?lpId=${address}`);
      const data = await res.json();
      setRails(data.rails || []);
    } catch (err) {
      console.error('Failed to fetch rails:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRail() {
    if (!address) return;
    setSubmitting(true);
    setError(null);

    try {
      const receiverPayload: Record<string, string> = {};
      switch (selectedRail) {
        case 'banksim': receiverPayload.account = formData.account; break;
        case 'upi': receiverPayload.vpa = formData.vpa; break;
        case 'venmo': receiverPayload.handle = formData.handle; break;
        case 'revolut': receiverPayload.tag = formData.tag; break;
      }

      const res = await fetch('/api/lp/rails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lpId: address,
          railType: selectedRail,
          receiverLabel: formData.receiverLabel,
          beneficiaryName: formData.beneficiaryName,
          receiverPayload,
          qrPayload: formData.qrPayload || undefined,
          currency: formData.currency,
          minAmount: formData.minAmount,
          maxAmount: formData.maxAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add rail');

      setRails([...rails, data.registration]);
      setShowAddForm(false);
      setFormData({
        receiverLabel: '', beneficiaryName: '', account: '', vpa: '', handle: '', tag: '',
        qrPayload: '', currency: 'USD', minAmount: '1', maxAmount: '10000',
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRail(id: string) {
    if (!confirm('Delete this rail registration?')) return;
    try {
      const res = await fetch(`/api/lp/rails?id=${id}`, { method: 'DELETE' });
      if (res.ok) setRails(rails.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete rail:', err);
    }
  }

  async function handleVerifyRail(id: string) {
    try {
      const res = await fetch('/api/lp/rails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'verified' }),
      });
      if (res.ok) {
        setRails(rails.map((r) => r.id === id ? { ...r, ownershipVerificationStatus: 'verified' as const } : r));
      }
    } catch (err) {
      console.error('Failed to verify rail:', err);
    }
  }

  if (!address) {
    return (
      <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
        <GridOverlay />
        <header className="relative z-50 border-b border-foreground/10">
          <div className="max-w-[1000px] mx-auto px-6 lg:px-12 h-14 flex items-center gap-4">
            <Link href="/" className="font-display text-xl tracking-tight">BEANSTICK</Link>
            <span className="w-px h-4 bg-foreground/20" />
            <span className="text-xs font-mono text-muted-foreground">Payment Rails</span>
          </div>
        </header>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-display mb-3">Connect Wallet</h1>
            <p className="text-sm text-muted-foreground mb-4">Connect your wallet to manage payment rails</p>
            <Link href="/lp/register" className="text-xs font-mono text-emerald-400 hover:text-emerald-300">
              Go to LP Registration →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <GridOverlay />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <header className="relative z-50 border-b border-foreground/10">
        <div className="max-w-[1000px] mx-auto px-6 lg:px-12 h-14 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-xl tracking-tight">BEANSTICK</Link>
            <span className="w-px h-4 bg-foreground/20" />
            <span className="text-xs font-mono text-muted-foreground">Payment Rails</span>
          </div>
          <Link href="/lp/dashboard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Dashboard
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-[1000px] mx-auto px-6 lg:px-12 py-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
              <span className="w-6 h-px bg-foreground/30" />
              Fiat Receiving
            </span>
            <h1 className={`text-3xl font-display leading-[0.95] tracking-tight transition-all duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
              Payment <span className="text-muted-foreground">Rails</span>
            </h1>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-foreground text-background font-mono text-xs tracking-wider uppercase px-4 py-2"
          >
            <Plus className="w-3 h-3" />
            Add Rail
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-foreground/5 border border-foreground/5 animate-pulse" />
            ))}
          </div>
        ) : rails.length === 0 ? (
          <div className="border border-foreground/10 bg-black/40 p-12 text-center">
            <div className="w-14 h-14 mx-auto border border-foreground/10 bg-foreground/5 flex items-center justify-center mb-4">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">No payment rails registered</p>
            <button onClick={() => setShowAddForm(true)} className="text-xs font-mono text-emerald-400 hover:text-emerald-300">
              <Plus className="w-3 h-3 inline mr-1" />
              Add your first rail
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rails.map((rail, i) => (
              <motion.div
                key={rail.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border border-foreground/10 bg-black/40 backdrop-blur-sm"
              >
                <div className="p-4 flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 border border-foreground/10 bg-foreground/5 flex items-center justify-center text-xl">
                      {RAIL_INFO[rail.railType]?.icon || '💳'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-mono">{rail.receiverLabel}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 border border-foreground/10 bg-foreground/5 text-muted-foreground">
                          {RAIL_INFO[rail.railType]?.name || rail.railType}
                        </span>
                        {rail.ownershipVerificationStatus === 'verified' ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Verified
                          </span>
                        ) : rail.ownershipVerificationStatus === 'pending' ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Pending
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Failed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{rail.beneficiaryName}</p>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-foreground/40">
                        <span>{rail.currency} {rail.minAmount}–{rail.maxAmount}</span>
                        <span className="text-foreground/20">|</span>
                        <span>{rail.receiverCommitment.slice(0, 12)}...</span>
                        {rail.qrCommitment && (
                          <>
                            <span className="text-foreground/20">|</span>
                            <span className="flex items-center gap-1"><QrCode className="w-2.5 h-2.5" /> QR</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {rail.ownershipVerificationStatus === 'pending' && (
                      <button
                        onClick={() => handleVerifyRail(rail.id)}
                        className="w-7 h-7 border border-foreground/10 hover:border-emerald-500/30 hover:bg-emerald-500/10 flex items-center justify-center text-emerald-400 transition-colors"
                        title="Mark as verified"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteRail(rail.id)}
                      className="w-7 h-7 border border-foreground/10 hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              className="bg-background border border-foreground/10 max-w-lg w-full max-h-[85vh] overflow-y-auto"
            >
              <div className="px-5 py-4 border-b border-foreground/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground">NEW</span>
                  <h2 className="text-lg font-display">Add Payment Rail</h2>
                </div>
                <button onClick={() => setShowAddForm(false)} className="w-8 h-8 border border-foreground/10 hover:border-foreground/20 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Rail Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(RAIL_INFO) as RailType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedRail(type)}
                        className={`p-3 border text-left transition-colors ${
                          selectedRail === type
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-foreground/10 hover:border-foreground/20'
                        }`}
                      >
                        <span className="text-lg mr-2">{RAIL_INFO[type].icon}</span>
                        <span className="text-xs font-mono">{RAIL_INFO[type].name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Label</label>
                  <input
                    type="text"
                    value={formData.receiverLabel}
                    onChange={(e) => setFormData({ ...formData, receiverLabel: e.target.value })}
                    placeholder="e.g., Primary UPI"
                    className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Beneficiary Name</label>
                  <input
                    type="text"
                    value={formData.beneficiaryName}
                    onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })}
                    placeholder="Your name"
                    className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                  />
                </div>

                {selectedRail === 'banksim' && (
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Account ID</label>
                    <input
                      type="text"
                      value={formData.account}
                      onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                      placeholder="e.g., lp@banksim"
                      className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                    />
                  </div>
                )}

                {selectedRail === 'upi' && (
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">UPI VPA</label>
                    <input
                      type="text"
                      value={formData.vpa}
                      onChange={(e) => setFormData({ ...formData, vpa: e.target.value })}
                      placeholder="e.g., username@upi"
                      className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                    />
                  </div>
                )}

                {selectedRail === 'venmo' && (
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Venmo Handle</label>
                    <input
                      type="text"
                      value={formData.handle}
                      onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
                      placeholder="e.g., @username"
                      className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                    />
                  </div>
                )}

                {selectedRail === 'revolut' && (
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Revolut Tag</label>
                    <input
                      type="text"
                      value={formData.tag}
                      onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                      placeholder="e.g., @username"
                      className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">QR Code Data (Optional)</label>
                  <textarea
                    value={formData.qrPayload}
                    onChange={(e) => setFormData({ ...formData, qrPayload: e.target.value })}
                    placeholder="Paste QR code string..."
                    className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono h-16 resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                    >
                      <option value="USD">USD</option>
                      <option value="INR">INR</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Min</label>
                    <input
                      type="text"
                      value={formData.minAmount}
                      onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Max</label>
                    <input
                      type="text"
                      value={formData.maxAmount}
                      onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-foreground/10 focus:border-foreground/30 outline-none text-sm font-mono"
                    />
                  </div>
                </div>

                {error && <p className="text-xs font-mono text-red-400">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddRail}
                    disabled={submitting || !formData.receiverLabel || !formData.beneficiaryName}
                    className="px-4 py-2 bg-foreground text-background font-mono text-xs tracking-wider uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Adding...' : 'Add Rail'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
