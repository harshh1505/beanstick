import { Navbar } from '@/components/Navbar';
import { Search } from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
  const faqs = [
    { q: "How does the non-custodial escrow work?", a: "Beanstick uses smart contracts on the 0G network. Crypto is locked in the contract and only released when cryptographic zkTLS proof of the fiat bank transfer is provided by the Attestor agents." },
    { q: "What happens if a trade is disputed?", a: "If the fiat payment is not verified within the time window, the crypto is automatically refunded to the seller's wallet. There is zero counterparty risk." },
    { q: "Which fiat currencies are supported?", a: "We currently support USD (via Venmo/Zelle), EUR (via SEPA), and INR (via UPI/IMPS). We are rapidly adding more integrations." },
    { q: "Are there any hidden fees?", a: "No. You only pay the spread offered by the LP agent (usually ~1-2%) and the standard network gas fees. The exact output amount is guaranteed before you lock your funds." }
  ];

  return (
    <main className="flex flex-col bg-[#F5F5F5] min-h-screen">
      <Navbar />
      
      <section className="px-6 pt-40 pb-20 max-w-[88rem] mx-auto w-full text-center">
        <h1 className="text-black text-6xl font-medium leading-tight mb-8" style={{ letterSpacing: '-0.04em' }}>
          How can we help?
        </h1>
        <div className="max-w-2xl mx-auto relative">
          <input 
            type="text" 
            placeholder="Search documentation, FAQs, and guides..." 
            className="w-full bg-white border border-black/10 rounded-2xl px-6 py-5 pl-14 text-lg focus:outline-none focus:border-black/30 shadow-sm"
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-black/40" />
        </div>
      </section>

      <section className="px-6 pb-24 max-w-[48rem] mx-auto w-full">
        <h2 className="text-2xl font-medium mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
              <h3 className="text-lg font-medium mb-3 text-black">{faq.q}</h3>
              <p className="text-black/70 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center p-8 border border-black/10 rounded-3xl">
          <h3 className="text-xl font-medium mb-2">Still need help?</h3>
          <p className="text-black/60 mb-6">Our support team and community are available 24/7.</p>
          <div className="flex justify-center gap-4">
            <button className="bg-black text-white px-6 py-2.5 rounded-full font-medium">Contact Support</button>
            <button className="bg-white border border-black/10 text-black px-6 py-2.5 rounded-full font-medium">Join Discord</button>
          </div>
        </div>
      </section>
    </main>
  );
}
