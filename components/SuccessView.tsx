import React from 'react';
import { CheckCircle2, Home, Ticket as TicketIcon, Gift } from 'lucide-react';

interface SuccessViewProps {
  raffleName: string;
  numbers: number[];
  wonPrizes?: { number: number; prize: string }[];
  onHome: () => void;
  onMyTickets: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ raffleName, numbers, wonPrizes, onHome, onMyTickets }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
      <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 mb-6">
        <CheckCircle2 className="w-12 h-12 text-black" />
      </div>

      <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Pagamento Confirmado!</h2>
      <p className="text-zinc-400 text-lg mb-8 max-w-lg">
        Você garantiu sua participação na rifa <br/>
        <span className="text-yellow-500 font-bold">{raffleName}</span>
      </p>

      {/* INSTANT WIN SECTION */}
      {wonPrizes && wonPrizes.length > 0 && (
          <div className="w-full max-w-2xl mb-8 animate-bounce-in">
              <div className="bg-gradient-to-r from-purple-900 to-purple-800 border border-purple-500 rounded-2xl p-6 shadow-2xl shadow-purple-500/20">
                  <div className="flex items-center justify-center gap-3 mb-4">
                      <Gift className="text-yellow-400 w-8 h-8 animate-bounce" />
                      <h3 className="text-2xl font-black text-white uppercase tracking-wider">PARABÉNS! VOCÊ GANHOU!</h3>
                      <Gift className="text-yellow-400 w-8 h-8 animate-bounce" />
                  </div>
                  <p className="text-purple-200 mb-4">Você encontrou bilhetes premiados nesta compra!</p>
                  
                  <div className="space-y-3">
                      {wonPrizes.map((win, idx) => (
                          <div key={idx} className="bg-black/40 rounded-lg p-4 flex items-center justify-between border border-purple-500/50">
                              <div className="text-left">
                                  <span className="block text-xs text-purple-300 font-bold">BILHETE Nº</span>
                                  <span className="text-xl font-mono font-bold text-white">{String(win.number).padStart(6, '0')}</span>
                              </div>
                              <div className="text-right">
                                  <span className="block text-xs text-purple-300 font-bold">PRÊMIO</span>
                                  <span className="text-xl font-bold text-yellow-400">{win.prize}</span>
                              </div>
                          </div>
                      ))}
                  </div>
                  <p className="text-xs text-purple-300 mt-4">Nossa equipe entrará em contato pelo seu telefone cadastrado.</p>
              </div>
          </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl mb-8">
        <h3 className="text-zinc-500 text-sm font-medium uppercase tracking-wider mb-4">Seus números da sorte</h3>
        <div className="flex flex-wrap gap-2 justify-center max-h-60 overflow-y-auto custom-scrollbar">
          {numbers.map((num) => {
            const isWinner = wonPrizes?.some(w => w.number === num);
            return (
                <div 
                key={num} 
                className={`border font-mono font-bold px-3 py-2 rounded-lg text-lg min-w-[80px] ${
                    isWinner 
                    ? 'bg-purple-900 border-purple-500 text-white animate-pulse' 
                    : 'bg-black border-yellow-900/50 text-yellow-500'
                }`}
                >
                {String(num).padStart(6, '0')}
                </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button 
          onClick={onMyTickets}
          className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <TicketIcon size={20} />
          Ver Meus Bilhetes
        </button>
        <button 
          onClick={onHome}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Home size={20} />
          Voltar ao Início
        </button>
      </div>
    </div>
  );
};