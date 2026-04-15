import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { User, AuthResponse, OAuthResponse, UserResponse, Session } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `Missing Supabase credentials. Please check your .env file.\n` +
    `URL: ${supabaseUrl ? '✓ SET' : '✗ MISSING'}\n` +
    `Key: ${supabaseKey ? '✓ SET' : '✗ MISSING'}`
  )
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: localStorage
  }
})

export interface Organisation {
  id: string
  name: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface OrganisationMember {
  id: string
  organisation_id: string
  user_id: string
  role: string
  status?: string
  created_at?: string
  organisation?: Organisation | null
}

export interface UserProfile {
  id: string
  user_id: string
  full_name?: string
  role?: string
  phone?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
}

export interface Site {
  id: string
  site_name: string
  latitude: number
  longitude: number
  radius_meters: number
  address?: string
  is_active?: boolean
  organization_id?: string
  created_at?: string
  updated_at?: string
}

export interface Attendance {
  id: string
  employee_id: string
  check_in_time?: string | null
  check_out_time?: string | null
  site_id?: string | null
  status: 'checked_in' | 'checked_out' | 'absent' | 'on_leave' | 'pending'
  remarks?: string | null
  check_in_latitude?: number | null
  check_in_longitude?: number | null
  check_out_latitude?: number | null
  check_out_longitude?: number | null
  recorded_at?: string
  created_at?: string
  updated_at?: string
  site?: Site
  employee?: UserProfile
}

export const signUp = async (
  email: string,
  password: string,
  fullName: string
): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  })
  return { data, error }
}

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signInWithGoogle = async (): Promise<OAuthResponse> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  return { data, error }
}

export const signOut = async (): Promise<{ error: Error | null }> => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async (): Promise<UserResponse> => {
  const { data, error } = await supabase.auth.getUser()
  return { data: { user: data.user as User | null }, error }
}

export const onAuthStateChange = (
  callback: (event: string, session: Session | null) => void
) => {
  return supabase.auth.onAuthStateChange(callback)
}

export const getUserProfile = async (
  userId: string
): Promise<{ data: UserProfile | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, org_members(*, organisation:organisations(*))')
    .eq('user_id', userId)
    .single()
  return { data: data as UserProfile | null, error }
}

export const getUserOrganisations = async (
  userId: string
): Promise<{ data: OrganisationMember[] | null; error: Error | null }> => {
  let { data, error } = await supabase
    .from('org_members')
    .select('*, organisation:organisations(*)')
    .eq('user_id', userId)
    .or('status.eq.active,status.eq.Active,status.is.null')

  if (error) {
    const retry = await supabase
      .from('org_members')
      .select('*, organisation:organisations(*)')
      .eq('user_id', userId)
    data = retry.data
    error = retry.error
  }

  if (!error && Array.isArray(data) && data.length > 0 && data.some((row) => !row.organisation && row.organisation_id)) {
    const orgIds = [...new Set(data.map((row) => row.organisation_id).filter(Boolean))]
    if (orgIds.length > 0) {
      const orgRes = await supabase
        .from('organisations')
        .select('*')
        .in('id', orgIds)

      if (!orgRes.error && Array.isArray(orgRes.data)) {
        const orgMap = Object.fromEntries(orgRes.data.map((org) => [org.id, org]))
        data = data.map((row) => ({
          ...row,
          organisation: row.organisation || orgMap[row.organisation_id] || null
        }))
      }
    }
  }

  return { data: data as OrganisationMember[] | null, error }
}

export const createOrganization = async (
  orgName: string,
  userId: string
): Promise<{ data: Organisation | null; error: Error | null }> => {
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .insert({ name: orgName, is_trial: true, trial_period_days: 30 })
    .select()
    .single()
  
  if (orgError) throw orgError
  
  const { error: memberError } = await supabase
    .from('user_organisations')
    .insert({
      organisation_id: org.id,
      user_id: userId,
      role: 'admin',
      is_default: true,
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
  
  if (memberError) throw memberError
  
  await supabase
    .from('user_profiles')
    .update({ role: 'admin' })
    .eq('user_id', userId)
  
  return { data: org as Organisation, error: null }
}

export const joinOrganisation = async (
  organisationId: string,
  userId: string,
  role = 'member'
): Promise<{ data: unknown | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('org_members')
    .insert({
      organisation_id: organisationId,
      user_id: userId,
      role: role
    })
  return { data, error }
}

export const getOrganisationMembers = async (
  organisationId: string
): Promise<{ data: OrganisationMember[] | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('org_members')
    .select('*, user:user_profiles(*)')
    .eq('organisation_id', organisationId)
  return { data: data as OrganisationMember[] | null, error }
}

export const updateUserRole = async (
  memberId: string,
  role: string
): Promise<{ data: unknown | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('id', memberId)
  return { data, error }
}

export const createInvitation = async (
  organisationId: string,
  email: string,
  role: string = 'member',
  invitedByUserId: string
): Promise<{ data: any | null; error: Error | null }> => {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      organisation_id: organisationId,
      email,
      role,
      invited_by_user_id: invitedByUserId,
      token,
      status: 'pending'
    })
    .select()
    .single();
    
  return { data, error };
}

