import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { User, AuthResponse, OAuthResponse, UserResponse, Session } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rujqejtisqermjyqqgoj.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseKey) {
  console.warn('Supabase anon key is not set. Set VITE_SUPABASE_ANON_KEY in your environment. Do NOT commit secret keys.')
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
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

export const createOrganisation = async (
  orgName: string,
  userId: string
): Promise<{ data: Organisation | null; error: Error | null }> => {
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .insert({ name: orgName })
    .select()
    .single()
  
  if (orgError) throw orgError
  
  const { error: memberError } = await supabase
    .from('org_members')
    .insert({
      organisation_id: org.id,
      user_id: userId,
      role: 'admin'
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

export const initStorageBuckets = async (): Promise<void> => {
  try {
    const buckets = ['site-visit-photos', 'site-visit-documents']
    
    for (const bucketName of buckets) {
      const { data: existing } = await supabase.storage.getBucket(bucketName)
      if (!existing) {
        await supabase.storage.createBucket(bucketName, {
          public: true
        })
      }
    }
  } catch (err) {
    console.log('Storage bucket init skipped:', (err as Error).message)
  }
}
