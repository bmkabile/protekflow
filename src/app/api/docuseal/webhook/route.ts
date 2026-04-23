// src/app/api/docuseal/webhook/route.ts
// DocuSeal POSTs here when all parties have signed the SHE file
// Configure this URL in your DocuSeal template settings

import { NextRequest, NextResponse } from 'next/server'
import { parseDocuSealWebhook } from '@/lib/docuseal'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { submissionId, isComplete, documentUrl } = parseDocuSealWebhook(body)

  if (!isComplete) {
    // Partial signing — one party signed but not all. Log and wait.
    console.log(`[DocuSeal] Submission ${submissionId} not yet complete:`, body.data?.status)
    return NextResponse.json({ received: true })
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
