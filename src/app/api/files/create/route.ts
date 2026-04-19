// src/app/api/files/create/route.ts
// Creates a new SHE file after the contractor completes the intake wizard

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildPayFastPayment, } from '@/lib/payfast'
import { getFilePrice } from '@/lib/pricing'
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
  volume_tier:          z.enum(['standard', 'volume_a', 'volume_b', 'volume_c']).default('standard'),
  // Section content from wizard
  sections:             z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()

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

  const { sections, volume_tier, ...fileData } = parsed.data
  const priceZar = getFilePrice(volume_tier)

  // 4. Insert the SHE file (status: 'draft' → will become 'payment_pending')
  const { data: file, error: insertError } = await supabase
    .from('she_files')
    .insert({
      contractor_id: user.id,
      volume_tier,
      price_zar: priceZar,
      status: 'payment_pending',
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