export const getInvitationByToken = async (
  token: string
): Promise<{ data: any | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('invitations')
    .select('*, organisation:organisations(*)')
    .eq('token', token)
    .single();
    
  return { data, error };
}

export const acceptInvitation = async (
  token: string,
  userId: string
): Promise<{ data: any | null; error: Error | null }> => {
  // Get invitation details
  const { data: invitation, error: inviteError } = await getInvitationByToken(token);
  if (inviteError || !invitation) {
    return { data: null, error: inviteError || new Error('Invalid invitation') };
  }
  
  // Check if invitation is still valid
  if (invitation.status !== 'pending' || new Date(invitation.expires_at) < new Date()) {
    return { data: null, error: new Error('Invitation expired') };
  }
  
  // Start transaction to accept invitation and add user to organization
  const { data: acceptData, error: acceptError } = await supabase.rpc('accept_invitation', {
    token,
    user_id: userId
  });
  
  return { data: acceptData, error: acceptError };
}


export const removeMember = async (
  memberId: string
): Promise<{ data: unknown | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('org_members')
    .delete()
    .eq('id', memberId)
  return { data, error }
}

export const sendVerificationEmail = async (
  email: string
): Promise<{ data: unknown; error: Error | null }> => {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: email
  })
  return { data, error }
}

export const resetPassword = async (
  email: string
): Promise<{ data: unknown; error: Error | null }> => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })
  return { data, error }
}

export const updateProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ data: unknown | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
  return { data, error }
}
export const getSites = async (organizationId: string): Promise<{ data: Site[] | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('site_name')
  return { data: data as Site[] | null, error }
}

export const getSiteById = async (siteId: string): Promise<{ data: Site | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single()
  return { data: data as Site | null, error }
}

export const createSite = async (
  site: Omit<Site, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: Site | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('sites')
    .insert(site)
    .select()
    .single()
  return { data: data as Site | null, error }
}

export const updateSite = async (
  siteId: string,
  updates: Partial<Site>
): Promise<{ data: Site | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('sites')
    .update(updates)
    .eq('id', siteId)
    .select()
    .single()
  return { data: data as Site | null, error }
}

export const checkIn = async (
  employeeId: string,
  siteId: string,
  latitude: number,
  longitude: number,
  remarks?: string
): Promise<{ data: Attendance | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('attendance')
    .insert({
      employee_id: employeeId,
      site_id: siteId,
      status: 'checked_in',
      check_in_time: new Date().toISOString(),
      check_in_latitude: latitude,
      check_in_longitude: longitude,
      remarks: remarks || null,
      recorded_at: new Date().toISOString().split('T')[0]
    })
    .select()
    .single()
  return { data: data as Attendance | null, error }
}

export const checkOut = async (
  attendanceId: string,
  latitude: number,
  longitude: number,
  remarks?: string
): Promise<{ data: Attendance | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('attendance')
    .update({
      status: 'checked_out',
      check_out_time: new Date().toISOString(),
      check_out_latitude: latitude,
      check_out_longitude: longitude,
      remarks: remarks || null
    })
    .eq('id', attendanceId)
    .select()
    .single()
  return { data: data as Attendance | null, error }
}

export const getTodayAttendance = async (
  employeeId: string,
  date?: string
): Promise<{ data: Attendance | null; error: Error | null }> => {
  const recordDate = date || new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('attendance')
    .select('*, site:sites(*)')
    .eq('employee_id', employeeId)
    .eq('recorded_at', recordDate)
    .maybeSingle()
  return { data: data as Attendance | null, error }
}

export const getAttendanceLogs = async (
  organizationId: string,
  options?: {
    startDate?: string
    endDate?: string
    employeeId?: string
    siteId?: string
  }
): Promise<{ data: Attendance[] | null; error: Error | null }> => {
  let query = supabase
    .from('attendance')
    .select(`
      *,
      site:sites(*),
      employee:user_profiles(*)
    `)
    .order('recorded_at', { ascending: false })

  if (options?.startDate) {
    query = query.gte('recorded_at', options.startDate)
  }
  if (options?.endDate) {
    query = query.lte('recorded_at', options.endDate)
  }
  if (options?.employeeId) {
    query = query.eq('employee_id', options.employeeId)
  }
  if (options?.siteId) {
    query = query.eq('site_id', options.siteId)
  }

  const { data, error } = await query
  return { data: data as Attendance[] | null, error }
}

export const updateAttendanceRemarks = async (
  attendanceId: string,
  remarks: string
): Promise<{ data: Attendance | null; error: Error | null }> => {
  const { data, error } = await supabase
    .from('attendance')
    .update({ remarks })
    .eq('id', attendanceId)
    .select()
    .single()
  return { data: data as Attendance | null, error }
}
