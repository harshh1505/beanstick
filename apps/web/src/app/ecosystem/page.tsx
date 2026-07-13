import { Navbar } from '@/components/Navbar';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function EcosystemPage() {
  return (
    <main className="flex flex-col bg-[#F5F5F5] min-h-screen">
      <Navbar />
      
      <section className="px-6 pt-40 pb-20 max-w-[88rem] mx-auto w-full">
        <div className="max-w-3xl">
          <div className="text-black/60 text-sm font-mono tracking-widest uppercase mb-4">Ecosystem</div>
          <h1 className="text-black text-6xl md:text-7xl font-medium leading-tight mb-6" style={{ letterSpacing: '-0.04em' }}>
            Built for Builders
          </h1>
          <p className="text-black/60 text-xl leading-relaxed mb-10">
            Beanstick seamlessly integrates with the world's leading DeFi protocols, wallets, and institutional platforms to power the next generation of financial applications.
          </p>
          <div className="flex gap-4">
            <Link href="#" className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-black/90 transition-all">
              Read the Docs
            </Link>
            <Link href="#" className="bg-white border border-black/10 text-black px-8 py-3 rounded-full font-medium hover:bg-[#F9F9F9] transition-all">
              Get API Keys
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 max-w-[88rem] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['DeFi Protocols', 'Wallets', 'Institutions', 'Merchants'].map((category) => (
            <div key={category} className="bg-white p-6 rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <h3 className="text-lg font-medium mb-2">{category}</h3>
              <p className="text-black/60 text-sm">Plug into the swarm to offer instant native settlements to your users.</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-24 max-w-[88rem] mx-auto w-full">
        <div className="bg-[#2B2644] rounded-3xl p-12 md:p-20 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="max-w-xl">
            <h2 className="text-white text-4xl font-medium mb-4" style={{ letterSpacing: '-0.02em' }}>Ready to integrate?</h2>
            <p className="text-white/60 text-lg">Add our SDK to your React or Next.js app with three lines of code and instantly support 40+ fiat currencies.</p>
          </div>
          <div className="w-full max-w-md bg-black/50 p-6 rounded-2xl border border-white/10 font-mono text-sm text-emerald-400 overflow-x-auto">
            <code>
              npm install @beanstick/react<br/><br/>
              import {'{'} BeanstickProvider {'}'} from '@beanstick/react';<br/><br/>
              &lt;BeanstickProvider apiKey="YOUR_KEY"&gt;<br/>
              &nbsp;&nbsp;&lt;App /&gt;<br/>
              &lt;/BeanstickProvider&gt;
            </code>
          </div>
        </div>
      </section>
    </main>
  );
}
