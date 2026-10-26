// src/app/api/files/[id]/complete/route.ts
// Consultant submits completed document + signature → generates PDF → marks complete

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { generateSheFilePdf } from '@/lib/pdf-generator'
import { splitRevenue } from '@/lib/pricing'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()

  // Verify this consultant owns this file
  const { data: file } = await admin
    .from('she_files')
    .select(`*, 
      contractor:profiles!she_files_contractor_id_fkey(full_name, company_name),
      consultant:profiles!she_files_consultant_id_fkey(full_name),
      consultant_detail:consultants!she_files_consultant_id_fkey(sacpcmp_number, sacpcmp_category, tier),
      project_type:project_types(label)`)
    .eq('id', params.id)
    .single()

  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  if (file.consultant_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { completedText, signatureBase64 } = body

  if (!completedText || completedText.trim().length < 100)
    return NextResponse.json({ error: 'Document text is too short — please complete all sections.' }, { status: 422 })
  if (!signatureBase64 || !signatureBase64.startsWith('data:image'))
    return NextResponse.json({ error: 'Signature is required.' }, { status: 422 })

  // Build the PDF
  const consultantName = (file.consultant as any)?.full_name ?? 'Consultant'
  const sacpcmpNum     = (file.consultant_detail as any)?.sacpcmp_number ?? ''
  const sacpcmpCat     = (file.consultant_detail as any)?.sacpcmp_category ?? 'CHSO'

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateSheFilePdf({
      fileNumber:            file.file_number,
      projectName:           file.project_name,
      projectAddress:        file.project_address,
      projectValue:          file.project_value
        ? `R${Number(file.project_value).toLocaleString('en-ZA')}` : '',
      clientName:            file.client_name ?? '',
      siteAgent:             file.site_agent ?? '',
      startDate:             file.project_start_date
        ? new Date(file.project_start_date).toLocaleDateString('en-ZA') : '',
      endDate:               file.project_end_date
        ? new Date(file.project_end_date).toLocaleDateString('en-ZA') : '',
      contractorName:        (file.contractor as any)?.company_name ?? (file.contractor as any)?.full_name ?? '',
      cidbNumber:            (file.wizard_data as any)?.cidbNumber ?? '',
      workerCount:           String((file.wizard_data as any)?.workerCount ?? ''),
      highRiskActivities:    ((file.wizard_data as any)?.highRiskActivities ?? []).join(', ') || 'None declared',
      projectType:           (file.project_type as any)?.label ?? '',
      consultantName,
      sacpcmpNumber:         sacpcmpNum,
      sacpcmpCategory:       sacpcmpCat,
      signingDate:           new Date().toLocaleDateString('en-ZA', { dateStyle: 'long' }),
      documentText:          completedText,
      signatureImageBase64:  signatureBase64,
    })
  } catch (err: any) {
    console.error('[complete] PDF generation failed:', err)
    return NextResponse.json({ error: 'PDF generation failed: ' + err.message }, { status: 500 })
  }

  // Upload PDF to Supabase Storage
  const fileName    = `she-files/${file.file_number}-signed.pdf`
  const { error: uploadError } = await admin.storage
    .from('signed-files')
    .upload(fileName, pdfBytes, {
      contentType:  'application/pdf',
      upsert:       true,
    })

  if (uploadError) {
    console.error('[complete] Storage upload failed:', uploadError)
    return NextResponse.json({ error: 'Failed to store PDF: ' + uploadError.message }, { status: 500 })
  }

  // Get a permanent public URL
  const { data: urlData } = admin.storage
    .from('signed-files')
    .getPublicUrl(fileName)

  const documentUrl = urlData.publicUrl

  // Update the SHE file record
  await admin.from('she_files').update({
    status:                'completed',
    completed_at:          new Date().toISOString(),
    docuseal_document_url: documentUrl,   // repurposing this field for our PDF URL
    generated_draft:       completedText, // save the final completed version
    updated_at:            new Date().toISOString(),
  }).eq('id', params.id)

  // Increment consultant's file count
  await admin.rpc('increment_consultant_files', {
    consultant_uuid: user.id
  })

  // Update transaction with correct tier-based fee split
  const { platformFee, consultantAmount: consultantAmt, feePct } = splitRevenue(file.price_zar)

  await admin.from('transactions')
    .update({
      consultant_id:       user.id,
      platform_fee_pct:    feePct,
      platform_fee_amount: platformFee,
      consultant_amount:   consultantAmt,
      payout_status:       'pending',
    })
    .eq('she_file_id', params.id)

  console.log(`[complete] File ${params.id} signed and PDF stored: ${documentUrl}`)

  return NextResponse.json({
    success:     true,
    documentUrl,
    fileNumber:  file.file_number,
  })
}
