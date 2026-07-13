import { Navbar } from '@/components/Navbar';
import { ArrowRight, Globe, Shield, Zap } from 'lucide-react';
import Link from 'next/link';

export default function NetworkPage() {
  return (
    <main className="flex flex-col bg-[#F5F5F5] min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <section className="px-6 pt-40 pb-20 max-w-[88rem] mx-auto w-full">
        <div className="max-w-3xl">
          <h1 className="text-black text-6xl md:text-7xl font-medium leading-tight mb-6" style={{ letterSpacing: '-0.04em' }}>
            The Beanstick<br />Network
          </h1>
          <p className="text-black/60 text-xl leading-relaxed mb-10">
            A decentralized swarm of autonomous agents coordinating secure fiat-to-crypto settlements across the globe, powered by zero-knowledge proofs and the 0G blockchain.
          </p>
          <div className="flex gap-4">
            <Link href="/p2p" className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-black/90 transition-all flex items-center gap-2">
              Explore Nodes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-20 bg-white border-y border-black/5">
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="text-5xl font-medium text-black mb-2 tracking-tight">2.4M+</div>
            <div className="text-black/60">Settlements Processed</div>
          </div>
          <div>
            <div className="text-5xl font-medium text-black mb-2 tracking-tight">$840M</div>
            <div className="text-black/60">Total Value Locked</div>
          </div>
          <div>
            <div className="text-5xl font-medium text-black mb-2 tracking-tight">150ms</div>
            <div className="text-black/60">Average Proof Generation</div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-24 max-w-[88rem] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5">
            <div className="w-12 h-12 bg-[#F9F9F9] rounded-2xl flex items-center justify-center mb-6">
              <Globe className="w-6 h-6 text-black" />
            </div>
            <h3 className="text-2xl font-medium mb-3">Global Swarm</h3>
            <p className="text-black/60 leading-relaxed">
              Thousands of independent Liquidity Provider agents operate 24/7, competing to offer you the best settlement rates across 40+ fiat currencies.
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5">
            <div className="w-12 h-12 bg-[#F9F9F9] rounded-2xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-black" />
            </div>
            <h3 className="text-2xl font-medium mb-3">zkTLS Verification</h3>
            <p className="text-black/60 leading-relaxed">
              Every fiat transaction is cryptographically verified directly from bank servers using zkTLS, ensuring completely trustless and private escrow releases.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/5">
            <div className="w-12 h-12 bg-[#F9F9F9] rounded-2xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <h3 className="text-2xl font-medium mb-3">0G Data Availability</h3>
            <p className="text-black/60 leading-relaxed">
              High-throughput cryptographic proofs are anchored to the 0G blockchain, providing infinite scalability without congesting primary Layer 1 networks.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
