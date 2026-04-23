import { supabase } from '@/supabase';
import {
  employeeSchema,
  orgAccessRequestSchema,
  roleSchema,
  rolePermissionSchema,
  type EmployeeInput,
  type OrgAccessRequestInput,
  type PermissionKey,
  type RoleInput,
} from './schemas';

export async function hasPermission(userId: string, organisationId: string, permissionKey: PermissionKey): Promise<boolean> {
  // Check if user is admin (full access)
  const { data: orgMember } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organisation_id', organisationId)
    .single();

  if (orgMember?.role === 'admin') return true;

  // Check role permissions
  const { data: roleData } = await supabase
    .from('org_members')
    .select('role_id')
    .eq('user_id', userId)
    .eq('organisation_id', organisationId)
    .single();

  if (!roleData?.role_id) return false;

  const { data: permission } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('role_id', roleData.role_id)
    .eq('permission_key', permissionKey)
    .single();

  return !!permission;
}

export type PublicOrganisation = {
  id: string;
  name: string;
};

export type OrgAccessRequestRow = {
  id: string;
  organisation_id: string;
  user_id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  organisation?: PublicOrganisation | null;
};

export type EmployeeRow = {
  id: string;
  organisation_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string | null;
};

export type RoleRow = {
  id: string;
  organisation_id: string;
  name: string;
  is_system: boolean;
  created_at?: string;
};

export async function listPublicOrganisations(): Promise<PublicOrganisation[]> {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, name')
    .eq('allow_access_requests', true)
    .eq('is_listed', true)
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? 'Organisation'),
  }));
}

export async function listMyAccessRequests(userId: string): Promise<OrgAccessRequestRow[]> {
  const { data, error } = await supabase
    .from('org_access_requests')
    .select('id, organisation_id, user_id, email, status, requested_at, reviewed_by, reviewed_at, review_note, organisation:organisations(id, name)')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    organisation_id: String(row.organisation_id),
    user_id: String(row.user_id),
    email: String(row.email),
    status: row.status,
    requested_at: row.requested_at ?? undefined,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at ?? null,
    review_note: row.review_note ?? null,
    organisation: row.organisation
      ? { id: String(row.organisation.id), name: String(row.organisation.name ?? 'Organisation') }
      : null,
  }));
}

export async function createAccessRequest(input: OrgAccessRequestInput): Promise<OrgAccessRequestRow> {
  const parsed = orgAccessRequestSchema.parse(input);
  const { data, error } = await supabase
    .from('org_access_requests')
    .insert({
      organisation_id: parsed.organisation_id,
      user_id: parsed.user_id,
      email: parsed.email,
      status: parsed.status,
      review_note: parsed.review_note ?? null,
    })
    .select('id, organisation_id, user_id, email, status, requested_at, reviewed_by, reviewed_at, review_note')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Unable to create access request.');

  return {
    id: String(data.id),
    organisation_id: String(data.organisation_id),
    user_id: String(data.user_id),
    email: String(data.email),
    status: data.status,
    requested_at: data.requested_at ?? undefined,
    reviewed_by: data.reviewed_by ?? null,
    reviewed_at: data.reviewed_at ?? null,
    review_note: data.review_note ?? null,
    organisation: null,
  };
}

export async function listOrgAccessRequests(organisationId: string): Promise<OrgAccessRequestRow[]> {
  const { data, error } = await supabase
    .from('org_access_requests')
    .select('id, organisation_id, user_id, email, status, requested_at, reviewed_by, reviewed_at, review_note')
    .eq('organisation_id', organisationId)
    .order('requested_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    organisation_id: String(row.organisation_id),
    user_id: String(row.user_id),
    email: String(row.email),
    status: row.status,
    requested_at: row.requested_at ?? undefined,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at ?? null,
    review_note: row.review_note ?? null,
    organisation: null,
  }));
}

export async function approveAccessRequest(requestId: string, roleId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_access_request', {
    p_request_id: requestId,
    p_role_id: roleId,
  });
  if (error) throw error;
}

export async function rejectAccessRequest(requestId: string, note?: string | null): Promise<void> {
  const { error } = await supabase.rpc('reject_access_request', {
    p_request_id: requestId,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function listEmployees(organisationId: string): Promise<EmployeeRow[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, organisation_id, full_name, email, phone, status, created_at, updated_at')
    .eq('organisation_id', organisationId)
    .order('full_name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    organisation_id: String(row.organisation_id),
    full_name: String(row.full_name),
    email: String(row.email),
    phone: row.phone ?? null,
    status: row.status,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? null,
  }));
}

export async function upsertEmployee(input: EmployeeInput): Promise<EmployeeRow> {
  const parsed = employeeSchema.parse(input);
  const payload = {
    id: parsed.id,
    organisation_id: parsed.organisation_id,
    full_name: parsed.full_name,
    email: parsed.email,
    phone: parsed.phone ?? null,
    status: parsed.status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('employees')
    .upsert(payload, { onConflict: 'id' })
    .select('id, organisation_id, full_name, email, phone, status, created_at, updated_at')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Unable to save employee.');

  return {
    id: String(data.id),
    organisation_id: String(data.organisation_id),
    full_name: String(data.full_name),
    email: String(data.email),
    phone: data.phone ?? null,
    status: data.status,
    created_at: data.created_at ?? undefined,
    updated_at: data.updated_at ?? null,
  };
}

export async function listRoles(organisationId: string): Promise<RoleRow[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('id, organisation_id, name, is_system, created_at')
    .eq('organisation_id', organisationId)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    organisation_id: String(row.organisation_id),
    name: String(row.name),
    is_system: Boolean(row.is_system),
    created_at: row.created_at ?? undefined,
  }));
}

export async function createRoleWithPermissions(input: RoleInput, permissionKeys: PermissionKey[]): Promise<RoleRow> {
  const parsed = roleSchema.parse(input);

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .insert({
      organisation_id: parsed.organisation_id,
      name: parsed.name,
      is_system: false,
    })
    .select('id, organisation_id, name, is_system, created_at')
    .single();

  if (roleError) throw roleError;
  if (!role) throw new Error('Unable to create role.');

  const roleId = String(role.id);
  if (permissionKeys.length > 0) {
    const { error: permError } = await supabase.from('role_permissions').insert(
      permissionKeys.map((key) => rolePermissionSchema.parse({ role_id: roleId, permission_key: key })),
    );
    if (permError) throw permError;
  }

  return {
    id: roleId,
    organisation_id: String(role.organisation_id),
    name: String(role.name),
    is_system: Boolean(role.is_system),
    created_at: role.created_at ?? undefined,
  };
}

export async function listRolePermissions(roleId: string): Promise<PermissionKey[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('role_id', roleId);

  if (error) throw error;

  return (data ?? []).map((row: any) => String(row.permission_key)) as PermissionKey[];
}

export async function replaceRolePermissions(roleId: string, permissionKeys: PermissionKey[]): Promise<void> {
  const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', roleId);
  if (deleteError) throw deleteError;

  if (permissionKeys.length === 0) return;

  const { error: insertError } = await supabase.from('role_permissions').insert(
    permissionKeys.map((key) => rolePermissionSchema.parse({ role_id: roleId, permission_key: key })),
  );
  if (insertError) throw insertError;
}

