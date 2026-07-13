import { Navbar } from '@/components/Navbar';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function NewsPage() {
  const articles = [
    { 
      date: 'April 2026', 
      title: 'Beanstick secures $15M Series A to expand agentic onramp infrastructure', 
      category: 'Funding',
      img: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260423_164207_f243351d-ed59-48ec-83a0-a5e996bdbe3c.png&w=1280&q=85'
    },
    { 
      date: 'March 2026', 
      title: 'Introducing zkTLS Verification: Trustless fiat settlements are finally here', 
      category: 'Product Update',
      img: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=1000'
    },
    { 
      date: 'February 2026', 
      title: 'Beanstick wins 0G Hackathon with breakthrough AI routing protocol', 
      category: 'Community',
      img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1000'
    }
  ];

  return (
    <main className="flex flex-col bg-[#F5F5F5] min-h-screen">
      <Navbar />
      
      <section className="px-6 pt-40 pb-16 max-w-[88rem] mx-auto w-full">
        <h1 className="text-black text-6xl md:text-7xl font-medium leading-tight mb-6" style={{ letterSpacing: '-0.04em' }}>
          News & Updates
        </h1>
        <p className="text-black/60 text-xl max-w-2xl leading-relaxed">
          The latest product releases, company announcements, and insights from the Beanstick team.
        </p>
      </section>

      <section className="px-6 pb-24 max-w-[88rem] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articles.map((article, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden mb-6 bg-gray-200">
                <img 
                  src={article.img} 
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium px-3 py-1 bg-black/5 rounded-full">{article.category}</span>
                <span className="text-sm text-black/40">{article.date}</span>
              </div>
              <h2 className="text-2xl font-medium leading-snug mb-4 group-hover:text-black/70 transition-colors">
                {article.title}
              </h2>
            </div>
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <button className="bg-white border border-black/10 text-black px-8 py-3 rounded-full font-medium hover:bg-[#F9F9F9] transition-all">
            Load More Articles
          </button>
        </div>
      </section>
    </main>
  );
}
