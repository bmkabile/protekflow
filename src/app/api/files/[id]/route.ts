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

// PATCH -- update a file.
//   admin:      status, notes, review_started_at, consultant_id
//   consultant: only their OWN assigned file: notes, review_state, and the move to 'in_review'
//   contractor: not allowed
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const admin: any = createAdminClient()

  const { data: file } = await admin
    .from('she_files').select('consultant_id, contractor_id, status').eq('id', params.id).single()
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (role === 'admin') {
    ;['status', 'notes', 'review_started_at', 'consultant_id'].forEach(k => { if (body[k] !== undefined) update[k] = body[k] })
  } else if (role === 'consultant' && file.consultant_id === user.id) {
    if (body.notes !== undefined) update.notes = String(body.notes).slice(0, 5000)
    if (body.review_state !== undefined) {
      if (JSON.stringify(body.review_state).length > 400_000)
        return NextResponse.json({ error: 'Review state too large' }, { status: 413 })
      update.review_state = body.review_state
    }
    if (body.status !== undefined) {
      // The only status a consultant may set is in_review, and only while the file is still open
      if (body.status !== 'in_review' || !['paid', 'matched', 'in_review'].includes(file.status))
        return NextResponse.json({ error: 'Status change not allowed' }, { status: 403 })
      update.status = 'in_review'
      if (file.status !== 'in_review') update.review_started_at = new Date().toISOString()
    }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('she_files').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ file: data })
}
