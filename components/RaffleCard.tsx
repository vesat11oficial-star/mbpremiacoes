import React from 'react';
import { Raffle, RaffleStatus } from '../types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface RaffleCardProps {
  raffle: Raffle;
  onClick: (raffle: Raffle) => void;
}

export const RaffleCard: React.FC<RaffleCardProps> = ({ raffle, onClick }) => {
  // Use the larger value between real sales and the manual override
  const displaySold = Math.max(raffle.soldNumbers, raffle.fakeSoldNumbers || 0);
  const percentage = Math.min(100, Math.floor((displaySold / raffle.totalNumbers) * 100));
  const isFinished = raffle.status === RaffleStatus.FINISHED;

  return (
    <div 
      onClick={() => onClick(raffle)}
      className={`group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-yellow-600/50 transition-all cursor-pointer hover:shadow-xl hover:shadow-yellow-900/10 flex flex-col h-full`}
    >
      {/* Image Container - 1350x1080 Aspect Ratio */}
      <div className="relative w-full aspect-[1350/1080] overflow-hidden bg-zinc-950/50">
        <img 
          src={raffle.imageUrl} 
          alt={raffle.name} 
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
        />
        {isFinished ? (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-red-600 text-white px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg">
              <CheckCircle2 size={16} /> Finalizada
            </span>
          </div>
        ) : (
          <div className="absolute top-2 right-2">
             <span className="bg-green-600/90 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
               DISPONÍVEL
             </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col pt-2">
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{raffle.name}</h3>
        <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{raffle.description}</p>

        <div className="mt-auto">
          {isFinished ? (
            <div className="text-center py-2 bg-zinc-800/50 rounded-lg">
              <p className="text-zinc-500 font-medium">Sorteio realizado</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-1">
                <span>{percentage}% vendido</span>
                <span className="text-yellow-500">Restam {100 - percentage}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-1000"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              
              <button className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                <div className="text-sm">POR APENAS</div>
                <div className="text-lg">R$ {raffle.pricePerNumber.toFixed(2).replace('.', ',')}</div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};