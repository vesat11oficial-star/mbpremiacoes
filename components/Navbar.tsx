import React from 'react';
import { Ticket } from 'lucide-react';

interface NavbarProps {
  onNavigate: (view: 'home' | 'my-tickets') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  return (
    <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <div 
          onClick={() => onNavigate('home')}
          className="cursor-pointer flex flex-col group"
        >
          <span className="text-white font-black text-2xl leading-none tracking-wide group-hover:text-yellow-500 transition-colors">MURILO BRITO</span>
          <span className="text-yellow-500 text-xs font-bold tracking-[0.3em] -mt-0.5">PREMIAÇÕES</span>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onNavigate('my-tickets')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white transition-all hover:border-yellow-600 hover:text-yellow-500 text-sm font-medium"
        >
          <Ticket size={18} />
          <span className="hidden sm:inline">Meus Bilhetes</span>
        </button>
      </div>
    </nav>
  );
};