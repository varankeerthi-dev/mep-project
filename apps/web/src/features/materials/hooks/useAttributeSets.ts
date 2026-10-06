import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  normalizeAttributeSetLines,
  type AttributeSet,
  type AttributeSetLine,
} from '../model/attributes/attributeSets';

export type { AttributeSet, AttributeSetLine };

const MAX_SETS = 100;
const MAX_LINES = 50;

function isMissingTable(error: any): boolean {
  const msg = String(error?.message || '');
  return (error?.code === '42P01' || msg.includes('does not exist')) && msg.includes('material_attribute_sets');
}

export function useAttributeSets() {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? null;
  const queryClient = useQueryClient();
  const [mutating, setMutating] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const query = useQuery<AttributeSet[]>({
    queryKey: ['attribute-sets', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      try {
        const { data, error } = await supabase
          .from('material_attribute_sets')
          .select('id, organisation_id, name, lines')
          .eq('organisation_id', orgId)
          .order('name')
          .limit(MAX_SETS);
        if (error) throw error;
        return ((data || []) as any[]).map((row) => ({
          id: row.id,
          organisation_id: row.organisation_id,
          name: row.name,
          lines: Array.isArray(row.lines) ? row.lines : [],
        }));
      } catch (error: any) {
        if (isMissingTable(error)) {
          setTableMissing(true);
          return [];
        }
        throw error;
      }
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['attribute-sets', orgId] });

  const saveSet = async (name: string, lines: AttributeSetLine[]): Promise<{ ok: boolean; message: string }> => {
    const cleanName = name.trim();
    if (!orgId) return { ok: false, message: 'Organisation not found. Please try again.' };
    if (!cleanName) return { ok: false, message: 'Give the set a name first.' };
    const cleanLines = normalizeAttributeSetLines(lines, MAX_LINES);
    if (cleanLines.length === 0) return { ok: false, message: 'Add at least one named attribute before saving a set.' };
    setMutating(true);
    try {
      const { error } = await supabase.from('material_attribute_sets').insert({
        organisation_id: orgId,
        name: cleanName,
        lines: cleanLines,
      });
      if (error) throw error;
      await refresh();
      return { ok: true, message: `Saved set "${cleanName}" with ${cleanLines.length} attributes.` };
    } catch (error: any) {
      if (isMissingTable(error)) {
        setTableMissing(true);
        return { ok: false, message: 'Attribute sets need migration 20261001000006, which is not applied yet.' };
      }
      if (String(error?.code) === '23505') {
        return { ok: false, message: `A set named "${cleanName}" already exists.` };
      }
      return { ok: false, message: `Could not save set: ${error?.message || 'unknown error'}` };
    } finally {
      setMutating(false);
    }
  };

  const deleteSet = async (id: string): Promise<boolean> => {
    setMutating(true);
    try {
      const { error } = await supabase.from('material_attribute_sets').delete().eq('id', id);
      if (error) throw error;
      await refresh();
      return true;
    } catch {
      return false;
    } finally {
      setMutating(false);
    }
  };

  return { sets: query.data || [], loading: query.isLoading, mutating, tableMissing, saveSet, deleteSet };
}
