import React, { useState, useEffect } from 'react';
import { Raffle, RaffleStatus, WinningTicket } from '../types';
import { raffleService } from '../services/raffleService';
import { ArrowLeft, Minus, Plus, ShoppingCart, Award, Gift, Trophy, Unlock, Sparkles, User } from 'lucide-react';

interface RaffleDetailsProps {
  raffle: Raffle;
  onBack: () => void;
  onBuy: (qty: number) => void;
}

export const RaffleDetails: React.FC<RaffleDetailsProps> = ({ raffle, onBack, onBuy }) => {
  const minPurchase = raffle.minPurchase || 1;
  const [quantity, setQuantity] = useState(minPurchase);
  const [winningTickets, setWinningTickets] = useState<WinningTicket[]>([]);
  
  // Use max between real and fake
  const displaySold = Math.max(raffle.soldNumbers, raffle.fakeSoldNumbers || 0);
  const percentage = Math.floor((displaySold / raffle.totalNumbers) * 100);

  useEffect(() => {
    raffleService.getPublicWinningTickets(raffle.id).then(setWinningTickets);
  }, [raffle.id]);
  
  const handleQuantityChange = (val: string) => {
    // Remove tudo que não for número
    const numericVal = val.replace(/\D/g, '');

    // Permite limpar o campo (ficando 0 ou vazio internamente)
    if (numericVal === '') {
      setQuantity(0);
      return;
    }
    
    setQuantity(parseInt(numericVal));
  };

  const handleBlur = () => {
    // Ao sair do campo, se for menor que o mínimo ou vazio, corrige
    if (quantity < minPurchase) {
      setQuantity(minPurchase);
    }
  };

  const increment = () => setQuantity(prev => prev + 1);
  const decrement = () => setQuantity(prev => (prev > minPurchase ? prev - 1 : minPurchase));

  // Dynamic quick options based on min purchase
  const quickOptions = [minPurchase, minPurchase + 5, minPurchase + 10, minPurchase + 50, minPurchase + 100];

  // Count available prizes
  const availablePrizes = winningTickets.filter(t => !t.isSold).length;

  return (
    <div className="animate-in slide-in-from-right-8 fade-in duration-300">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Voltar para Home
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image - 1350x1080 Aspect Ratio */}
        <div className="space-y-4">
          <div className="w-full aspect-[1350/1080] bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800/50 relative group">
            <img 
                src={raffle.imageUrl} 
                alt={raffle.name} 
                className="w-full h-full object-contain" 
            />
            {availablePrizes > 0 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse text-xs whitespace-nowrap z-10 border border-yellow-400">
                    <Sparkles size={14} fill="black" />
                    {availablePrizes} Bilhetes Premiados Disponíveis!
                </div>
            )}
          </div>
          
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <h3 className="text-white font-bold flex items-center gap-2 mb-2">
              <Award className="text-yellow-500" />
              Descrição do Prêmio
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
              {raffle.fullDescription}
            </p>
          </div>
        </div>

        {/* Right: Info & Purchase */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-white mb-2">{raffle.name}</h1>
          <p className="text-zinc-400 mb-6">{raffle.description}</p>

          {/* Winning Tickets Showcase - HIGH VISIBILITY */}
          {winningTickets.length > 0 && (
             <div className="bg-zinc-900/80 border border-yellow-500/30 rounded-xl p-5 mb-6 relative overflow-hidden backdrop-blur-sm shadow-lg shadow-yellow-900/10">
                 
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Gift className="text-yellow-500" size={20} /> 
                        Cotas Premiadas
                    </h3>
                    <span className="text-xs font-bold bg-yellow-900/30 text-yellow-500 px-3 py-1 rounded-full border border-yellow-500/20">
                        Achou, Ganhou!
                    </span>
                 </div>
                 
                 <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {winningTickets.map(ticket => (
                        <div 
                            key={ticket.id} 
                            className={`relative p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                                ticket.isSold 
                                ? 'bg-green-900/20 border-green-500/50' 
                                : 'bg-black/40 border-dashed border-zinc-600 hover:border-yellow-500'
                            }`}
                        >
                            <div className={`text-xs font-mono font-bold mb-2 px-3 py-1 rounded-full shadow-sm ${
                                ticket.isSold ? 'bg-green-600 text-white' : 'bg-zinc-800 text-yellow-500 border border-yellow-500/30'
                            }`}>
                                #{String(ticket.ticketNumber).padStart(5, '0')}
                            </div>
                            
                            <span className="text-sm text-zinc-200 font-bold leading-tight mb-3">
                                {ticket.prizeDescription}
                            </span>
                            
                            {ticket.isSold ? (
                                <div className="w-full bg-green-500/10 rounded py-1.5 px-2 border border-green-500/20 mt-auto">
                                    <div className="text-[10px] text-green-400 font-bold uppercase tracking-wide flex items-center justify-center gap-1 mb-0.5">
                                        <Trophy size={10} fill="currentColor"/> GANHADOR
                                    </div>
                                    <div className="text-xs text-white font-bold truncate flex items-center justify-center gap-1">
                                        <User size={10} />
                                        {ticket.winnerName || 'Anônimo'}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-auto w-full py-1.5 bg-zinc-800/50 rounded border border-zinc-700 flex items-center justify-center gap-1 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                                    <Unlock size={10} /> Disponível
                                </div>
                            )}
                        </div>
                    ))}
                 </div>
             </div>
          )}

          {/* Progress */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 mb-6">
            <div className="flex justify-between text-sm font-medium mb-2">
              <span className="text-white">Progresso da Ação</span>
              <span className="text-yellow-500 font-bold">{percentage}%</span>
            </div>
            <div className="w-full h-3 bg-black rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-zinc-500 mt-2 text-right">
              {displaySold.toLocaleString()} de {raffle.totalNumbers.toLocaleString()} cotas vendidas
            </p>
          </div>

          {raffle.status === RaffleStatus.ACTIVE ? (
            <div className="bg-zinc-900 rounded-xl p-6 border border-yellow-600/30 shadow-lg shadow-yellow-900/10 flex-1 flex flex-col">
              <div className="text-center mb-6">
                <span className="text-zinc-400 text-sm uppercase tracking-wider">Por apenas</span>
                <div className="text-5xl font-black text-white mt-1 tracking-tight">
                  R$ {raffle.pricePerNumber.toFixed(2).replace('.', ',')}
                </div>
                {minPurchase > 1 && (
                     <span className="text-yellow-600 text-xs font-bold bg-yellow-900/20 px-3 py-1 rounded-full mt-3 inline-block">
                        Compra mínima: {minPurchase} cotas
                     </span>
                )}
              </div>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm text-zinc-400 mb-2 font-medium">Quantas cotas você quer?</label>
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={decrement} className="w-12 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition-colors disabled:opacity-50" disabled={quantity <= minPurchase}>
                    <Minus size={20} />
                  </button>
                  <input 
                    type="tel" 
                    value={quantity === 0 ? '' : quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    onBlur={handleBlur}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 bg-black border border-zinc-700 rounded-xl h-12 text-center text-xl font-bold text-white focus:border-yellow-500 outline-none transition-all"
                  />
                  <button onClick={increment} className="w-12 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition-colors">
                    <Plus size={20} />
                  </button>
                </div>
                
                {/* Quick select */}
                <div className="flex flex-wrap gap-2">
                  {quickOptions.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setQuantity(opt)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                        quantity === opt 
                        ? 'bg-yellow-600 border-yellow-600 text-black shadow-lg shadow-yellow-600/20' 
                        : 'bg-transparent border-zinc-700 text-zinc-400 hover:border-yellow-500 hover:text-yellow-500'
                      }`}
                    >
                      +{opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-zinc-800">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-zinc-400">Total a pagar</span>
                  <span className="text-3xl font-bold text-yellow-500">
                    R$ {(quantity * raffle.pricePerNumber).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <button 
                  onClick={() => onBuy(quantity < minPurchase ? minPurchase : quantity)}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-lg flex items-center justify-center gap-2 shadow-xl shadow-green-900/20 transition-all hover:scale-[1.02] hover:shadow-green-900/40"
                >
                  <ShoppingCart size={24} />
                  PARTICIPAR DO SORTEIO
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center h-full opacity-75">
              <h2 className="text-2xl font-bold text-white mb-2">Ação Finalizada</h2>
              <p className="text-zinc-400">Todas as cotas foram vendidas ou o sorteio já foi realizado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};