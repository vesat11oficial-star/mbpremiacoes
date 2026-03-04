import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroCarousel } from './components/HeroCarousel';
import { RaffleCard } from './components/RaffleCard';
import { RaffleDetails } from './components/RaffleDetails';
import { CheckoutModal } from './components/CheckoutModal';
import { SuccessView } from './components/SuccessView';
import { MyTickets } from './components/MyTickets';
import { AdminPanel } from './components/AdminPanel';
import { raffleService } from './services/raffleService';
import { Raffle, RaffleStatus } from './types';
import { Trophy, ShieldCheck, HeartHandshake, User, Sparkles, CheckCircle2, ArrowLeft } from 'lucide-react';

type ViewState = 'home' | 'details' | 'my-tickets' | 'success' | 'admin';

interface WinnerDisplay {
    name: string;
    prize: string;
    raffleName: string;
    type: 'MAIN' | 'INSTANT';
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [purchasedNumbers, setPurchasedNumbers] = useState<number[]>([]);
  const [wonPrizes, setWonPrizes] = useState<{ number: number; prize: string }[] | undefined>([]);
  
  // New state for combined winners
  const [allWinners, setAllWinners] = useState<WinnerDisplay[]>([]);

  useEffect(() => {
    // Basic routing simulation
    if (window.location.pathname === '/adm') {
      setView('admin');
    }

    loadRaffles();
  }, []);

  const loadRaffles = async () => {
    try {
        const data = await raffleService.getAllRaffles();
        setRaffles(data);

        // Load instant winners
        const instantWinners = await raffleService.getRecentGlobalWinners();
        
        // Combine with main raffle winners
        const mainWinners: WinnerDisplay[] = data
            .filter(r => r.status === RaffleStatus.FINISHED && r.winnerName)
            .map(r => ({
                name: r.winnerName!,
                prize: r.name, // Main prize is the raffle name
                raffleName: 'Grande Prêmio',
                type: 'MAIN'
            }));

        // Merge
        const combined = [...mainWinners, ...instantWinners];
        setAllWinners(combined);

    } catch (e) {
        console.error("Failed to load raffles", e);
    }
  };

  const handleRaffleClick = (raffle: Raffle) => {
    setSelectedRaffle(raffle);
    setView('details');
    window.scrollTo(0, 0);
  };

  const handleBuyClick = (qty: number) => {
    setPurchaseQty(qty);
    setIsCheckoutOpen(true);
  };

  const handlePurchaseSuccess = (numbers: number[], won?: { number: number; prize: string }[]) => {
    setIsCheckoutOpen(false);
    setPurchasedNumbers(numbers);
    setWonPrizes(won);
    setView('success');
    window.scrollTo(0, 0);
    loadRaffles(); // Refresh data
  };

  const activeRaffles = raffles.filter(r => r.status === RaffleStatus.ACTIVE);
  const finishedRaffles = raffles.filter(r => r.status === RaffleStatus.FINISHED);

  // Duplicate winners list 4 times to ensure smooth infinite scroll on wide screens
  const loopedWinners = [...allWinners, ...allWinners, ...allWinners, ...allWinners];

