'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton browser client — reused across the app
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,      // session survives page refresh
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

// Ensure anonymous session exists before any game action
export async function ensureAnonymousSession(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) throw new Error('Failed to create anonymous session')
  return data.user.id
}
