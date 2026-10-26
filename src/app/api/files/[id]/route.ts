// src/app/api/files/[id]/route.ts
// GET a single SHE file with related data

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const admin = createAdminClient()

  const { data: file, error } = await admin
    .from('she_files')
    .select(`
      *,
      contractor:profiles!she_files_contractor_id_fkey(id, full_name, company_name, phone),
      consultant:profiles!she_files_consultant_id_fkey(id, full_name),
      consultant_detail:consultants!she_files_consultant_id_fkey(sacpcmp_number, tier, rating_avg),
      project_type:project_types(code, label)
    `)
    .eq('id', params.id)
    .single()

  if (error || !file)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // Access control: contractor sees own files, consultant sees assigned, admin sees all
  const role = profile?.role
  if (role === 'contractor' && file.contractor_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (role === 'consultant' && file.consultant_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ file })
}

// PATCH — update file (consultant updates status, adds notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body   = await request.json()
  const admin  = createAdminClient()

  // Verify ownership
  const { data: file } = await admin
    .from('she_files').select('consultant_id, contractor_id, status').eq('id', params.id).single()
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role === 'consultant' && file.consultant_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Allowed fields for update
  const allowed = ['status', 'notes', 'review_started_at', 'consultant_id']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k] })

  const { data, error } = await admin
    .from('she_files').update(update).eq('id', params.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ file: data })
}