  if (view === 'admin') {
    return <AdminPanel onExit={() => {
        setView('home');
        window.history.pushState({}, '', '/');
    }} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 font-sans selection:bg-yellow-500 selection:text-black">
      {/* Inline styles for the ticker animation */}
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: scroll 40s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>

      <Navbar onNavigate={(v) => {
        setView(v);
        window.scrollTo(0, 0);
      }} />

      <main className="flex-1 pb-20">
        {view === 'home' && (
          <div className="space-y-0 animate-in fade-in duration-500">
            
            <div className="max-w-6xl mx-auto px-4 mt-4 md:mt-6 mb-8">
              <HeroCarousel />

              {/* Compact Features Bar */}
              <div className="flex flex-row justify-between md:justify-center gap-2 md:gap-12 py-4 border-b border-zinc-800 bg-zinc-900/20 backdrop-blur-sm -mx-4 px-4 md:mx-0 md:rounded-b-xl overflow-x-auto no-scrollbar">
                 <div className="flex items-center gap-2 min-w-max">
                    <Trophy className="text-yellow-500 w-4 h-4" />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white uppercase">Prêmios Incríveis</span>
                        <span className="text-[10px] text-zinc-500 hidden md:inline">Carros e Motos</span>
                    </div>
                 </div>
                 <div className="w-px h-8 bg-zinc-800 hidden md:block"></div>
                 <div className="flex items-center gap-2 min-w-max">
                    <ShieldCheck className="text-green-500 w-4 h-4" />
                     <div className="flex flex-col">
                        <span className="text-xs font-bold text-white uppercase">100% Seguro</span>
                        <span className="text-[10px] text-zinc-500 hidden md:inline">Loteria Federal</span>
                    </div>
                 </div>
                 <div className="w-px h-8 bg-zinc-800 hidden md:block"></div>
                 <div className="flex items-center gap-2 min-w-max">
                    <HeartHandshake className="text-blue-500 w-4 h-4" />
                     <div className="flex flex-col">
                        <span className="text-xs font-bold text-white uppercase">Baixo Custo</span>
                        <span className="text-[10px] text-zinc-500 hidden md:inline">A partir de R$ 0,01</span>
                    </div>
                 </div>
              </div>
            </div>

            {/* COMPACT WINNERS TICKER */}
            {allWinners.length > 0 && (
              <div className="w-full bg-zinc-900/50 border-y border-zinc-800 overflow-hidden py-3 mb-10 relative">
                  {/* Gradients to fade edges */}
                  <div className="absolute inset-y-0 left-0 w-12 md:w-32 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                  <div className="absolute inset-y-0 right-0 w-12 md:w-32 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none"></div>

                  <div className="flex gap-8 items-center animate-ticker whitespace-nowrap w-max">
                      {loopedWinners.map((winner, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 opacity-90 hover:opacity-100 transition-opacity">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  winner.type === 'MAIN' ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                  <User size={12} />
                              </div>
                              <div className="flex items-center gap-1.5 text-sm">
                                  <span className="text-white font-bold">{winner.name}</span>
                                  <span className="text-zinc-500 text-xs">ganhou</span>
                                  <span className={`font-bold flex items-center gap-1 ${
                                      winner.type === 'MAIN' ? 'text-green-400' : 'text-yellow-500'
                                  }`}>
                                      {winner.type === 'MAIN' ? <Trophy size={12}/> : <Sparkles size={12}/>}
                                      {winner.prize}
                                  </span>
                              </div>
                              {/* Separator Dot */}
                              <div className="w-1 h-1 rounded-full bg-zinc-800 ml-4"></div>
                          </div>
                      ))}
                  </div>
              </div>
            )}

            <div className="max-w-6xl mx-auto px-4">
              {/* Active Raffles */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full"></div>
                  <h2 className="text-2xl md:text-3xl font-black text-white">Rifas Ativas</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {activeRaffles.map(raffle => (
                    <RaffleCard key={raffle.id} raffle={raffle} onClick={handleRaffleClick} />
                  ))}
                </div>
              </section>

              {/* Finished Raffles */}
              {finishedRaffles.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-6 opacity-75">
                     <div className="w-1.5 h-6 md:h-8 bg-zinc-700 rounded-full"></div>
                    <h2 className="text-2xl md:text-3xl font-black text-white">Rifas Finalizadas</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 opacity-75 grayscale hover:grayscale-0 transition-all duration-500">
                    {finishedRaffles.map(raffle => (
                      <RaffleCard key={raffle.id} raffle={raffle} onClick={handleRaffleClick} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {view === 'details' && selectedRaffle && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <RaffleDetails 
              raffle={selectedRaffle} 
              onBack={() => setView('home')}
              onBuy={handleBuyClick}
            />
          </div>
        )}

        {view === 'my-tickets' && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="mb-6">
                 <button 
                  onClick={() => setView('home')}
                  className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={20} /> Voltar para Home
                </button>
            </div>
            <MyTickets />
          </div>
        )}

        {view === 'success' && selectedRaffle && (
          <div className="max-w-4xl mx-auto px-4 py-8">
            <SuccessView 
              raffleName={selectedRaffle.name} 
              numbers={purchasedNumbers}
              wonPrizes={wonPrizes}
              onHome={() => setView('home')}
              onMyTickets={() => setView('my-tickets')}
            />
          </div>
        )}
      </main>

      <footer className="bg-black border-t border-zinc-900 py-8 text-center text-zinc-600 text-sm">
        <p className="mb-2">© 2024 MURILO BRITO PREMIAÇÕES. Todos os direitos reservados.</p>
        <p>Desenvolvido para demonstração.</p>
      </footer>

      {isCheckoutOpen && selectedRaffle && (
        <CheckoutModal 
          raffle={selectedRaffle} 
          quantity={purchaseQty} 
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
};

export default App;