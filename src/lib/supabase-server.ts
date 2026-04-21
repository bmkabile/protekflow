// src/lib/supabase-server.ts
// Server-only client — use in Server Components, Route Handlers, and Server Actions
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export function createServerSupabaseClient() {
  // Import inside function so next/headers is never evaluated at module load time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { cookies } = require('next/headers')
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: object) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: object) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

// Admin client — bypasses RLS. Use ONLY in server-side admin routes.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}