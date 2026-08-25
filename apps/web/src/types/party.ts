export type PartyRole = 'customer' | 'vendor' | 'subcontractor';
export type BalanceType = 'debit' | 'credit';

export interface Party {
  id: string;
  organisation_id: string;
  name: string;
  gstin?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  address?: string | null;
  status: 'Active' | 'Inactive';
  roles: PartyRole[];
  created_at?: string;
  updated_at?: string;
}

export interface PartySearchResult {
  party_id: string;
  organisation_id: string;
  party_name: string;
  gstin?: string | null;
  state?: string | null;
  email?: string | null;
  contact?: string | null;
  roles: PartyRole[];
}

export interface CreatePartyInput {
  organisation_id: string;
  name: string;
  roles: PartyRole[];
  gstin?: string;
  state?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  address?: string;
}

export interface PartySubledgerBalance {
  party_id: string;
  party_role: PartyRole;
  party_name: string;
  financial_year: string;
  opening_balance: number;
  opening_balance_type: BalanceType;
  total_debit: number;
  total_credit: number;
  current_balance: number;
}
