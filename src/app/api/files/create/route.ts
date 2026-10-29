// src/app/api/files/create/route.ts
// Creates a new SHE file after the contractor completes the intake wizard

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildPayFastPayment, } from '@/lib/payfast'
import { getFilePrice } from '@/lib/pricing'
import { PROJECT_TYPE_MAP, PROJECT_TYPE_OPTIONS, HIGH_RISK_OPTIONS, CLIENT_TYPE_OPTIONS, isComplex } from '@/lib/templates'
import { cleanUserText } from '@/lib/template-engine'
import { z } from 'zod'

const CreateFileSchema = z.object({
  project_name:         z.string().min(3),
  project_address:      z.string().min(5),
  project_value:        z.number().positive().optional(),
  project_start_date:   z.string().optional(),
  project_end_date:     z.string().optional(),
  principal_contractor: z.string().optional(),
  client_name:          z.string().optional(),
  site_agent:           z.string().optional(),
  // Work & risk details (these drive the draft)
  project_type:         z.enum(PROJECT_TYPE_OPTIONS.map(o => o.value) as [string, ...string[]]),
  worker_count:         z.number().int().min(1).max(5000),
  high_risk_activities: z.array(z.enum(HIGH_RISK_OPTIONS.map(o => o.value) as [string, ...string[]])).max(20).default([]),
  client_type:          z.enum(CLIENT_TYPE_OPTIONS.map(o => o.value) as [string, ...string[]]),
  cidb_number:          z.string().max(60).optional(),
  cidb_grade:           z.string().max(10).optional(),
  subcontractors:       z.string().max(1500).optional(),
  // Section content from wizard
  sections:             z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  // 1. Verify the user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // 2. Verify they are a contractor
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'contractor') {
    return NextResponse.json({ error: 'Only contractors can create SHE files' }, { status: 403 })
  }

  // 3. Parse and validate body
  const body = await request.json()
  const parsed = CreateFileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const {
    sections, project_type, worker_count, high_risk_activities, client_type,
    cidb_number, cidb_grade, subcontractors, ...fileData
  } = parsed.data
  const priceZar = getFilePrice()

  // Link the project type row (once migrations 003/004 have run) and work out complexity
  const { data: typeRow } = await supabase
    .from('project_types').select('id').eq('code', PROJECT_TYPE_MAP[project_type]).maybeSingle()
  const complex = isComplex({ projectValue: fileData.project_value, highRiskActivities: high_risk_activities, clientType: client_type })
  const wizard_data = {
    projectType: project_type,
    workerCount: worker_count,
    highRiskActivities: high_risk_activities,
    clientType: client_type,
    cidbNumber: cleanUserText(cidb_number, 60),
    cidbGrade: cleanUserText(cidb_grade, 10),
    subcontractors: cleanUserText(subcontractors, 1500),
  }

  // 4. Insert the SHE file (status: 'draft' → will become 'payment_pending')
  const { data: file, error: insertError } = await supabase
    .from('she_files')
    .insert({
      contractor_id: user.id,
      price_zar: priceZar,
      status: 'payment_pending',
      project_type_id: typeRow?.id ?? null,
      wizard_data,
      is_complex: complex,
      ...fileData,
    })
    .select()
    .single()

  if (insertError || !file) {
    console.error('[files/create] Insert error:', insertError)
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 })
  }

  // 5. Optionally insert wizard section data
  if (sections && Object.keys(sections).length > 0) {
    const sectionRows = Object.entries(sections).map(([key, content]) => ({
      she_file_id: file.id,
      section_key: key,
      content,
    }))
    await supabase.from('she_file_sections').insert(sectionRows)
  }

  // 6. Build PayFast payment object
  const payment = buildPayFastPayment({
    sheFileId:        file.id,
    fileNumber:       file.file_number,
    contractorEmail:  user.email!,
    contractorName:   profile.full_name,
    amountCents:      priceZar,
  })

  return NextResponse.json({
    file,
    payment,   // front end uses this to redirect to PayFast
  }, { status: 201 })
}
