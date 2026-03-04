import React, { useState } from 'react';
import { Search, Ticket as TicketIcon, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { raffleService } from '../services/raffleService';
import { Purchase, RaffleStatus } from '../types';

export const MyTickets: React.FC = () => {
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [searched, setSearched] = useState(false);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    // Máscara 000.000.000-00
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    
    setCpf(value);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpf.length < 14) return;
    
    setLoading(true);
    try {
      const result = await raffleService.getMyTickets(cpf);
      setPurchases(result);
      setSearched(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Group purchases by raffle
  const groupedPurchases = purchases ? purchases.reduce((acc, purchase) => {
    if (!acc[purchase.raffleId]) {
      acc[purchase.raffleId] = {
        raffleName: purchase.raffleName || 'Rifa Desconhecida',
        status: purchase.raffleStatus,
        updatedAt: purchase.raffleUpdatedAt,
        purchases: []
      };
    }
    acc[purchase.raffleId].purchases.push(purchase);
    return acc;
  }, {} as Record<string, { raffleName: string, status?: RaffleStatus, updatedAt?: string, purchases: Purchase[] }>) : {};

  // Filter groups based on visibility rules
  const visibleGroups = Object.entries(groupedPurchases).filter(([_, group]) => {
    if (group.status === RaffleStatus.FINISHED) {
      // If no update date, assume it's old and hide? Or show? 
      // Better to show if unsure, but user asked for restriction.
      // If we assume updated_at is the finish date:
      if (!group.updatedAt) return true; 

      const finishedDate = new Date(group.updatedAt);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      return finishedDate > oneMonthAgo;
    }
    return true; // Always show active raffles
  });

  return (
    <div className="max-w-4xl mx-auto min-h-[60vh] animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-4">Meus Bilhetes</h2>
        <p className="text-zinc-400">Consulte seus números da sorte utilizando seu CPF.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm text-zinc-400 mb-2">CPF do Participante</label>
            <input 
              type="text" 
              value={cpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="md:mt-7 px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? 'Buscando...' : (
              <>
                <Search size={20} /> Consultar
              </>
            )}
          </button>
        </form>
      </div>

      {searched && visibleGroups.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <TicketIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Nenhum bilhete encontrado ou disponível para visualização.</p>
        </div>
      )}

      {visibleGroups.length > 0 && (
        <div className="space-y-8">
          {visibleGroups.map(([raffleId, group]) => (
            <div key={raffleId} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
              {/* Raffle Header */}
              <div className="bg-zinc-900 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <TicketIcon className="text-yellow-500" size={20} />
                  {group.raffleName}
                </h3>
                <div className="flex items-center gap-2">
                  {group.status === RaffleStatus.ACTIVE ? (
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} /> ATIVA
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-zinc-700/50 text-zinc-400 text-xs font-bold flex items-center gap-1">
                      <Clock size={12} /> ENCERRADA
                    </span>
                  )}
                </div>
              </div>

              {/* Purchases List for this Raffle */}
              <div className="divide-y divide-zinc-800">
                {group.purchases.map((purchase) => (
                  <div key={purchase.id} className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} />
                          {new Date(purchase.purchaseDate).toLocaleDateString('pt-BR')}
                        </div>
                        <span>•</span>
                        <div>
                          {purchase.quantity} cotas
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Seus números:</p>
                      <div className="flex flex-wrap gap-2">
                        {purchase.ticketNumbers.map(num => (
                          <span key={num} className="bg-black border border-zinc-700 text-zinc-200 px-3 py-1 rounded text-sm font-mono">
                            {String(num).padStart(6, '0')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};