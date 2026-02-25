import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co'
const supabaseKey = 'sb_publishable_xcLv9r4hTNLEFd7TqvmNow_HDLojCpa'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

export const signUp = async (email, password, fullName) => {
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

export const signInWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback)
}

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, org_members(*, organisation:organisations(*))')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

export const getUserOrganisations = async (userId) => {
  const { data, error } = await supabase
    .from('org_members')
    .select('*, organisation:organisations(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
  return { data, error }
}

export const createOrganisation = async (orgName, userId) => {
  // Create organisation first
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .insert({ name: orgName })
    .select()
    .single()
  
  if (orgError) throw orgError
  
  // Add user as admin member
  const { error: memberError } = await supabase
    .from('org_members')
    .insert({
      organisation_id: org.id,
      user_id: userId,
      role: 'admin'
    })
  
  if (memberError) throw memberError
  
  // Update user profile role
  await supabase
    .from('user_profiles')
    .update({ role: 'admin' })
    .eq('user_id', userId)
  
  return { data: org, error: null }
}

export const joinOrganisation = async (organisationId, userId, role = 'member') => {
  const { data, error } = await supabase
    .from('org_members')
    .insert({
      organisation_id: organisationId,
      user_id: userId,
      role: role
    })
  return { data, error }
}

export const getOrganisationMembers = async (organisationId) => {
  const { data, error } = await supabase
    .from('org_members')
    .select('*, user:user_profiles(*)')
    .eq('organisation_id', organisationId)
  return { data, error }
}

export const updateUserRole = async (memberId, role) => {
  const { data, error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('id', memberId)
  return { data, error }
}

export const removeMember = async (memberId) => {
  const { data, error } = await supabase
    .from('org_members')
    .delete()
    .eq('id', memberId)
  return { data, error }
}

export const sendVerificationEmail = async (email) => {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: email
  })
  return { data, error }
}

export const resetPassword = async (email) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })
  return { data, error }
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
  return { data, error }
}

export const initStorageBuckets = async () => {
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
    console.log('Storage bucket init skipped:', err.message)
  }
}
