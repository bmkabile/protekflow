// src/app/api/files/create/route.ts
// Creates a SHE file, runs AI generation, then redirects to PayFast

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { buildPayFastPayment } from '@/lib/payfast'
import { selectTemplate, buildClaudePrompt, type WizardAnswers } from '@/lib/templates'
import { z } from 'zod'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const Schema = z.object({
  project_name:         z.string().min(3),
  project_address:      z.string().min(5),
  project_type:         z.string(),
  project_value:        z.number().positive().optional().default(0),
  project_start_date:   z.string().optional().default(''),
  project_end_date:     z.string().optional().default(''),
  duration_days:        z.number().optional().default(30),
  worker_count:         z.number().optional().default(1),
  high_risk_activities: z.array(z.string()).optional().default([]),
  client_type:          z.enum(['private','public_sector','soe','cidb_grade6plus']).default('private'),
  principal_contractor: z.string().optional().default(''),
  client_name:          z.string().optional().default(''),
  site_agent:           z.string().optional().default(''),
  cidb_number:          z.string().optional().default(''),
  volume_tier:          z.enum(['standard','volume_a','volume_b','volume_c']).default('standard'),
})

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name, company_name').eq('id', user.id).single()
  if (profile?.role !== 'contractor')
    return NextResponse.json({ error: 'Only contractors can create SHE files' }, { status: 403 })

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data
  const admin = createAdminClient()

  // ── 1. Select template ────────────────────────────────────────────────────
  const wizardAnswers: WizardAnswers = {
    projectType:        d.project_type,
    projectName:        d.project_name,
    projectAddress:     d.project_address,
    projectValue:       d.project_value,
    durationDays:       d.duration_days,
    workerCount:        d.worker_count,
    highRiskActivities: d.high_risk_activities,
    clientType:         d.client_type,
    contractorName:     profile.company_name ?? profile.full_name,
    cidbNumber:         d.cidb_number,
    startDate:          d.project_start_date,
    endDate:            d.project_end_date,
    clientName:         d.client_name,
    siteAgent:          d.site_agent,
  }

  let selected
  try {
    selected = await selectTemplate(wizardAnswers)
  } catch {
    // No template seeded yet — continue without AI generation
    selected = { projectTypeId: null, templateId: null, templateContent: null,
                 isComplex: false, requiresChsm: false,
                 price: d.volume_tier === 'standard' ? 450000 : 412500,
                 customisationMins: { min: 30, max: 45 } }
  }

  // ── 2. Insert SHE file record ─────────────────────────────────────────────
  const { data: file, error: insertError } = await admin
    .from('she_files')
    .insert({
      contractor_id:       user.id,
      project_name:        d.project_name,
      project_address:     d.project_address,
      project_value:       d.project_value,
      project_start_date:  d.project_start_date || null,
      project_end_date:    d.project_end_date   || null,
      principal_contractor:d.principal_contractor || null,
      client_name:         d.client_name || null,
      site_agent:          d.site_agent  || null,
      volume_tier:         d.volume_tier,
      price_zar:           selected.price,
      status:              'payment_pending',
      project_type_id:     selected.projectTypeId,
      template_id:         selected.templateId,
      wizard_data:         wizardAnswers,
      is_complex:          selected.isComplex,
    })
    .select().single()

  if (insertError || !file)
    return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })

  // ── 3. AI generation (non-blocking — best effort) ─────────────────────────
  if (selected.templateContent) {
    try {
      const message = await anthropic.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: buildClaudePrompt(selected.templateContent, wizardAnswers) }],
      })
      const draft = message.content.filter(b => b.type === 'text').map(b => (b as any).text).join('')
      await admin.from('she_files').update({ generated_draft: draft }).eq('id', file.id)
    } catch (aiErr) {
      console.error('[AI generation] Failed:', aiErr)
      // Continue — consultant can still work manually
    }
  }

  // ── 4. Build PayFast redirect ─────────────────────────────────────────────
  const payment = buildPayFastPayment({
    sheFileId:       file.id,
    fileNumber:      file.file_number,
    contractorEmail: user.email!,
    contractorName:  profile.full_name,
    amountCents:     selected.price,
  })

  return NextResponse.json({ file, payment }, { status: 201 })
}
