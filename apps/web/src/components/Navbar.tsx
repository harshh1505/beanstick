import Link from 'next/link';
import { LogoIcon } from '@/components/LogoIcon';

export const Navbar = () => {
  return (
    <nav className="absolute top-0 left-0 right-0 z-20 px-6 py-5">
      <div className="flex items-center justify-between max-w-[88rem] mx-auto">
        <Link href="/" className="flex items-center gap-2 group">
          <LogoIcon className="w-7 h-7 text-black group-hover:scale-105 transition-transform duration-200" />
          <span className="text-2xl font-medium tracking-tight text-black">Beanstick</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          <Link href="/network" className="text-base text-gray-700 hover:text-black font-medium transition-colors duration-200">Network</Link>
          <Link href="/ecosystem" className="text-base text-gray-700 hover:text-black font-medium transition-colors duration-200">Ecosystem</Link>
          <Link href="/rewards" className="text-base text-gray-700 hover:text-black font-medium transition-colors duration-200">Rewards</Link>
          <Link href="/help" className="text-base text-gray-700 hover:text-black font-medium transition-colors duration-200">Help</Link>
          <Link href="/news" className="text-base text-gray-700 hover:text-black font-medium transition-colors duration-200">News</Link>
        </div>
        
        <Link href="/p2p" className="bg-black text-white text-base font-medium px-7 py-2.5 rounded-full hover:bg-gray-800 transition-colors duration-200">
          Open Wallet
        </Link>
      </div>
    </nav>
  );
};
