import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function Home() {
  return (
    <main className="flex flex-col bg-[#F5F5F5] min-h-screen">
      {/* Wrapper for Nav + Hero */}
      <div className="relative h-screen flex flex-col overflow-hidden">
        
        {/* 1. Navbar */}
        <Navbar />

        {/* 2. Hero Section */}
        <section className="flex-1 px-6 pt-20 pb-6 flex items-end max-w-[88rem] mx-auto w-full">
          <div className="relative w-full rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 96px)' }}>
            <video 
              autoPlay 
              muted 
              loop 
              playsInline 
              className="object-cover absolute inset-0 w-full h-full"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
            />
            
            <div className="relative z-10 flex flex-col items-start justify-start h-full p-12 pt-36">
              <h1 className="text-black text-5xl md:text-6xl font-medium leading-tight max-w-xl mb-4" style={{ letterSpacing: '-0.04em' }}>
                Your Capital<br/>Settles
              </h1>
              <p className="text-black/70 text-base md:text-lg max-w-md mb-8 leading-relaxed" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
                An automated, agent-powered fiat-crypto onramp built for native passive settlement and effortless connection into DeFi.
              </p>
              
              <Link href="/p2p" className="inline-flex items-center gap-3 bg-black text-white text-base md:text-lg font-medium pl-8 pr-2 py-2 rounded-full hover:bg-gray-800 transition-colors duration-200 group">
                Join us
                <div className="bg-white rounded-full p-2 group-hover:bg-white transition-colors duration-200">
                  <ArrowRight className="w-5 h-5 text-black" />
                </div>
              </Link>
              
              {/* Brand Marquee */}
              <div className="mt-24 w-full max-w-md overflow-hidden">
                <div className="marquee-track">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex items-center">
                      <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap" style={{ fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '15px' }}>Stripe</span>
                      <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap uppercase" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '13px' }}>Coinbase</span>
                      <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap italic" style={{ fontFamily: '"Trebuchet MS", sans-serif', fontWeight: 600, letterSpacing: '0.01em', fontSize: '15px' }}>Uniswap</span>
                      <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap uppercase" style={{ fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: '13px' }}>Aave</span>
                      <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap" style={{ fontFamily: 'Palatino, "Book Antiqua", serif', fontWeight: 400, letterSpacing: '-0.01em', fontSize: '16px' }}>Compound</span>
                      <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap" style={{ fontFamily: 'Impact, "Arial Narrow", sans-serif', fontWeight: 400, letterSpacing: '0.04em', fontSize: '14px' }}>MakerDAO</span>
                      <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 700, letterSpacing: '-0.03em', fontSize: '13px' }}>Chainlink</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Info Section */}
      <section className="bg-[#F5F5F5] px-6 py-24">
        <div className="max-w-[88rem] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 items-start">
            <div>
              <h2 className="text-black text-4xl md:text-5xl font-medium leading-tight mb-8" style={{ letterSpacing: '-0.03em' }}>
                Meet Beanstick.
              </h2>
              <Link href="/p2p" className="inline-flex items-center gap-3 bg-black text-white text-base font-medium pl-8 pr-2 py-2 rounded-full hover:bg-gray-800 transition-colors duration-200 group">
                Discover it
                <div className="bg-white rounded-full p-2 group-hover:bg-white transition-colors duration-200">
                  <ArrowRight className="w-5 h-5 text-black" />
                </div>
              </Link>
            </div>
            <div>
              <p className="text-black/70 text-2xl md:text-3xl leading-relaxed">
                Beanstick is an agentic fiat-crypto onramp that lets you securely buy tokens while remaining fully decentralized and self-custodial.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2 rounded-2xl p-7 min-h-80 flex flex-col justify-between" style={{ backgroundImage: 'url(https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260423_164207_f243351d-ed59-48ec-83a0-a5e996bdbe3c.png&w=1280&q=85)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <h3 className="text-black text-2xl font-medium leading-snug" style={{ letterSpacing: '-0.02em' }}>Settlements that bloom</h3>
              <p className="text-black/70 text-base max-w-xs">Gain steady access to liquidity as your fiat payments are routed into top-performing liquidity pools.</p>
            </div>
            
            <div className="bg-[#2B2644] rounded-2xl p-7 min-h-80 flex flex-col justify-between">
              <h3 className="text-white text-2xl font-medium whitespace-pre-line">Always fluid,\nalways pegged.</h3>
              <p className="text-white/60 text-base">Keep fully dollar-anchored with on-demand access to funds — no lockups or waits.</p>
            </div>

            <div className="bg-[#2B2644] rounded-2xl p-7 min-h-80 flex flex-col justify-between">
              <h3 className="text-white text-2xl font-medium whitespace-pre-line">Fully\nautomated</h3>
              <p className="text-white/60 text-base">Skip the task of tuning positions yourself. Beanstick runs in the background for you via agent swarms.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Backed By Section */}
      <section className="bg-[#F5F5F5] px-6 py-12">
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
          <div className="col-span-1">
            <p className="text-black/70 text-base leading-relaxed whitespace-pre-line">
              Funded by premier partners{'\n'}and forward-thinking leaders.
            </p>
          </div>
          <div className="col-span-3 overflow-hidden">
            <div className="backers-track">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center">
                  <span className="mx-10 shrink-0 text-black/50 whitespace-nowrap" style={{ fontFamily: '"Times New Roman", serif', fontWeight: 400, letterSpacing: '0.02em', fontSize: '14px' }}>Fundamental Labs</span>
                  <span className="mx-10 shrink-0 text-black/50 whitespace-nowrap uppercase" style={{ fontFamily: '"Arial Black", sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '16px' }}>KUCOIN</span>
                  <span className="mx-10 shrink-0 text-black/50 whitespace-nowrap" style={{ fontFamily: 'Impact, sans-serif', fontWeight: 700, letterSpacing: '0.05em', fontSize: '18px' }}>NGC</span>
                  <span className="mx-10 shrink-0 text-black/50 whitespace-nowrap" style={{ fontFamily: 'Georgia, serif', fontWeight: 600, letterSpacing: '-0.02em', fontSize: '17px' }}>NxGen</span>
                  <span className="mx-10 shrink-0 text-black/50 whitespace-nowrap" style={{ fontFamily: 'Helvetica, sans-serif', fontWeight: 700, letterSpacing: '-0.01em', fontSize: '15px' }}>Matter Labs</span>
                  <span className="mx-10 shrink-0 text-black/50 whitespace-nowrap uppercase" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 700, letterSpacing: '0.06em', fontSize: '14px' }}>DEXTools</span>
                  <span className="mx-10 shrink-0 text-black/50 whitespace-nowrap" style={{ fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.18em', fontSize: '14px' }}>NGRAVE</span>
                  <span className="mx-10 shrink-0 text-black/50 whitespace-nowrap" style={{ fontFamily: 'Palatino, serif', fontWeight: 500, letterSpacing: '0.03em', fontSize: '15px' }}>Polychain</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Use Cases Section */}
      <section className="bg-[#F5F5F5] px-6 py-24">
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="md:pr-12 md:pt-2">
            <div className="text-black/60 text-sm mb-2">Beanstick in Practice</div>
            <h2 className="text-5xl md:text-6xl font-medium leading-none mb-6 text-black" style={{ letterSpacing: '-0.04em' }}>Use modes</h2>
            <p className="text-black/60 text-base leading-relaxed max-w-sm">
              Beanstick powers a wide range of modes for builders, companies and treasuries wanting safe and rewarding stablecoin integrations plus more.
            </p>
          </div>
          
          <div className="relative rounded-3xl overflow-hidden min-h-[720px] w-full">
            <video 
              autoPlay 
              muted 
              loop 
              playsInline 
              className="object-cover absolute inset-0 w-full h-full"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_183428_ab5e672a-f608-4dcb-b319-f3e040f02e2d.mp4"
            />
            
            <div className="relative z-10 p-10 md:p-12 flex flex-col justify-start h-full">
              <h3 className="text-4xl md:text-5xl font-medium leading-tight mb-5 text-black" style={{ letterSpacing: '-0.03em' }}>
                Commerce
              </h3>
              <p className="text-black/70 text-base max-w-md mb-8">
                Lift customer retention by offering Beanstick, a trusted dollar-backed stablecoin with strong yields, letting your patrons earn with zero effort on your platform.
              </p>
              
              <Link href="/p2p" className="group inline-flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/80 backdrop-blur flex items-center justify-center group-hover:bg-white transition-colors duration-200">
                  <ArrowRight className="w-4 h-4 text-black" />
                </div>
                <span className="text-black font-medium text-base">Know more</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
