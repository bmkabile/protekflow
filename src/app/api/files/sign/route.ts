// src/app/api/files/[id]/sign/route.ts
// Consultant triggers DocuSeal e-signature for a SHE file
// Called when consultant clicks "Review & Sign" in their dashboard

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { createSheFileSubmission } from '@/lib/docuseal'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const fileId = params.id
  const admin  = createAdminClient()

  // Fetch the file with related contractor and consultant profiles
  const { data: file } = await admin
  .from('she_files')
  .select(`
    *,
    contractor:profiles!she_files_contractor_id_fkey(full_name, email:auth_users(email)),
    consultant:profiles!she_files_consultant_id_fkey(full_name, email:auth_users(email))
  `)
  .eq('id', fileId)
  .eq('consultant_id', user.id)
  .single() as { data: any, error: any }

  if (!file) return NextResponse.json({ error: 'File not found or not assigned to you' }, { status: 404 })
  if (!['paid', 'matched', 'in_review'].includes(file.status)) {
    return NextResponse.json({ error: `Cannot sign a file with status: ${file.status}` }, { status: 422 })
  }

  // Fetch emails from Supabase Auth (not in profiles table)
  const { data: contractorUser } = await admin.auth.admin.getUserById(file.contractor_id)
  const { data: consultantUser } = await admin.auth.admin.getUserById(file.consultant_id!)

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/consultant/files/${fileId}`

  try {
    const submission = await createSheFileSubmission({
      sheFileId:         fileId,
      fileNumber:        file.file_number,
      projectName:       file.project_name,
      projectAddress:    file.project_address,
      consultantEmail:   consultantUser?.user?.email ?? '',
      consultantName:    (file.consultant as any)?.full_name ?? '',
      contractorEmail:   contractorUser?.user?.email ?? '',
      contractorName:    (file.contractor as any)?.full_name ?? '',
      completionRedirectUrl: redirectUrl,
    })

    await (admin.from('she_files') as any).update({
      status: 'awaiting_sign',
      docuseal_submission_id: String(submission.id),
      docuseal_status: 'pending',
      review_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', fileId)
    return NextResponse.json({
      submission_id: submission.id,
      signing_url: submission.url,   // redirect consultant here to sign
    })
  } catch (err) {
    console.error('[sign] DocuSeal error:', err)
    return NextResponse.json({ error: 'DocuSeal submission failed' }, { status: 500 })
  }
}
