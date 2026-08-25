export type PartyRole = 'customer' | 'vendor' | 'subcontractor';
export type BalanceType = 'debit' | 'credit';

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
