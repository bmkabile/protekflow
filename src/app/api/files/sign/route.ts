// src/app/api/files/sign/route.ts
// Consultant marks a file as in_review (signing now handled in /api/files/[id]/complete)
// DocuSeal has been removed — we generate PDFs in-house

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { fileId } = await request.json()
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: file } = await admin
    .from('she_files')
    .select('id, consultant_id, status')
    .eq('id', fileId)
    .single()

  if (!file)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })

  if (file.consultant_id !== user.id)
    return NextResponse.json({ error: 'You are not assigned to this file' }, { status: 403 })

  if (!['paid', 'matched', 'in_review'].includes(file.status))
    return NextResponse.json({ error: `Cannot review a file with status: ${file.status}` }, { status: 422 })

  await admin.from('she_files').update({
    status:             'in_review',
    review_started_at:  new Date().toISOString(),
    updated_at:         new Date().toISOString(),
  }).eq('id', fileId)

  // Return the review URL — consultant is redirected to the edit/sign page
  return NextResponse.json({
    review_url: `/consultant/files/${fileId}`,
  })
}
