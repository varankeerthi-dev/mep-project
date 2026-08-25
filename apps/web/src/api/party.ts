import { supabase } from '@/supabase';
import { PartySearchResult, CreatePartyInput, PartySubledgerBalance, Party } from '@/types/party';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export async function searchParties(orgId: string, search: string): Promise<PartySearchResult[]> {
  if (!orgId) return [];

  const { data, error } = await supabase
    .from('v_party_search')
    .select('*')
    .eq('organisation_id', orgId)
    .ilike('party_name', `%${search}%`)
    .limit(20);

  if (error) throw error;
  return data as PartySearchResult[];
}

export async function createParty(input: CreatePartyInput): Promise<Party> {
  const { data: party, error: partyError } = await supabase
    .from('parties')
    .insert({
      organisation_id: input.organisation_id,
      name: input.name,
      gstin: input.gstin || null,
      state: input.state || null,
      email: input.email || null,
      phone: input.phone || null,
      contact_person: input.contact_person || null,
      address: input.address || null,
      status: 'Active',
    })
    .select('*')
    .single();

  if (partyError) throw partyError;

  if (input.roles && input.roles.length > 0) {
    const roleRows = input.roles.map((r) => ({
      party_id: party.id,
      role: r,
    }));

    const { error: roleError } = await supabase.from('party_roles').insert(roleRows);
    if (roleError) throw roleError;
  }

  return { ...party, roles: input.roles };
}

export async function fetchPartySubledgerBalances(
  orgId: string,
  financialYear: string
): Promise<PartySubledgerBalance[]> {
  const { data, error } = await supabase.rpc('get_party_ledger_balances', {
    p_organisation_id: orgId,
    p_financial_year: financialYear,
  });

  if (error) throw error;
  return data as PartySubledgerBalance[];
}

export function usePartySearch(orgId: string, searchTerm: string) {
  return useQuery({
    queryKey: ['party-search', orgId, searchTerm],
    queryFn: () => searchParties(orgId, searchTerm),
    enabled: Boolean(orgId && searchTerm.trim().length >= 1),
    staleTime: 30000,
  });
}

export function useCreateParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePartyInput) => createParty(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['party-search', variables.organisation_id] });
    },
  });
}
