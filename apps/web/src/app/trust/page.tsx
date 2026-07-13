'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Activity, CheckCircle2 } from 'lucide-react';
import { Navigation } from '@/components/landing/navigation';

export default function TrustDashboard() {
  const [providers, setProviders] = useState<any[]>([]);
  const [fraudRisks, setFraudRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [provRes, fraudRes] = await Promise.all([
          fetch('/api/trust/providers'),
          fetch('/api/trust/fraud')
        ]);
        
        const provData = await provRes.json();
        const fraudData = await fraudRes.json();
        
        if (provData.providers) setProviders(provData.providers);
        if (fraudData.highRiskEntities) setFraudRisks(fraudData.highRiskEntities);
      } catch (err) {
        console.error('Failed to load trust data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-emerald-500/30">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-400" />
            AuraDB Graph Intelligence
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl">
            Beanstick uses AuraDB as its production trust infrastructure to continuously monitor settlement reliability, track multi-hop liquidity provider reputation, and detect circular trading fraud.
          </p>
        </div>

        {/* Network Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <p className="text-sm text-zinc-500 mb-1 font-medium">Total Users</p>
            <p className="text-3xl font-bold">14,239</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <p className="text-sm text-zinc-500 mb-1 font-medium">Verified LPs</p>
            <p className="text-3xl font-bold">{providers.length}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <p className="text-sm text-zinc-500 mb-1 font-medium">Total Settlements</p>
            <p className="text-3xl font-bold">{providers.reduce((acc, p) => acc + p.settlementCount, 0).toLocaleString()}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <p className="text-sm text-zinc-500 mb-1 font-medium">Avg Network Trust</p>
            <p className="text-3xl font-bold text-emerald-400">92.4</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-emerald-400/50">
            <Activity className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Top Liquidity Providers */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Trusted Network (Top Providers)
              </h2>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">LP Wallet</th>
                        <th className="px-4 py-3 font-medium text-right">Trust Score</th>
                        <th className="px-4 py-3 font-medium text-right">Success Rate</th>
                        <th className="px-4 py-3 font-medium text-right">Settlements</th>
                        <th className="px-4 py-3 font-medium text-right">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {providers.map((p, i) => (
                        <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-zinc-300">
                            {p.wallet.slice(0,6)}...{p.wallet.slice(-4)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-400/10 text-emerald-400 font-medium">
                              {p.trustScore.toFixed(0)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-300">
                            {p.successRate.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-300">
                            {p.settlementCount}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-300">
                            ${p.volume.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {providers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                            No provider data found in graph.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Fraud Insights */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                Fraud Insights
              </h2>
              <div className="space-y-4">
                {fraudRisks.map((risk, i) => (
                  <div key={i} className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-sm text-zinc-300">
                        {risk.wallet.slice(0,6)}...{risk.wallet.slice(-4)}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 bg-rose-500/20 text-rose-400 rounded-md">
                        Risk: {risk.riskScore}
                      </span>
                    </div>
                    <ul className="text-sm text-rose-200/70 space-y-1 list-disc list-inside">
                      {risk.reasons.map((r: string, j: number) => (
                        <li key={j}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {fraudRisks.length === 0 && (
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center backdrop-blur-sm">
                    <Shield className="w-8 h-8 text-emerald-400/50 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">No high-risk entities detected.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
