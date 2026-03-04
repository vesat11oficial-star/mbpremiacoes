import { supabase } from './supabaseClient';
import { Raffle, RaffleStatus, Purchase, Banner, WinningTicket, PurchaseResult } from '../types';

export const raffleService = {
  // --- PUBLIC METHODS ---

  async getBanners(): Promise<string[]> {
    const { data, error } = await supabase
      .from('banners')
      .select('image_url')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return []; 
    }
    return data.map(b => b.image_url);
  },

  async getAllRaffles(): Promise<Raffle[]> {
    const { data, error } = await supabase
      .from('raffles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rafflesWithCount = await Promise.all(data.map(async (r: any) => {
        const { count } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('raffle_id', r.id);

        return {
            id: r.id,
            name: r.name,
            description: r.description,
            fullDescription: r.full_description,
            imageUrl: r.image_url,
            totalNumbers: r.total_numbers,
            soldNumbers: count || 0,
            fakeSoldNumbers: r.fake_sold_numbers || 0,
            pricePerNumber: r.price_per_number,
            minPurchase: r.min_purchase || 1,
            status: r.status as RaffleStatus,
            winnerNumber: r.winner_number,
            winnerName: r.winner_name
        };
    }));

    return rafflesWithCount;
  },

  async getRaffleById(id: string): Promise<Raffle | undefined> {
    const { data, error } = await supabase
      .from('raffles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('raffle_id', id);

    return {
        id: data.id,
        name: data.name,
        description: data.description,
        fullDescription: data.full_description,
        imageUrl: data.image_url,
        totalNumbers: data.total_numbers,
        soldNumbers: count || 0,
        fakeSoldNumbers: data.fake_sold_numbers || 0,
        pricePerNumber: data.price_per_number,
        minPurchase: data.min_purchase || 1,
        status: data.status as RaffleStatus,
        winnerNumber: data.winner_number,
        winnerName: data.winner_name
    };
  },

  async getPublicWinningTickets(raffleId: string): Promise<WinningTicket[]> {
      const { data, error } = await supabase
        .from('winning_tickets')
        .select('id, ticket_number, prize_description, is_sold, winner_name, is_active, raffle_id')
        .eq('raffle_id', raffleId)
        .order('ticket_number', { ascending: true });

      if (error || !data) return [];

      return data.map(t => ({
          id: t.id,
          raffleId: t.raffle_id,
          ticketNumber: t.ticket_number,
          prizeDescription: t.prize_description,
          isActive: t.is_active,
          isSold: t.is_sold,
          winnerName: t.winner_name
      }));
  },

  // NEW: Get recent winners across all raffles for the homepage
  async getRecentGlobalWinners(limit = 10): Promise<any[]> {
    const { data, error } = await supabase
        .from('winning_tickets')
        .select('winner_name, prize_description, raffles(name)')
        .eq('is_sold', true)
        .order('id', { ascending: false }) // Assuming ID increments roughly with time or use a updated_at if available
        .limit(limit);

    if (error || !data) return [];

    return data.map((item: any) => ({
        name: item.winner_name,
        prize: item.prize_description,
        raffleName: item.raffles?.name,
        type: 'INSTANT' // To distinguish from main raffle winners
    }));
  },

  // --- SECURE PURCHASE METHOD ---
  async purchaseTickets(
    raffleId: string,
    quantity: number,
    name: string,
    cpf: string,
    phone: string
  ): Promise<PurchaseResult> {
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');

    // Get current price to send to backend (extra validation happens on backend)
    const raffle = await this.getRaffleById(raffleId);
    if (!raffle) return { success: false, numbers: [], message: 'Rifa inválida.' };
    
    const totalValue = quantity * raffle.pricePerNumber;

    // Call the Postgres RPC function 'buy_tickets'
    // This moves all logic (random generation, availability check, database insertion) to the server side.
    const { data, error } = await supabase.rpc('buy_tickets', {
        p_raffle_id: raffleId,
        p_quantity: quantity,
        p_name: name,
        p_cpf: cleanCpf,
        p_phone: cleanPhone,
        p_total_value: totalValue
    });

    if (error) {
        console.error("RPC Error:", error);
        return { success: false, numbers: [], message: 'Erro ao processar compra no servidor.' };
    }

    if (!data.success) {
        return { success: false, numbers: [], message: data.message };
    }

    // Convert wonPrizes from JSONB if exists
    const wonPrizes = data.wonPrizes ? data.wonPrizes : [];

    return { 
        success: true, 
        numbers: data.numbers, 
        wonPrizes: wonPrizes
    };
  },

  async getMyTickets(cpf: string): Promise<Purchase[]> {
    const cleanCpf = cpf.replace(/\D/g, '');
    
    const { data: purchases, error } = await supabase
        .from('purchases')
        .select('*, raffles(name, status)')
        .eq('cpf', cleanCpf)
        .order('purchase_date', { ascending: false });

    if (error) return [];

    const fullPurchases = await Promise.all(purchases.map(async (p: any) => {
        const { data: tickets } = await supabase
            .from('tickets')
            .select('number')
            .eq('purchase_id', p.id);
        
        return {
            id: p.id,
            name: p.name,
            cpf: p.cpf,
            phone: p.phone,
            raffleId: p.raffle_id,
            raffleName: p.raffles?.name,
            raffleStatus: p.raffles?.status,
            raffleUpdatedAt: undefined, // updated_at column might be missing, disabling filter for now to ensure visibility
            quantity: p.quantity,
            totalValue: p.total_value,
            purchaseDate: p.purchase_date,
            ticketNumbers: tickets?.map((t: any) => t.number).sort((a: number, b: number) => a - b) || []
        };
    }));

    return fullPurchases;
  },

  // --- SIMULATION METHODS ---
  async getSimulationNumbers(raffleId: string, quantity: number): Promise<{ numbers: number[], winningNumber: number | null }> {
    const { data, error } = await supabase.rpc('get_simulation_numbers', {
        p_raffle_id: raffleId,
        p_quantity: quantity
    });

    if (error) throw error;
    return {
        numbers: data.numbers || [],
        winningNumber: data.winningNumber
    };
  },

  // --- ADMIN METHODS ---

  async adminGetWinningTickets(raffleId: string): Promise<WinningTicket[]> {
      const { data } = await supabase
        .from('winning_tickets')
        .select('*')
        .eq('raffle_id', raffleId)
        .order('ticket_number', { ascending: true });
        
      if (!data) return [];
      
      return data.map(t => ({
          id: t.id,
          raffleId: t.raffle_id,
          ticketNumber: t.ticket_number,
          prizeDescription: t.prize_description,
          isActive: t.is_active,
          isSold: t.is_sold,
          winnerName: t.winner_name
      }));
  },

  async adminCreateWinningTicket(raffleId: string, number: number, prize: string) {
      const { error } = await supabase.from('winning_tickets').insert({
          raffle_id: raffleId,
          ticket_number: number,
          prize_description: prize,
          is_active: false // Start inactive (locked) by default
      });
      if (error) throw error;
  },

  async adminToggleWinningTicket(id: string, isActive: boolean) {
      const { error } = await supabase.from('winning_tickets').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
  },

  async adminDeleteWinningTicket(id: string) {
      const { error } = await supabase.from('winning_tickets').delete().eq('id', id);
      if (error) throw error;
  },
  
  async adminManualAssignWinner(winningTicketId: string, raffleId: string, number: number, name: string, cpf: string, phone: string) {
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');

    const { data: existing } = await supabase.from('tickets').select('id').eq('raffle_id', raffleId).eq('number', number).single();
    if (existing) {
        throw new Error('Este número já foi vendido para outra pessoa.');
    }

    const { data: purchase, error: pError } = await supabase.from('purchases').insert({
        raffle_id: raffleId,
        name: name,
        cpf: cleanCpf,
        phone: cleanPhone,
        quantity: 1,
        total_value: 0,
        purchase_date: new Date().toISOString()
    }).select().single();

    if (pError) throw pError;

    const { error: tError } = await supabase.from('tickets').insert({
        raffle_id: raffleId,
        purchase_id: purchase.id,
        number: number,
        owner_cpf: cleanCpf
    });

    if (tError) throw tError;

    const { error: wError } = await supabase.from('winning_tickets').update({
        is_sold: true,
        winner_name: name,
        winner_cpf: cleanCpf,
        purchase_id: purchase.id
    }).eq('id', winningTicketId);

    if (wError) throw wError;
  },

  async adminCreateManualTicket(raffleId: string, number: number, name: string, cpf: string, phone: string) {
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');

    const { data: existing } = await supabase.from('tickets').select('id').eq('raffle_id', raffleId).eq('number', number).single();
    if (existing) {
        throw new Error('Este número já foi vendido.');
    }

    const { data: purchase, error: pError } = await supabase.from('purchases').insert({
        raffle_id: raffleId,
        name: name,
        cpf: cleanCpf,
        phone: cleanPhone,
        quantity: 1,
        total_value: 0,
        purchase_date: new Date().toISOString()
    }).select().single();

    if (pError) throw pError;

    const { error: tError } = await supabase.from('tickets').insert({
        raffle_id: raffleId,
        purchase_id: purchase.id,
        number: number,
        owner_cpf: cleanCpf
    });

    if (tError) throw tError;

    const { data: winningTicket } = await supabase.from('winning_tickets').select('id').eq('raffle_id', raffleId).eq('ticket_number', number).single();
    
    if (winningTicket) {
        await supabase.from('winning_tickets').update({
            is_sold: true,
            winner_name: name,
            winner_cpf: cleanCpf,
            purchase_id: purchase.id
        }).eq('id', winningTicket.id);
    }
    
    return purchase;
  },

  // --- PAYMENT HELPERS ---

  subscribeToPayment(externalId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`payment:${externalId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `external_id=eq.${externalId}`,
        },
        callback
      )
      .subscribe();
  },

  unsubscribeFromPayment(channel: any) {
    supabase.removeChannel(channel);
  },

  async getPurchaseByExternalId(externalId: string): Promise<Purchase | null> {
    // We need to find the purchase that was created by the webhook
    // The webhook uses the metadata from the payment
    
    // First, let's get the payment to see the user_id (CPF) and raffle_id
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('external_id', externalId)
      .single();

    if (!payment || payment.status !== 'COMPLETED') return null;

    const { raffleId } = payment.metadata;
    const cpf = payment.user_id;

    // Now find the purchase in the purchases table
    // We look for the most recent purchase for this CPF and Raffle
    const { data: purchase, error } = await supabase
      .from('purchases')
      .select('*, raffles(name, status)')
      .eq('cpf', cpf)
      .eq('raffle_id', raffleId)
      .order('purchase_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !purchase) return null;

    const { data: tickets } = await supabase
      .from('tickets')
      .select('number')
      .eq('purchase_id', purchase.id);

    return {
      id: purchase.id,
      name: purchase.name,
      cpf: purchase.cpf,
      phone: purchase.phone,
      raffleId: purchase.raffle_id,
      raffleName: purchase.raffles?.name,
      raffleStatus: purchase.raffles?.status,
      raffleUpdatedAt: undefined,
      quantity: purchase.quantity,
      totalValue: purchase.total_value,
      purchaseDate: purchase.purchase_date,
      ticketNumbers: tickets?.map((t: any) => t.number).sort((a: number, b: number) => a - b) || []
    };
  },

  async adminGetBanners() {
      const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
      return data || [];
  },

  async adminCreateBanner(imageUrl: string) {
      const { error } = await supabase.from('banners').insert({ image_url: imageUrl, active: true });
      if (error) throw error;
  },

  async adminDeleteBanner(id: string) {
      const { error } = await supabase.from('banners').delete().eq('id', id);
      if (error) throw error;
  },

  async createRaffle(data: Partial<Raffle>) {
      const payload = {
          name: data.name,
          description: data.description,
          full_description: data.fullDescription,
          image_url: data.imageUrl,
          total_numbers: data.totalNumbers,
          price_per_number: data.pricePerNumber,
          min_purchase: data.minPurchase || 1,
          fake_sold_numbers: data.fakeSoldNumbers || 0,
          status: 'ACTIVE'
      };
      
      const { data: created, error } = await supabase.from('raffles').insert(payload).select().single();
      
      if (error) {
          console.error("Erro ao criar rifa:", error);
          throw error;
      }
      return created;
  },

  async updateRaffle(id: string, updates: any) {
     const { data, error } = await supabase.from('raffles').update(updates).eq('id', id).select();
     if (error) {
         console.error("Erro ao atualizar rifa:", error);
         throw error;
     }
     return data;
  },

  async getTicketOwner(raffleId: string, number: number) {
      return await supabase
        .from('tickets')
        .select('*, purchases(phone, cpf, purchase_date, name)')
        .eq('raffle_id', raffleId)
        .eq('number', number)
        .single();
  },

  async adminUpdateTicketOwner(ticketId: string, newCpf: string) {
      const { error } = await supabase.from('tickets').update({ owner_cpf: newCpf }).eq('id', ticketId);
      if (error) throw error;
  },

  async adminGetAllPurchases(limit = 50) {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, raffles(name)')
        .order('purchase_date', { ascending: false })
        .limit(limit);
      
      if(error) throw error;
      return data;
  },

  async adminUpdatePurchase(purchaseId: string, updates: { phone?: string, cpf?: string, name?: string }) {
      const { error } = await supabase.from('purchases').update(updates).eq('id', purchaseId);
      if (error) throw error;
      
      if (updates.cpf) {
          const { error: ticketError } = await supabase.from('tickets').update({ owner_cpf: updates.cpf }).eq('purchase_id', purchaseId);
          if (ticketError) throw ticketError;
      }
      return { error: null };
  },

  async adminGetTicketsByPurchase(purchaseId: string): Promise<number[]> {
      const { data, error } = await supabase
        .from('tickets')
        .select('number')
        .eq('purchase_id', purchaseId)
        .order('number', { ascending: true });

      if (error || !data) return [];
      return data.map(t => t.number);
  },

  // NEW METHOD: Flexible Dashboard Stats with Date Filters
  async getDashboardStats(startDate: string | null, endDate: string | null) {
      let query = supabase.from('purchases').select('total_value, purchase_date, quantity');

      if (startDate) {
          query = query.gte('purchase_date', startDate);
      }
      if (endDate) {
          query = query.lte('purchase_date', endDate);
      }

      const { data: purchases, error } = await query;
      if (error || !purchases) return { totalRevenue: 0, salesCount: 0, avgTicket: 0, chartData: [], activeRaffles: 0 };

      // Calculate aggregates
      const totalRevenue = purchases.reduce((acc, p) => acc + (p.total_value || 0), 0);
      const salesCount = purchases.length;
      const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;

      // Group for chart (Group by Day)
      const grouped: Record<string, number> = {};
      purchases.forEach(p => {
          // If viewing "Today" only (start == end and it's today), maybe we could group by hour? 
          // For simplicity, let's keep daily grouping or "today" just shows one bar if filtered strict.
          // To make it look "robust", if the range is small (1 day), we group by hour.
          
          let key;
          const dateObj = new Date(p.purchase_date);
          
          if (startDate && endDate && startDate.split('T')[0] === endDate.split('T')[0]) {
              // Group by Hour if filtering single day
              key = `${dateObj.getHours()}h`;
          } else {
              // Group by Date
              key = dateObj.toLocaleDateString('pt-BR');
          }
          
          grouped[key] = (grouped[key] || 0) + p.total_value;
      });

      // Fill gaps? Not strictly necessary for this MVP but looks better. 
      // We'll just map existing data.
      const chartData = Object.entries(grouped).map(([name, value]) => ({ name, value }));

      // Fetch active raffles count (snapshot, not historical)
      const { count: activeRaffles } = await supabase
        .from('raffles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE');

      return {
          totalRevenue,
          salesCount,
          avgTicket,
          chartData,
          activeRaffles: activeRaffles || 0
      };
  }
};