// src/app/api/files/[id]/draft/route.ts
// POST: generate the first draft for a paid file (idempotent; safe to call repeatedly).
// Called by the contractor's payment-success page and by the consultant's editor.
// Generation runs the AI blocks in parallel but can still take a minute, so allow a long run.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { runDraft } from '@/lib/draft'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin: any = createAdminClient()
  const [{ data: file }, { data: profile }] = await Promise.all([
    admin.from('she_files').select('id, contractor_id, consultant_id, status, draft_status').eq('id', params.id).single(),
    admin.from('profiles').select('role').eq('id', user.id).single(),
  ])
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed =
    profile?.role === 'admin' ||
    (profile?.role === 'contractor' && file.contractor_id === user.id) ||
    (profile?.role === 'consultant' && file.consultant_id === user.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await runDraft(params.id)
  return NextResponse.json(result)
}
