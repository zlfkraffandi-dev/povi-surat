import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helper functions
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback)
}

export interface UserProfile {
  id: string
  email: string
  name: string
  jabatan: string | null
  role: 'bph' | 'kadep' | 'kadiv' | 'anggota'
  divisi: string | null
  is_sekretaris: boolean
}

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const session = await getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, jabatan, role, divisi, is_sekretaris')
    .eq('id', session.user.id)
    .single()

  if (error) {
    console.error('getCurrentUserProfile failed:', error.message, error)
    return null
  }
  return data
}
