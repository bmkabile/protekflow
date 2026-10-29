// src/app/auth/callback/route.ts
// Supabase email callback: email confirmation, magic links and password recovery.
//
// Supports both link styles:
//   ?code=...                      PKCE flow (default). Must be opened in the SAME browser that requested it.
//   ?token_hash=...&type=recovery  works from any browser/device. Needs the email template change in the README.

import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/** Only allow same-site relative paths, so `next` can never become an open redirect. */
function safeNext(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: object) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: object) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )

  let ok = false
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
  }

  if (!ok) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('That link is invalid or has expired. Please request a new one.')}`)
  }

  // Password recovery must land on the reset form, not the dashboard.
  if (type === 'recovery' || next === '/auth/reset-password') {
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }
  if (next) return NextResponse.redirect(`${origin}${next}`)

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    return NextResponse.redirect(`${origin}/${profile?.role ?? ''}`)
  }
  return NextResponse.redirect(`${origin}/`)
}
