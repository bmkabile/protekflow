// src/app/api/docuseal/webhook/route.ts
// DocuSeal POSTs here when all parties have signed the SHE file
// Configure this URL in your DocuSeal template settings

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { parseDocuSealWebhook, getSubmission } from '@/lib/docuseal'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * The webhook must carry a shared secret. In DocuSeal: Settings -> Webhooks -> add a custom
 * header (default name x-docuseal-secret) with the value of DOCUSEAL_WEBHOOK_SECRET.
 * Fails closed: with no secret configured, every call is rejected.
 */
function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET
  if (!secret) return false
  const header = process.env.DOCUSEAL_WEBHOOK_HEADER || 'x-docuseal-secret'
  const received = request.headers.get(header) ?? ''
  const a = Buffer.from(received), b = Buffer.from(secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    console.warn('[DocuSeal] Webhook rejected: missing or wrong secret')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  if (!body?.data?.id) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { submissionId, isComplete, documentUrl: reportedUrl } = parseDocuSealWebhook(body)
  let documentUrl = reportedUrl

  if (!isComplete) {
    // Partial signing — one party signed but not all. Log and wait.
    console.log(`[DocuSeal] Submission ${submissionId} not yet complete:`, body.data?.status)
    return NextResponse.json({ received: true })
  }

  // Defence in depth: confirm with DocuSeal itself that the submission really is completed
  try {
    const confirmed = await getSubmission(submissionId)
    if (confirmed.status !== 'completed') {
      console.warn(`[DocuSeal] Submission ${submissionId} reported complete but DocuSeal says ${confirmed.status}`)
      return NextResponse.json({ error: 'Not completed' }, { status: 400 })
    }
    documentUrl = confirmed.documents?.[0]?.url ?? documentUrl
  } catch (err) {
    console.error('[DocuSeal] Could not confirm submission:', err)
    return NextResponse.json({ error: 'Could not confirm' }, { status: 502 })
  }

  const supabase = createAdminClient()

  // Find the SHE file linked to this DocuSeal submission
  const { data: file, error } = await supabase
    .from('she_files')
    .select('id, contractor_id, status')
    .eq('docuseal_submission_id', submissionId)
    .single()

  if (error || !file) {
    console.error('[DocuSeal] Could not find SHE file for submission:', submissionId)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // Update file status to completed and store the signed document URL
  const { error: updateError } = await supabase
    .from('she_files')
    .update({
      status: 'completed',
      docuseal_status: 'completed',
      docuseal_document_url: documentUrl,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', file.id)

  if (updateError) {
    console.error('[DocuSeal] Failed to update file status:', updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Update consultant's completed file count
  const { data: sheFile } = await supabase
    .from('she_files')
    .select('consultant_id')
    .eq('id', file.id)
    .single()

  if (sheFile?.consultant_id) {
    await supabase.rpc('increment_consultant_files', {
      consultant_uuid: sheFile.consultant_id
    })
    // SQL for this RPC:
    // CREATE OR REPLACE FUNCTION increment_consultant_files(consultant_uuid UUID)
    // RETURNS void AS $$
    //   UPDATE consultants
    //   SET files_completed = files_completed + 1,
    //       files_this_month = files_this_month + 1
    //   WHERE id = consultant_uuid;
    // $$ LANGUAGE sql;
  }

  console.log(`[DocuSeal] SHE file ${file.id} completed. Document URL: ${documentUrl}`)
  return NextResponse.json({ received: true })
}
