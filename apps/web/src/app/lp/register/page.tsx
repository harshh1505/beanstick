'use client';

// app/lp/register/page.tsx
//
// LP Registration Page (G.12.1)

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { motion } from 'framer-motion';
import { Wallet, CheckCircle, ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';

export default function LpRegisterPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [axlPubkey, setAxlPubkey] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!address) return;

    setIsRegistering(true);
    setError(null);

    try {
      const res = await fetch('/api/lp/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          axlPubkey: axlPubkey || `mock-axl-${address.slice(0, 8)}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setRegistered(true);
        } else {
          throw new Error(data.error || 'Registration failed');
        }
      } else {
        setRegistered(true);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Become a Liquidity Provider</h1>
            <p className="text-zinc-400">
              Register to provide fiat-to-crypto liquidity on Beanstick
            </p>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center">
                <span className="text-blue-400 font-bold">1</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Connect Wallet</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  Connect your wallet to register as an LP
                </p>

                {isConnected ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                      <Wallet className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-mono">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </span>
                    </div>
                    <button
                      onClick={() => disconnect()}
                      className="text-sm text-zinc-400 hover:text-white"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => connect({ connector: injected() })}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center">
                <span className="text-blue-400 font-bold">2</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">AXL Public Key (Optional)</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  Your AXL node public key for peer-to-peer communication
                </p>
                <input
                  type="text"
                  value={axlPubkey}
                  onChange={(e) => setAxlPubkey(e.target.value)}
                  placeholder="64-character hex (optional)"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center">
                <span className="text-blue-400 font-bold">3</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Register as LP</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  Create your LP profile on the Beanstick network
                </p>

                {registered ? (
                  <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-green-400 font-medium">Registered!</p>
                      <p className="text-sm text-zinc-400">
                        Now set up your payment rails
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleRegister}
                    disabled={!isConnected || isRegistering}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg flex items-center gap-2"
                  >
                    {isRegistering ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Register
                      </>
                    )}
                  </button>
                )}

                {error && (
                  <p className="mt-2 text-sm text-red-400">{error}</p>
                )}
              </div>
            </div>
          </div>

          {registered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <Link
                href="/lp/rails"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                Set Up Payment Rails
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}

          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">
              What happens next?
            </h4>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Register your fiat payment rails (UPI, Venmo, etc.)</li>
              <li>• Deposit crypto inventory for settlement</li>
              <li>• Start receiving quote requests from buyers</li>
              <li>• Earn fees on successful settlements</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
