'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Settings,
  ArrowRight,
  Activity,
  Zap,
  Plus,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface LpProfile {
  walletAddress: string;
  axlPubkey: string;
  registeredAt: number;
  active: boolean;
  reputation: {
    score: number;
    totalTrades: number;
    completionRate: number;
    averageSettleTimeSeconds: number;
    slashCount: number;
  };
}

interface RailRegistration {
  id: string;
  railType: string;
  receiverLabel: string;
  ownershipVerificationStatus: string;
}

function GridOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.06]">
      {[...Array(6)].map((_, i) => (
        <div
          key={`h-${i}`}
          className="absolute h-px bg-white/40"
          style={{ top: `${16.66 * (i + 1)}%`, left: 0, right: 0 }}
        />
      ))}
      {[...Array(8)].map((_, i) => (
        <div
          key={`v-${i}`}
          className="absolute w-px bg-white/40"
          style={{ left: `${12.5 * (i + 1)}%`, top: 0, bottom: 0 }}
        />
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
    cyan: 'from-cyan-500/20 to-blue-500/20 text-cyan-400',
    amber: 'from-amber-500/20 to-yellow-500/20 text-amber-400',
    red: 'from-red-500/20 to-orange-500/20 text-red-400',
  };

  return (
    <div className="border border-foreground/10 bg-black/40 backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 bg-gradient-to-br ${colorMap[color]} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">{label}</span>
      </div>
      <div className="text-2xl font-display">{value}</div>
    </div>
  );
}

export default function LpDashboardPage() {
  const { address } = useAccount();
  const [profile, setProfile] = useState<LpProfile | null>(null);
  const [rails, setRails] = useState<RailRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (address) {
      fetchData();
    }
  }, [address]);

  async function fetchData() {
    try {
      const [profileRes, railsRes] = await Promise.all([
        fetch(`/api/lp/register?walletAddress=${address}`),
        fetch(`/api/lp/rails?lpId=${address}`),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData.profile);
      }

      if (railsRes.ok) {
        const railsData = await railsRes.json();
        setRails(railsData.rails || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!address) {
    return (
      <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
        <GridOverlay />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/[0.03] rounded-full blur-[100px]" />
        </div>

        <header className="relative z-50 border-b border-foreground/10">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-14 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-display text-xl tracking-tight">BEANSTICK</Link>
              <span className="w-px h-4 bg-foreground/20" />
              <span className="text-xs font-mono text-muted-foreground">LP Dashboard</span>
            </div>
          </div>
        </header>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="text-center max-w-md">
            <span className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground mb-4">
              <span className="w-6 h-px bg-foreground/30" />
              Liquidity Provider
            </span>
            <h1 className="text-3xl font-display mb-4">Connect Wallet</h1>
            <p className="text-sm text-muted-foreground mb-6">Connect your wallet to view your LP dashboard</p>
            <Link
              href="/lp/register"
              className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Register as LP <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
        <GridOverlay />
        <header className="relative z-50 border-b border-foreground/10">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-14 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-display text-xl tracking-tight">BEANSTICK</Link>
              <span className="w-px h-4 bg-foreground/20" />
              <span className="text-xs font-mono text-muted-foreground">LP Dashboard</span>
            </div>
          </div>
        </header>

        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-foreground/5 w-1/4" />
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-foreground/5 border border-foreground/5" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
        <GridOverlay />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/[0.03] rounded-full blur-[100px]" />
        </div>

        <header className="relative z-50 border-b border-foreground/10">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-14 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-display text-xl tracking-tight">BEANSTICK</Link>
              <span className="w-px h-4 bg-foreground/20" />
              <span className="text-xs font-mono text-muted-foreground">LP Dashboard</span>
            </div>
          </div>
        </header>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 mx-auto border border-foreground/10 bg-foreground/5 flex items-center justify-center mb-6">
              <Activity className="w-6 h-6 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-display mb-3">Not Registered</h1>
            <p className="text-sm text-muted-foreground mb-6">You need to register as an LP to access this dashboard</p>
            <Link
              href="/lp/register"
              className="inline-flex items-center gap-2 bg-foreground text-background font-mono text-xs tracking-wider uppercase px-6 py-3"
            >
              Register Now <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const verifiedRails = rails.filter((r) => r.ownershipVerificationStatus === 'verified').length;

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <GridOverlay />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/[0.02] rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/[0.02] rounded-full blur-[80px]" />
      </div>

      <header className="relative z-50 border-b border-foreground/10">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 h-14 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-xl tracking-tight">BEANSTICK</Link>
            <span className="w-px h-4 bg-foreground/20" />
            <span className="text-xs font-mono text-muted-foreground">LP Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/p2p" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              P2P Swap
            </Link>
            <Link
              href="/lp/rails"
              className="flex items-center gap-2 px-3 py-1.5 border border-foreground/10 hover:border-foreground/20 text-xs font-mono transition-colors"
            >
              <Settings className="w-3 h-3" />
              Rails
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-12 py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
                <span className="w-6 h-px bg-foreground/30" />
                Liquidity Provider
              </span>
              <h1 className={`text-3xl font-display leading-[0.95] tracking-tight transition-all duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <code className="text-xs font-mono text-muted-foreground">
                {address.slice(0, 6)}...{address.slice(-4)}
              </code>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={TrendingUp}
              label="Reputation"
              value={profile.reputation.score}
              color="emerald"
            />
            <StatCard
              icon={CheckCircle}
              label="Total Trades"
              value={profile.reputation.totalTrades}
              color="cyan"
            />
            <StatCard
              icon={Clock}
              label="Avg Settle"
              value={profile.reputation.averageSettleTimeSeconds > 0 ? `${Math.round(profile.reputation.averageSettleTimeSeconds / 60)}m` : '-'}
              color="amber"
            />
            <StatCard
              icon={AlertTriangle}
              label="Slashes"
              value={profile.reputation.slashCount}
              color="red"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 border border-foreground/10 bg-black/40 backdrop-blur-sm">
              <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-2">
                  <CreditCard className="w-2.5 h-2.5" />
                  Payment Rails
                </span>
                <Link href="/lp/rails" className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                  View All <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              </div>

              {rails.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 mx-auto border border-foreground/10 bg-foreground/5 flex items-center justify-center mb-4">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">No payment rails configured</p>
                  <Link
                    href="/lp/rails"
                    className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 hover:text-emerald-300"
                  >
                    <Plus className="w-3 h-3" />
                    Add your first rail
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-foreground/5">
                  {rails.slice(0, 4).map((rail, i) => (
                    <motion.div
                      key={rail.id}
                      className="flex items-center justify-between p-4 hover:bg-foreground/[0.02] transition-colors"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border border-foreground/10 bg-foreground/5 flex items-center justify-center">
                          <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="text-sm font-mono">{rail.receiverLabel}</div>
                          <div className="text-[10px] text-muted-foreground">{rail.railType}</div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-1 border ${
                          rail.ownershipVerificationStatus === 'verified'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {rail.ownershipVerificationStatus}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-foreground/10 bg-black/40 backdrop-blur-sm">
              <div className="px-4 py-3 border-b border-foreground/10">
                <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-2">
                  <Zap className="w-2.5 h-2.5" />
                  Quick Actions
                </span>
              </div>

              <div className="p-3 space-y-2">
                <Link
                  href="/p2p"
                  className="block p-3 border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-mono">View Orders</div>
                      <div className="text-[10px] text-muted-foreground">Check pending orders</div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
                  </div>
                </Link>

                <Link
                  href="/lp/rails"
                  className="block p-3 border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-mono">Add Rail</div>
                      <div className="text-[10px] text-muted-foreground">Register payment rail</div>
                    </div>
                    <Plus className="w-3 h-3 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
                  </div>
                </Link>

                <button
                  className="w-full p-3 border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all group text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-mono">Deposit Crypto</div>
                      <div className="text-[10px] text-muted-foreground">Add to inventory</div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="border border-foreground/10 bg-black/40 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-mono">Agent Status</div>
                  <div className="text-[10px] text-muted-foreground">AXL Pubkey: {profile.axlPubkey?.slice(0, 16)}...</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-1 border ${profile.active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                  {profile.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
