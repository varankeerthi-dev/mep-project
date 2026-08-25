import type { PartyOption } from '../components/PartySelector';

export type PartyRole = 'customer' | 'vendor' | 'subcontractor';

/** Canonical party fields used by migrated commercial documents. */
export interface PartyDocumentFields {
  party_id: string | null;
  party_role: PartyRole | null;
}

/**
 * Keeps legacy client_id compatible while making Party the canonical source.
 * Existing documents can still resolve their legacy client relationship until
 * their data is fully backfilled.
 */
export function toPartyDocumentFields(party: PartyOption | null): PartyDocumentFields {
  return party
    ? { party_id: party.id, party_role: party.role }
    : { party_id: null, party_role: null };
}

export function isPartyRole(value: unknown): value is PartyRole {
  return value === 'customer' || value === 'vendor' || value === 'subcontractor';
}

export function normalizePartyRole(value: unknown, fallback: PartyRole = 'customer'): PartyRole {
  return isPartyRole(value) ? value : fallback;
}
