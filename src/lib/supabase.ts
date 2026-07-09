import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const getAnonymousUserId = async (): Promise<string> => {
  const STORAGE_KEY = 'qingtu_anonymous_id'
  
  let userId = localStorage.getItem(STORAGE_KEY)
  if (userId) return userId
  
  const { v4: uuidv4 } = await import('uuid')
  userId = uuidv4()
  localStorage.setItem(STORAGE_KEY, userId)
  
  return userId
}
