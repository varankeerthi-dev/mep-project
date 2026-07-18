import { supabase } from '@/supabase';
import type { BOQHeaderInput, BOQSectionInput, BOQItemInput } from '../model';

const TABLE = {
  headers: 'est_boq_headers',
  sections: 'est_boq_sections',
  items: 'est_boq_items',
};

export type BOQFilterParams = {
  search?: string;
  status?: string;
  organisation_id: string;
};

export async function listBOQs(filters: BOQFilterParams) {
  let query = supabase
    .from(TABLE.headers)
    .select('*, client:clients(id, client_name), project:projects(id, project_name)')
    .eq('organisation_id', filters.organisation_id)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    query = query.or(`boq_no.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBOQById(id: string) {
  const { data, error } = await supabase
    .from(TABLE.headers)
    .select('*, client:clients(id, client_name), project:projects(id, project_name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createBOQ(input: BOQHeaderInput) {
  const { data, error } = await supabase
    .from(TABLE.headers)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBOQ(id: string, input: Partial<BOQHeaderInput>) {
  const { data, error } = await supabase
    .from(TABLE.headers)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBOQ(id: string) {
  const { error } = await supabase.from(TABLE.headers).delete().eq('id', id);
  if (error) throw error;
}

export async function listSections(boqId: string) {
  const { data, error } = await supabase
    .from(TABLE.sections)
    .select('*')
    .eq('boq_id', boqId)
    .order('section_order');
  if (error) throw error;
  return data || [];
}

export async function createSection(input: BOQSectionInput) {
  const { data, error } = await supabase
    .from(TABLE.sections)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSection(id: string, input: Partial<BOQSectionInput>) {
  const { data, error } = await supabase
    .from(TABLE.sections)
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSection(id: string) {
  const { error } = await supabase.from(TABLE.sections).delete().eq('id', id);
  if (error) throw error;
}

export async function listItems(sectionId: string) {
  const { data, error } = await supabase
    .from(TABLE.items)
    .select('*')
    .eq('section_id', sectionId)
    .order('item_order');
  if (error) throw error;
  return data || [];
}

export async function listAllItems(boqId: string) {
  const { data, error } = await supabase
    .from(TABLE.items)
    .select('*, section:est_boq_sections(id, name)')
    .in('section_id', (
      await supabase.from(TABLE.sections).select('id').eq('boq_id', boqId)
    ).data?.map(s => s.id) || [])
    .order('item_order');
  if (error) throw error;
  return data || [];
}

export async function createItem(input: BOQItemInput) {
  const { data, error } = await supabase
    .from(TABLE.items)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createItems(inputs: BOQItemInput[]) {
  const { data, error } = await supabase
    .from(TABLE.items)
    .insert(inputs)
    .select();
  if (error) throw error;
  return data || [];
}

export async function updateItem(id: string, input: Partial<BOQItemInput>) {
  const { data, error } = await supabase
    .from(TABLE.items)
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from(TABLE.items).delete().eq('id', id);
  if (error) throw error;
}
