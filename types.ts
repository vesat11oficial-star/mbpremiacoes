export enum RaffleStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED'
}

export interface Raffle {
  id: string;
  name: string;
  description: string;
  fullDescription: string;
  imageUrl: string;
  totalNumbers: number;
  soldNumbers: number; // Real sales count
  fakeSoldNumbers?: number; // Manual override for display
  pricePerNumber: number;
  minPurchase: number;
  status: RaffleStatus;
  winnerNumber?: number | null;
  winnerName?: string | null;
}

export interface WinningTicket {
  id: string;
  raffleId: string;
  ticketNumber: number;
  prizeDescription: string;
  isActive: boolean;
  isSold: boolean;
  winnerName?: string;
}

export interface Purchase {
  id: string;
  name: string; // Added name
  cpf: string;
  phone: string;
  raffleId: string;
  raffleName?: string; // For admin display
  raffleStatus?: RaffleStatus;
  raffleUpdatedAt?: string;
  quantity: number;
  totalValue: number;
  purchaseDate: string;
  ticketNumbers: number[]; 
}

export interface Banner {
  id: string;
  image_url: string;
  active: boolean;
}

// Helper type for Supabase raw response if needed
export interface DB_Purchase {
  id: string;
  raffle_id: string;
  name: string;
  cpf: string;
  phone: string;
  quantity: number;
  total_value: number;
  purchase_date: string;
}

export interface PurchaseResult {
  success: boolean; 
  numbers: number[]; 
  message?: string;
  wonPrizes?: { number: number; prize: string }[]; // New field for instant wins
}