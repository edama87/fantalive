/**
 * Database Types
 * 
 * Types matching the Supabase schema, used by both the real
 * Supabase client and the local mock implementation.
 */

export interface DbTeam {
  id: string;
  name: string;
  manager_name: string;
  /** Solo lato server (chiave segreta): non leggibile con la chiave pubblica. */
  manager_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPlayer {
  id: string;
  name: string;
  role: 'P' | 'D' | 'C' | 'A';
  real_team: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbRosterVersion {
  id: string;
  team_id: string;
  version_number: number;
  effective_from: string;
  effective_until: string | null;
  credits_remaining: number;
  market_credits: number;
  notes: string | null;
  created_at: string;
}

export interface DbRosterPlayer {
  id: string;
  roster_version_id: string;
  player_id: string;
  acquisition_type: 'auction' | 'market' | 'initial';
  acquisition_price: number;
  acquired_at: string;
}

export type ReleaseReason = 'still_in_serie_a' | 'left_serie_a' | 'retired' | 'long_term_injury';
export type TransactionType = 'buy' | 'sell' | 'auction' | 'prestito_in' | 'prestito_out' | 'prestito_return';

export interface DbMarketTransaction {
  id: string;
  team_id: string;
  transaction_type: TransactionType;
  player_id: string;
  credits_paid: number;
  credits_refunded: number;
  market_week: number | null;
  effective_round: number | null;
  release_reason: ReleaseReason | null;
  is_loan: boolean;
  is_injured: boolean;
  loan_return_round: number | null;
  raw_import_data: string | null;
  notes: string | null;
  created_at: string;
}

export interface DbRound {
  number: number;
  serie_a_matchday: number;
  kickoff_date: string;
  kickoff_time: string | null;
  pairing_cycle: string;
  is_home_swapped: boolean;
  lineup_deadline: string | null;
  status: 'scheduled' | 'live' | 'finished';
  created_at: string;
}

export interface DbMarketWindow {
  id: string;
  week_number: number;
  opens_at: string;
  closes_at: string;
  effective_round: number;
  is_january_block: boolean;
  status: 'scheduled' | 'open' | 'closed' | 'processing' | 'completed';
  created_at: string;
}

export interface RosterWithPlayers extends DbRosterVersion {
  players: Array<DbRosterPlayer & { player: DbPlayer }>;
}

export interface MarketTransactionWithDetails extends DbMarketTransaction {
  player: DbPlayer;
  team: DbTeam;
}

export interface BulkMarketImport {
  team_id: string;
  player_out_id: string;
  player_in_id: string;
  credits_paid: number;
}
