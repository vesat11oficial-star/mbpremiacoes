import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { raffleService } from '../services/raffleService';
import { Raffle, Purchase, Banner, WinningTicket } from '../types';
import { 
  LayoutDashboard, 
  Plus, 
  Edit, 
  Trash2, 
  Ticket, 
  DollarSign, 
  Users, 
  LogOut, 
  Save, 
  X,
  Search,
  Trophy,
  Loader2,
  Lock,
  Image as ImageIcon,
  TrendingUp,
  ShoppingBag,
  RefreshCw,
  AlertTriangle,
  Unlock,
  Gift,
  Eye,
  UserPlus,
  Calendar,
  Filter
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

type DateFilter = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

import { AdminSimulation } from './AdminSimulation';

export const AdminPanel: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'raffles' | 'tickets' | 'sales' | 'site' | 'simulation'>('dashboard');
  
  // Dashboard Logic
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [stats, setStats] = useState({ totalRevenue: 0, activeRaffles: 0, salesCount: 0, avgTicket: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Raffle Form
  const [isEditing, setIsEditing] = useState<Raffle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [savingRaffle, setSavingRaffle] = useState(false);
  const [manualProgressPercent, setManualProgressPercent] = useState<number | string>('');

  // Winning Tickets State
  const [winningTickets, setWinningTickets] = useState<WinningTicket[]>([]);
  const [newWinningTicket, setNewWinningTicket] = useState({ number: '', prize: '' });
  
  // Manual Winner Assignment State (Inside Raffle Edit)
  const [assigningWinner, setAssigningWinner] = useState<WinningTicket | null>(null);
  const [assignForm, setAssignForm] = useState({ name: '', cpf: '', phone: '' });

  // Ticket Manager (Search & Manual Creation)
  const [searchTicket, setSearchTicket] = useState({ raffleId: '', number: '' });
  const [foundTicket, setFoundTicket] = useState<any>(null);
  const [newOwnerCpf, setNewOwnerCpf] = useState('');
  const [manualTicketForm, setManualTicketForm] = useState({ name: '', cpf: '', phone: '' });

  // Sales Manager
  const [purchases, setPurchases] = useState<any[]>([]);
  const [editPurchase, setEditPurchase] = useState<any>(null);
  const [viewingPurchaseTickets, setViewingPurchaseTickets] = useState<{numbers: number[], info: any} | null>(null);

  // Site Manager (Banners)
  const [banners, setBanners] = useState<any[]>([]);
  const [newBannerUrl, setNewBannerUrl] = useState('');

  // --- Input Formatters ---
  const formatCPF = (val: string) => {
    let value = val.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return value;
  };

  const formatPhone = (val: string) => {
    let value = val.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    }
    return value;
  };

  const formatName = (val: string) => {
    return val.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, '');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && activeTab === 'dashboard') {
      loadDashboardWithFilters();
    }
  }, [session, activeTab, dateFilter, customStart, customEnd]); // Reload when filters change

  const loadDashboardWithFilters = async () => {
    setLoadingData(true);
    try {
        // Calculate date ranges
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = new Date(); // Default end is now

        switch (dateFilter) {
            case 'today':
                start = new Date();
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'yesterday':
                start = new Date();
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
                break;
            case '7days':
                start = new Date();
                start.setDate(start.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                break;
            case '30days':
                start = new Date();
                start.setDate(start.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                break;
            case 'custom':
                if (customStart) start = new Date(customStart + 'T00:00:00');
                if (customEnd) end = new Date(customEnd + 'T23:59:59');
                break;
            case 'all':
                start = null;
                end = null;
                break;
        }

        const sISO = start ? start.toISOString() : null;
        const eISO = end ? end.toISOString() : null;

        const data = await raffleService.getDashboardStats(sISO, eISO);
        setStats({
            totalRevenue: data.totalRevenue,
            activeRaffles: data.activeRaffles,
            salesCount: data.salesCount,
            avgTicket: data.avgTicket
        });
        setChartData(data.chartData);

        // Also refresh raffle list for the management part
        if (raffles.length === 0) {
            const r = await raffleService.getAllRaffles();
            setRaffles(r);
        }

    } catch (error) {
        console.error("Erro ao carregar dashboard", error);
    } finally {
        setLoadingData(false);
    }
  };

  // --- TAB LOADERS ---
  useEffect(() => {
      if(!session) return;
      if (activeTab === 'sales') loadPurchases();
      if (activeTab === 'site') loadBanners();
  }, [activeTab]);

  const loadPurchases = async () => {
      setLoadingData(true);
      try {
          const data = await raffleService.adminGetAllPurchases(100);
          setPurchases(data || []);
      } catch(e) { console.error(e); } 
      finally { setLoadingData(false); }
  };

  const loadBanners = async () => {
      try {
          const data = await raffleService.adminGetBanners();
          setBanners(data);
      } catch(e) { console.error(e); }
  };

  const loadWinningTickets = async (raffleId: string) => {
      try {
          const tickets = await raffleService.adminGetWinningTickets(raffleId);
          setWinningTickets(tickets);
      } catch (e) { console.error(e); }
  };

  // --- HELPERS ---
  const handleOpenEdit = (raffle: Raffle) => {
      setIsEditing(raffle);
      setIsCreating(false);
      setFormData(raffle);
      loadWinningTickets(raffle.id);
      
      // Calculate current visible percentage
      const currentSold = Math.max(raffle.soldNumbers, raffle.fakeSoldNumbers || 0);
      const percent = Math.floor((currentSold / raffle.totalNumbers) * 100);
      setManualProgressPercent(percent);
  };

  const handleOpenCreate = () => {
      setIsCreating(true);
      setIsEditing(null);
      setWinningTickets([]);
      setFormData({ totalNumbers: 1000, pricePerNumber: 0.99, minPurchase: 1 });
      setManualProgressPercent(0);
  };

  // --- ACTIONS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('Email ou senha inválidos.');
    setLoggingIn(false);
  };

  const handleSaveRaffle = async (e: React.FormEvent) => {
      e.preventDefault();

      if (isEditing) {
        const confirmUpdate = window.confirm("Tem certeza que deseja salvar as alterações? Isso atualizará os dados da rifa no banco de dados.");
        if (!confirmUpdate) return;
      }

      setSavingRaffle(true);
      try {
          // Calculate fake sold numbers based on percentage input
          const percent = parseFloat(manualProgressPercent.toString()) || 0;
          const total = parseInt(formData.totalNumbers);
          const fakeSold = Math.floor((percent / 100) * total);

          const payload = {
            fakeSoldNumbers: fakeSold,
            ...formData
          };

          console.log("Saving raffle payload:", payload);

          if (isCreating) {
              await raffleService.createRaffle(payload);
          } else if (isEditing) {
              const updates = {
                  name: formData.name,
                  description: formData.description,
                  full_description: formData.fullDescription,
                  image_url: formData.imageUrl,
                  price_per_number: formData.pricePerNumber,
                  min_purchase: formData.minPurchase,
                  status: formData.status,
                  fake_sold_numbers: fakeSold,
                  winner_number: formData.winnerNumber || null,
                  winner_name: formData.winnerName || null
              };
              console.log("Updating raffle with:", updates);
              const result = await raffleService.updateRaffle(isEditing.id, updates);
              console.log("Update result:", result);
              if (!result || result.length === 0) {
                  throw new Error("Nenhum registro foi atualizado. Verifique se a rifa ainda existe.");
              }
          }
          alert('Rifa salva com sucesso!');
          setIsCreating(false);
          setIsEditing(null);
          setFormData({});
          loadDashboardWithFilters(); // Refresh
      } catch (err: any) {
          console.error(err);
          alert(`Erro ao salvar rifa: ${err.message || 'Erro desconhecido'}.`);
      } finally {
          setSavingRaffle(false);
      }
  };

  const handleAddWinningTicket = async () => {
      if (!isEditing) return alert('Salve a rifa antes de adicionar bilhetes premiados.');
      if (!newWinningTicket.number || !newWinningTicket.prize) return alert('Preencha o número e o prêmio.');
      
      try {
          await raffleService.adminCreateWinningTicket(isEditing.id, parseInt(newWinningTicket.number), newWinningTicket.prize);
          setNewWinningTicket({ number: '', prize: '' });
          loadWinningTickets(isEditing.id);
      } catch(e: any) {
         alert('Erro ao criar bilhete premiado: ' + e.message);
      }
  };

  const handleToggleWinningTicket = async (id: string, currentStatus: boolean) => {
      try {
          await raffleService.adminToggleWinningTicket(id, !currentStatus);
          loadWinningTickets(isEditing!.id);
      } catch(e: any) {
          alert('Erro: ' + e.message);
      }
  };

  const handleDeleteWinningTicket = async (id: string) => {
      if(!confirm('Remover este bilhete premiado?')) return;
      try {
          await raffleService.adminDeleteWinningTicket(id);
          loadWinningTickets(isEditing!.id);
      } catch(e: any) {
         alert('Erro: ' + e.message);
      }
  };

  const handleOpenAssignWinner = (ticket: WinningTicket) => {
    setAssigningWinner(ticket);
    setAssignForm({ name: '', cpf: '', phone: '' });
  };

  const handleSubmitAssignWinner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningWinner || !isEditing) return;
    
    try {
        await raffleService.adminManualAssignWinner(
            assigningWinner.id,
            isEditing.id,
            assigningWinner.ticketNumber,
            assignForm.name,
            assignForm.cpf,
            assignForm.phone
        );
        alert(`Sucesso! O bilhete ${assigningWinner.ticketNumber} foi atribuído a ${assignForm.name}.`);
        setAssigningWinner(null);
        loadWinningTickets(isEditing.id);
    } catch(e: any) {
        alert('Erro ao atribuir ganhador: ' + e.message);
    }
  };

  const handleDeleteRaffle = async (id: string) => {
      if(!confirm('ATENÇÃO: Deletar uma rifa apaga todo histórico de vendas dela. Confirmar?')) return;
      const { error } = await supabase.from('raffles').delete().eq('id', id);
      if (error) alert('Erro ao deletar: ' + error.message);
      else loadDashboardWithFilters();
  };

  const handleSearchTicket = async (e: React.FormEvent) => {
      e.preventDefault();
      setFoundTicket(null);
      setManualTicketForm({ name: '', cpf: '', phone: '' });
      const { data, error } = await raffleService.getTicketOwner(searchTicket.raffleId, parseInt(searchTicket.number));
      if(error || !data) setFoundTicket({ error: 'Bilhete não encontrado.' });
      else setFoundTicket(data);
  };

  const handleUpdateTicketOwner = async () => {
      if (!foundTicket || !foundTicket.id) return;
      if (!newOwnerCpf || newOwnerCpf.length < 11) return alert('CPF inválido');
      
      try {
          await raffleService.adminUpdateTicketOwner(foundTicket.id, newOwnerCpf);
          alert('Dono do bilhete atualizado com sucesso!');
          setFoundTicket((prev: any) => ({...prev, owner_cpf: newOwnerCpf}));
          setNewOwnerCpf('');
      } catch(e: any) {
          alert('Erro ao atualizar dono: ' + e.message);
      }
  };

  const handleCreateManualTicket = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchTicket.raffleId || !searchTicket.number) return;
      
      try {
          await raffleService.adminCreateManualTicket(
              searchTicket.raffleId,
              parseInt(searchTicket.number),
              manualTicketForm.name,
              manualTicketForm.cpf,
              manualTicketForm.phone
          );
          alert(`Bilhete #${searchTicket.number} criado com sucesso!`);
          handleSearchTicket(e); // Refresh search to show the ticket
      } catch(e: any) {
          alert('Erro ao criar bilhete: ' + e.message);
      }
  };

  const handleUpdatePurchase = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!editPurchase) return;
      try {
          await raffleService.adminUpdatePurchase(editPurchase.id, { 
              name: editPurchase.name,
              phone: editPurchase.phone, 
              cpf: editPurchase.cpf 
          });
          setEditPurchase(null);
          loadPurchases();
          alert('Dados da compra atualizados.');
      } catch(e: any) {
          alert('Erro ao atualizar compra: ' + e.message);
      }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newBannerUrl) return;
      try {
          await raffleService.adminCreateBanner(newBannerUrl);
          setNewBannerUrl('');
          loadBanners();
      } catch(e: any) {
          alert('Erro ao adicionar banner: ' + e.message);
      }
  };

  const handleDeleteBanner = async (id: string) => {
      if(!confirm('Remover banner?')) return;
      try {
          await raffleService.adminDeleteBanner(id);
          loadBanners();
      } catch(e: any) {
          alert('Erro ao remover banner: ' + e.message);
      }
  };

  const handleViewTickets = async (purchase: any) => {
      try {
          const numbers = await raffleService.adminGetTicketsByPurchase(purchase.id);
          setViewingPurchaseTickets({
              numbers,
              info: purchase
          });
      } catch(e: any) {
          alert('Erro ao buscar bilhetes: ' + e.message);
      }
  };


  // --- VIEW ---

  if (loadingSession) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <form onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 w-full max-w-md shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-yellow-900/20 rounded-full"><Lock className="w-8 h-8 text-yellow-500" /></div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Admin Pro</h2>
          {loginError && <div className="bg-red-900/30 border border-red-800 text-red-200 p-3 rounded mb-4 text-sm text-center">{loginError}</div>}
          <div className="space-y-4">
            <input type="email" placeholder="admin@murilobrito.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-yellow-600 outline-none" />
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-yellow-600 outline-none" />
          </div>
          <button disabled={loggingIn} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded-lg mt-6 flex justify-center">
            {loggingIn ? <Loader2 className="animate-spin" /> : 'Entrar'}
          </button>
          <button type="button" onClick={onExit} className="w-full mt-4 text-zinc-500 text-sm">Voltar ao site</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row text-white font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-20">
        <div className="p-6 border-b border-zinc-800">
            <h1 className="text-xl font-bold text-yellow-500 tracking-wider">MURILO BRITO CMS</h1>
            <p className="text-xs text-zinc-500">v2.0 Ultimate</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Faturamento' },
            { id: 'raffles', icon: Ticket, label: 'Gerenciar Rifas' },
            { id: 'sales', icon: ShoppingBag, label: 'Vendas & Leads' },
            { id: 'tickets', icon: Users, label: 'Editar Bilhetes' },
            { id: 'simulation', icon: AlertTriangle, label: 'Simular Expirado' },
            { id: 'site', icon: ImageIcon, label: 'Configurar Site' },
          ].map((item) => (
             <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === item.id ? 'bg-yellow-600 text-black font-bold shadow-lg shadow-yellow-900/20' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
              >
                <item.icon size={18} /> {item.label}
              </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">AD</div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">Admin</p>
                    <p className="text-xs text-zinc-500 truncate">{session.user.email}</p>
                </div>
            </div>
            <button onClick={async () => { await supabase.auth.signOut(); onExit(); }} className="w-full flex items-center gap-2 text-red-400 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors">
                <LogOut size={16} /> Sair do Sistema
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen bg-black/50">
        <header className="bg-zinc-900/50 backdrop-blur border-b border-zinc-800 p-6 sticky top-0 z-10 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white capitalize">{activeTab.replace('dashboard', 'Faturamento').replace('raffles', 'Rifas').replace('sales', 'Vendas')}</h2>
            <div className="flex gap-2">
                <button onClick={() => window.location.reload()} className="p-2 text-zinc-400 hover:text-white"><RefreshCw size={20} /></button>
            </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            
            {/* DASHBOARD TAB (FATURAMENTO) */}
            {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    
                    {/* Filter Bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-2 text-zinc-400">
                             <Filter size={18} />
                             <span className="text-sm font-bold">Filtrar Período:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'today', label: 'Hoje' },
                                { id: 'yesterday', label: 'Ontem' },
                                { id: '7days', label: '7 Dias' },
                                { id: '30days', label: '30 Dias' },
                                { id: 'all', label: 'Todo Período' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setDateFilter(opt.id as DateFilter)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                        dateFilter === opt.id 
                                        ? 'bg-yellow-600 text-black shadow-lg shadow-yellow-900/20' 
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                            <button
                                onClick={() => setDateFilter('custom')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    dateFilter === 'custom'
                                    ? 'bg-yellow-600 text-black' 
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                            >
                                Personalizado
                            </button>
                        </div>
                    </div>

                    {/* Custom Range Inputs */}
                    {dateFilter === 'custom' && (
                         <div className="flex flex-wrap items-end gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                             <div>
                                 <label className="text-xs text-zinc-500 font-bold block mb-1">Data Início</label>
                                 <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white text-sm" />
                             </div>
                             <div>
                                 <label className="text-xs text-zinc-500 font-bold block mb-1">Data Fim</label>
                                 <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white text-sm" />
                             </div>
                             <div className="pb-1 text-xs text-zinc-500 italic">Selecione ambas as datas para atualizar.</div>
                         </div>
                    )}

                    {loadingData ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="animate-spin text-yellow-500 w-8 h-8" />
                        </div>
                    ) : (
                        <>
                            {/* Key Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-black/50">
                                    <div>
                                        <p className="text-zinc-500 text-xs font-bold uppercase mb-1">Faturamento (Período)</p>
                                        <p className="text-3xl font-black text-white">R$ {stats.totalRevenue.toFixed(2)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-zinc-950 text-green-500 border border-green-900/20"><DollarSign size={24} /></div>
                                </div>
                                
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-black/50">
                                    <div>
                                        <p className="text-zinc-500 text-xs font-bold uppercase mb-1">Vendas Realizadas</p>
                                        <p className="text-3xl font-black text-white">{stats.salesCount}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-zinc-950 text-yellow-500 border border-yellow-900/20"><ShoppingBag size={24} /></div>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-black/50">
                                    <div>
                                        <p className="text-zinc-500 text-xs font-bold uppercase mb-1">Ticket Médio</p>
                                        <p className="text-3xl font-black text-white">R$ {stats.avgTicket.toFixed(2)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-zinc-950 text-blue-500 border border-blue-900/20"><TrendingUp size={24} /></div>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-black/50 opacity-80">
                                    <div>
                                        <p className="text-zinc-500 text-xs font-bold uppercase mb-1">Rifas Ativas (Total)</p>
                                        <p className="text-3xl font-black text-white">{stats.activeRaffles}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-zinc-950 text-purple-500 border border-purple-900/20"><RefreshCw size={24} /></div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-yellow-600 rounded-lg text-black"><TrendingUp size={20}/></div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Receita no tempo</h3>
                                        <p className="text-xs text-zinc-500">Visualização gráfica do faturamento baseado no filtro selecionado.</p>
                                    </div>
                                </div>
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                            <XAxis 
                                                dataKey="name" 
                                                stroke="#71717a" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                dy={10}
                                            />
                                            <YAxis 
                                                stroke="#71717a" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tickFormatter={(val) => `R$${val}`} 
                                                dx={-10}
                                            />
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }} 
                                                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="value" 
                                                stroke="#eab308" 
                                                strokeWidth={3} 
                                                fillOpacity={1} 
                                                fill="url(#colorVal)" 
                                                activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* RAFFLES TAB */}
            {activeTab === 'raffles' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-end">
                        <button onClick={handleOpenCreate} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-green-900/20">
                            <Plus size={20} /> Criar Nova Rifa
                        </button>
                    </div>

                    {(isEditing || isCreating) && (
                        <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-2xl relative">
                            <button onClick={() => { setIsCreating(false); setIsEditing(null); }} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                            <h3 className="text-2xl font-bold text-white mb-6">{isCreating ? 'Cadastrar Rifa' : 'Editar Rifa Completa'}</h3>
                            
                            <div className="flex flex-col gap-8">
                                <form onSubmit={handleSaveRaffle} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="label-admin">Nome da Campanha</label>
                                        <input required className="input-admin" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="label-admin">Subtítulo (Curto)</label>
                                        <input required className="input-admin" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="label-admin">Descrição Detalhada (Regras, Prêmios)</label>
                                        <textarea required className="input-admin h-32" value={formData.fullDescription || ''} onChange={e => setFormData({...formData, fullDescription: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="label-admin">URL da Imagem de Capa</label>
                                        <div className="flex gap-2">
                                            <input required className="input-admin flex-1" value={formData.imageUrl || ''} onChange={e => setFormData({...formData, imageUrl: e.target.value})} />
                                            {formData.imageUrl && <img src={formData.imageUrl} className="w-12 h-12 rounded object-cover border border-zinc-700" alt="Preview" />}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-admin">Preço por Cota (R$)</label>
                                        <input type="number" step="0.01" required className="input-admin" value={formData.pricePerNumber || ''} onChange={e => setFormData({...formData, pricePerNumber: parseFloat(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="label-admin text-yellow-500">Compra Mínima de Cotas</label>
                                        <input type="number" required className="input-admin" value={formData.minPurchase || 1} onChange={e => setFormData({...formData, minPurchase: parseInt(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="label-admin">Total de Números</label>
                                        <input type="number" disabled={!!isEditing} required className="input-admin disabled:opacity-50" value={formData.totalNumbers || ''} onChange={e => setFormData({...formData, totalNumbers: parseInt(e.target.value)})} />
                                    </div>
                                    
                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 col-span-2">
                                        <label className="label-admin text-blue-400">⚡ Progresso Manual (%)</label>
                                        <p className="text-zinc-500 text-xs mb-2">Defina quanto da barra de progresso deve aparecer preenchida, independente das vendas reais.</p>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="100" 
                                                className="input-admin w-32 border-blue-900/50 focus:border-blue-500" 
                                                placeholder="Ex: 90" 
                                                value={manualProgressPercent} 
                                                onChange={e => setManualProgressPercent(e.target.value)} 
                                            />
                                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, parseFloat(manualProgressPercent.toString()) || 0)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-950 p-6 rounded-xl border border-zinc-800 mt-4">
                                            <div>
                                                <label className="label-admin text-yellow-500">Status da Rifa</label>
                                                <select className="input-admin border-yellow-900/50 focus:border-yellow-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                    <option value="ACTIVE">⚡ ATIVA (Vendendo)</option>
                                                    <option value="FINISHED">🏁 FINALIZADA (Encerrada)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label-admin text-green-500">Número Sorteado</label>
                                                <input type="number" className="input-admin border-green-900/50 focus:border-green-500" placeholder="Ex: 15420" value={formData.winnerNumber || ''} onChange={e => setFormData({...formData, winnerNumber: parseInt(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="label-admin text-green-500">Nome do Ganhador</label>
                                                <input type="text" className="input-admin border-green-900/50 focus:border-green-500" placeholder="Ex: João da Silva" value={formData.winnerName || ''} onChange={e => setFormData({...formData, winnerName: e.target.value})} />
                                            </div>
                                        </div>
                                    )}

                                    <div className="col-span-2 pt-4">
                                        <button disabled={savingRaffle} className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-700 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2">
                                            {savingRaffle ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Salvar Alterações</>}
                                        </button>
                                    </div>
                                </form>

                                {/* WINNING TICKETS SECTION */}
                                {isEditing && (
                                    <div className="border-t border-zinc-800 pt-8 animate-in fade-in">
                                        <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Gift className="text-purple-500" /> Bilhetes Premiados (Prêmios Instantâneos)</h4>
                                        <p className="text-zinc-400 text-sm mb-6">Defina números que valem prêmios extras. Se o cadeado estiver FECHADO, o número não sai no sorteio aleatório. Se ABERTO, ele pode ser comprado por qualquer um.</p>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                <label className="label-admin">Número Premiado</label>
                                                <input type="number" className="input-admin" placeholder="Ex: 500" value={newWinningTicket.number} onChange={e => setNewWinningTicket({...newWinningTicket, number: e.target.value})} />
                                            </div>
                                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                <label className="label-admin">Prêmio (Descrição)</label>
                                                <input type="text" className="input-admin" placeholder="Ex: R$ 500 no Pix" value={newWinningTicket.prize} onChange={e => setNewWinningTicket({...newWinningTicket, prize: e.target.value})} />
                                            </div>
                                            <div className="flex items-end">
                                                <button onClick={handleAddWinningTicket} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold h-[48px] rounded-lg flex items-center justify-center gap-2">
                                                    <Plus size={18} /> Adicionar Bilhete
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {winningTickets.length === 0 && <p className="text-zinc-600 text-center italic py-4">Nenhum bilhete premiado cadastrado.</p>}
                                            {winningTickets.map(ticket => (
                                                <div key={ticket.id} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex items-center justify-between group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${ticket.isSold ? 'bg-green-900/20 text-green-500' : 'bg-zinc-800 text-white'}`}>
                                                            {ticket.ticketNumber}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white">{ticket.prizeDescription}</p>
                                                            <div className="flex gap-2 text-xs mt-1">
                                                                {ticket.isSold ? (
                                                                    <span className="text-green-500 font-bold flex items-center gap-1"><Trophy size={12}/> VENDIDO ({ticket.winnerName})</span>
                                                                ) : (
                                                                    <span className="text-zinc-500">Disponível</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        {!ticket.isSold && (
                                                            <button 
                                                                onClick={() => handleOpenAssignWinner(ticket)}
                                                                title="Definir Ganhador Manualmente"
                                                                className="px-4 py-2 rounded-lg font-bold text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 flex items-center gap-2"
                                                            >
                                                                <UserPlus size={14} /> GANHADOR
                                                            </button>
                                                        )}

                                                        <button 
                                                            onClick={() => handleToggleWinningTicket(ticket.id, ticket.isActive)}
                                                            disabled={ticket.isSold}
                                                            title={ticket.isActive ? "Bloquear (Ninguém pode ganhar)" : "Liberar (Pode sair no sorteio)"}
                                                            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${
                                                                ticket.isActive 
                                                                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' 
                                                                    : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                                                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                                                        >
                                                            {ticket.isActive ? <Unlock size={14} /> : <Lock size={14} />}
                                                            {ticket.isActive ? 'LIBERADO' : 'TRAVADO'}
                                                        </button>
                                                        <button onClick={() => handleDeleteWinningTicket(ticket.id)} className="p-2 text-zinc-500 hover:text-red-500 hover:bg-zinc-800 rounded">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MANUAL WINNER ASSIGN MODAL (Inside Raffle) */}
                    {assigningWinner && (
                         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md">
                                <h3 className="text-xl font-bold text-white mb-2">Definir Ganhador Manual</h3>
                                <p className="text-zinc-400 text-sm mb-4">
                                    Isso criará uma venda de R$ 0,00 e atribuirá o bilhete <strong className="text-white">#{assigningWinner.ticketNumber}</strong> a esta pessoa.
                                </p>
                                <form onSubmit={handleSubmitAssignWinner} className="space-y-4">
                                    <div>
                                        <label className="label-admin">Nome Completo</label>
                                        <input required className="input-admin" value={assignForm.name} onChange={e => setAssignForm({...assignForm, name: formatName(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="label-admin">CPF</label>
                                        <input required className="input-admin" placeholder="Apenas números" value={assignForm.cpf} onChange={e => setAssignForm({...assignForm, cpf: formatCPF(e.target.value)})} maxLength={14} />
                                    </div>
                                    <div>
                                        <label className="label-admin">Telefone</label>
                                        <input required className="input-admin" value={assignForm.phone} onChange={e => setAssignForm({...assignForm, phone: formatPhone(e.target.value)})} maxLength={15} />
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                        <button type="button" onClick={() => setAssigningWinner(null)} className="flex-1 bg-zinc-800 py-3 rounded-lg text-white hover:bg-zinc-700">Cancelar</button>
                                        <button className="flex-1 bg-green-600 py-3 rounded-lg text-white font-bold hover:bg-green-500">Confirmar</button>
                                    </div>
                                </form>
                            </div>
                         </div>
                    )}
                    
                    {/* Raffle List - Unchanged */}
                    <div className="grid gap-4">
                        {raffles.map(raffle => {
                             const displaySold = Math.max(raffle.soldNumbers, raffle.fakeSoldNumbers || 0);
                             const percentage = Math.floor((displaySold / raffle.totalNumbers) * 100);
                             
                             return (
                                <div key={raffle.id} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-col md:flex-row items-center gap-6 hover:border-zinc-600 transition-colors">
                                    <img src={raffle.imageUrl} className="w-24 h-24 rounded-xl object-cover shadow-lg" alt="" />
                                    <div className="flex-1 text-center md:text-left">
                                        <h3 className="text-xl font-bold text-white mb-1">{raffle.name}</h3>
                                        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${raffle.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                                {raffle.status === 'ACTIVE' ? 'EM ANDAMENTO' : 'FINALIZADA'}
                                            </span>
                                            <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs">
                                                {displaySold} visíveis / {raffle.soldNumbers} reais
                                            </span>
                                            <span className="bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
                                                {percentage}%
                                            </span>
                                            <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs">
                                                R$ {raffle.pricePerNumber} / cota
                                            </span>
                                        </div>
                                        {raffle.winnerName && (
                                            <div className="mt-2 text-sm text-yellow-500 font-bold flex items-center gap-2 justify-center md:justify-start">
                                                <Trophy size={14} /> Ganhador: {raffle.winnerName} (Nº {raffle.winnerNumber})
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenEdit(raffle)} className="btn-icon bg-zinc-800 hover:bg-blue-600 hover:text-white"><Edit size={18} /></button>
                                        <button onClick={() => handleDeleteRaffle(raffle.id)} className="btn-icon bg-zinc-800 hover:bg-red-600 hover:text-white"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* ... rest of the component unchanged ... */}
            {activeTab === 'tickets' && (
                 <div className="space-y-6 animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Editor de Bilhetes (Troca de Titularidade)</h3>
                        <p className="text-zinc-400 text-sm mb-6">Use esta ferramenta para corrigir erros de cadastro. Você pode buscar um número específico e transferi-lo para outro CPF.</p>
                        
                        <form onSubmit={handleSearchTicket} className="flex flex-col md:flex-row gap-4 items-end bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                             <div className="flex-1 w-full">
                                <label className="label-admin">Rifa</label>
                                <select className="input-admin" value={searchTicket.raffleId} onChange={e => setSearchTicket({...searchTicket, raffleId: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {raffles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div className="flex-1 w-full">
                                <label className="label-admin">Número do Bilhete</label>
                                <input type="number" className="input-admin" placeholder="Ex: 5042" value={searchTicket.number} onChange={e => setSearchTicket({...searchTicket, number: e.target.value})} />
                            </div>
                            <button className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-8 py-3 rounded-lg h-[46px]">Buscar</button>
                        </form>

                        {foundTicket && (
                            <div className="mt-8 border-t border-zinc-800 pt-8 animate-in slide-in-from-bottom-2">
                                {foundTicket.error ? (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                        <div className="flex items-center gap-2 text-yellow-500 mb-4 font-bold text-lg">
                                            <AlertTriangle /> Bilhete #{searchTicket.number} ainda não foi vendido.
                                        </div>
                                        <p className="text-zinc-400 text-sm mb-6">Deseja criar este bilhete manualmente e atribuir a um ganhador/comprador? Se este for um número premiado, ele será marcado como ganho automaticamente.</p>
                                        
                                        <form onSubmit={handleCreateManualTicket} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                    <label className="label-admin">Nome Completo</label>
                                                    <input required className="input-admin" value={manualTicketForm.name} onChange={e => setManualTicketForm({...manualTicketForm, name: formatName(e.target.value)})} />
                                                </div>
                                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                    <label className="label-admin">CPF</label>
                                                    <input required className="input-admin" value={manualTicketForm.cpf} onChange={e => setManualTicketForm({...manualTicketForm, cpf: formatCPF(e.target.value)})} maxLength={14} />
                                                </div>
                                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                    <label className="label-admin">Telefone</label>
                                                    <input required className="input-admin" value={manualTicketForm.phone} onChange={e => setManualTicketForm({...manualTicketForm, phone: formatPhone(e.target.value)})} maxLength={15} />
                                                </div>
                                            </div>
                                            <button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg flex justify-center items-center gap-2">
                                                <Plus size={20} /> Cadastrar Bilhete Manualmente
                                            </button>
                                        </form>
                                    </div>
                                ) : (
                                    <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h4 className="text-2xl font-bold text-white flex items-center gap-2"><Ticket className="text-yellow-500" /> Bilhete #{foundTicket.number}</h4>
                                                <p className="text-zinc-400 text-sm">Comprado em {new Date(foundTicket.purchases?.purchase_date).toLocaleString()}</p>
                                            </div>
                                            <div className="bg-black px-4 py-2 rounded text-zinc-400 font-mono text-sm">ID: {foundTicket.id}</div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <p className="label-admin">Dono Atual</p>
                                                <div className="text-lg font-bold text-white mb-1">{foundTicket.owner_cpf}</div>
                                                <div className="text-sm text-zinc-500">Tel: {foundTicket.purchases?.phone}</div>
                                            </div>

                                            <div className="bg-zinc-900 p-4 rounded-lg border border-yellow-900/30">
                                                <label className="label-admin text-yellow-500">Transferir para novo CPF</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Novo CPF (apenas números)" 
                                                        className="input-admin" 
                                                        value={newOwnerCpf}
                                                        onChange={e => setNewOwnerCpf(formatCPF(e.target.value))}
                                                        maxLength={14}
                                                    />
                                                    <button onClick={handleUpdateTicketOwner} className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-4 rounded-lg">Salvar</button>
                                                </div>
                                                <p className="text-xs text-zinc-500 mt-2">Isso altera apenas este bilhete específico.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                 </div>
            )}
            
            {activeTab === 'sales' && (
                <div className="space-y-6 animate-in fade-in relative">
                    <h3 className="text-xl font-bold text-white">Últimas 100 Vendas</h3>
                    <div className="overflow-x-auto bg-zinc-900 rounded-2xl border border-zinc-800">
                        <table className="w-full text-left text-sm text-zinc-400">
                            <thead className="bg-zinc-950 text-xs uppercase font-bold text-zinc-500">
                                <tr>
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Rifa</th>
                                    <th className="p-4">Cliente (Nome)</th>
                                    <th className="p-4">CPF</th>
                                    <th className="p-4">Telefone</th>
                                    <th className="p-4">Qtd</th>
                                    <th className="p-4">Valor</th>
                                    <th className="p-4">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {purchases.map(p => (
                                    <tr key={p.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4 whitespace-nowrap">{new Date(p.purchase_date).toLocaleDateString()} <span className="text-zinc-600">{new Date(p.purchase_date).toLocaleTimeString()}</span></td>
                                        <td className="p-4 text-white font-medium">{p.raffles?.name || '---'}</td>
                                        <td className="p-4 text-white font-bold">{p.name || 'Sem nome'}</td>
                                        <td className="p-4 font-mono">{p.cpf}</td>
                                        <td className="p-4">{p.phone}</td>
                                        <td className="p-4 text-white font-bold">{p.quantity}</td>
                                        <td className="p-4 text-green-500 font-bold">R$ {p.total_value.toFixed(2)}</td>
                                        <td className="p-4 flex gap-2">
                                            <button 
                                                onClick={() => handleViewTickets(p)} 
                                                title="Ver bilhetes"
                                                className="p-2 text-zinc-400 hover:text-yellow-500 bg-zinc-950 rounded hover:bg-zinc-800 transition-colors"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button 
                                                onClick={() => setEditPurchase(p)} 
                                                className="text-blue-400 hover:text-white hover:underline text-xs flex items-center px-2"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* VIEW TICKETS MODAL */}
                    {viewingPurchaseTickets && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Ticket className="text-yellow-500"/> Bilhetes da Compra
                                        </h3>
                                        <p className="text-zinc-400 text-sm mt-1">
                                            Cliente: <span className="text-white font-bold">{viewingPurchaseTickets.info.name}</span>
                                        </p>
                                        <p className="text-zinc-500 text-xs">
                                            Rifa: {viewingPurchaseTickets.info.raffles?.name}
                                        </p>
                                    </div>
                                    <button onClick={() => setViewingPurchaseTickets(null)} className="text-zinc-500 hover:text-white">
                                        <X size={24} />
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto bg-black/30 rounded-xl p-4 border border-zinc-800 custom-scrollbar">
                                    {viewingPurchaseTickets.numbers.length === 0 ? (
                                        <p className="text-zinc-500 text-center py-8">Nenhum bilhete encontrado (Erro de dados).</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {viewingPurchaseTickets.numbers.map(num => (
                                                <span key={num} className="font-mono text-lg font-bold text-yellow-500 bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg min-w-[80px] text-center">
                                                    {String(num).padStart(5, '0')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-4 text-right text-zinc-500 text-xs">
                                    Total de {viewingPurchaseTickets.numbers.length} cotas
                                </div>
                            </div>
                        </div>
                    )}

                     {editPurchase && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md">
                                <h3 className="text-xl font-bold text-white mb-4">Editar Dados da Compra</h3>
                                <form onSubmit={handleUpdatePurchase} className="space-y-4">
                                    <div>
                                        <label className="label-admin">Nome do Cliente</label>
                                        <input className="input-admin" value={editPurchase.name || ''} onChange={e => setEditPurchase({...editPurchase, name: formatName(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="label-admin">CPF do Cliente</label>
                                        <input className="input-admin" value={editPurchase.cpf} onChange={e => setEditPurchase({...editPurchase, cpf: formatCPF(e.target.value)})} maxLength={14} />
                                    </div>
                                    <div>
                                        <label className="label-admin">Telefone</label>
                                        <input className="input-admin" value={editPurchase.phone} onChange={e => setEditPurchase({...editPurchase, phone: formatPhone(e.target.value)})} maxLength={15} />
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                        <button type="button" onClick={() => setEditPurchase(null)} className="flex-1 bg-zinc-800 py-3 rounded-lg text-white hover:bg-zinc-700">Cancelar</button>
                                        <button className="flex-1 bg-blue-600 py-3 rounded-lg text-white font-bold hover:bg-blue-500">Salvar Dados</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'simulation' && (
                <AdminSimulation raffles={raffles} />
            )}

             {activeTab === 'site' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-6">Banners da Home</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {banners.map(b => (
                                <div key={b.id} className="group relative aspect-video rounded-xl overflow-hidden border border-zinc-700">
                                    <img src={b.image_url} className="w-full h-full object-cover" alt="" />
                                    <button onClick={() => handleDeleteBanner(b.id)} className="absolute top-2 right-2 bg-red-600 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddBanner} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="label-admin">Adicionar URL de Imagem</label>
                                <input placeholder="https://..." className="input-admin" value={newBannerUrl} onChange={e => setNewBannerUrl(e.target.value)} />
                            </div>
                            <button className="md:mt-6 bg-green-600 hover:bg-green-500 text-white font-bold px-6 rounded-lg h-[46px]">Adicionar</button>
                        </form>
                        <p className="text-xs text-zinc-500 mt-2">* Certifique-se de que a tabela 'banners' foi criada no Supabase.</p>
                    </div>
                </div>
            )}
        </div>
      </main>
       <style>{`
        .label-admin { display: block; font-size: 0.75rem; color: #a1a1aa; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; }
        .input-admin { width: 100%; background-color: #09090b; border: 1px solid #27272a; border-radius: 0.5rem; padding: 0.75rem; color: white; outline: none; transition: border-color 0.2s; }
        .input-admin:focus { border-color: #ca8a04; }
        .btn-icon { padding: 0.5rem; border-radius: 0.5rem; color: #a1a1aa; transition: all; }
      `}</style>
    </div>
  );
};