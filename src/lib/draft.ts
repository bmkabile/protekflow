// src/lib/draft.ts
// Generates the first draft of a SHE file from the active template and the intake data.

import { createAdminClient } from './supabase-server'
import { callClaude, aiModel } from './ai'
import {
  findAiBlocks, assembleDraft, validateAiOutput, normaliseAiOutput, describeProject,
  buildBlockUserPrompt, AI_SYSTEM_PROMPT, runPool, cleanUserText, type TemplateData,
} from './template-engine'
import { PROJECT_TYPE_MAP, FALLBACK_TYPE_CODE, projectTypeLabel, highRiskLabel } from './templates'

const DRAFTABLE = ['paid', 'matched', 'in_review']
const MAX_ATTEMPTS = 5
const STALE_MS = 6 * 60 * 1000

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : undefined

export function buildTemplateData(file: any, contractorName?: string): { data: TemplateData; activityLabels: string[] } {
  const w = file.wizard_data ?? {}
  const activityLabels: string[] = (w.highRiskActivities ?? []).map((v: string) => highRiskLabel(v))
  let duration: string | undefined
  if (file.project_start_date && file.project_end_date) {
    const days = Math.round((Date.parse(file.project_end_date) - Date.parse(file.project_start_date)) / 86_400_000)
    if (Number.isFinite(days) && days >= 0) duration = `${days} days`
  }
  const cidb = [w.cidbNumber, w.cidbGrade ? `grade ${w.cidbGrade}` : ''].filter(Boolean).join(', ')
  const data: TemplateData = {
    file_number: file.file_number,
    project_name: file.project_name,
    project_address: file.project_address,
    project_type_label: projectTypeLabel(w.projectType),
    contractor_name: file.principal_contractor || contractorName,
    cidb_number: cidb,
    client_name: file.client_name,
    site_agent: file.site_agent,
    start_date: fmtDate(file.project_start_date),
    end_date: fmtDate(file.project_end_date),
    duration_days: duration,
    worker_count: w.workerCount ? String(w.workerCount) : undefined,
    project_value: file.project_value ? `R${Number(file.project_value).toLocaleString('en-ZA')}` : undefined,
    subcontractors: w.subcontractors,
  }
  return { data, activityLabels }
}

export type DraftResult = { status: 'ready' | 'failed' | 'skipped'; message?: string }

export async function runDraft(fileId: string): Promise<DraftResult> {
  const supabase: any = createAdminClient()
  const t0 = Date.now()

  const { data: file } = await supabase
    .from('she_files')
    .select('*, contractor:profiles!she_files_contractor_id_fkey(full_name, company_name)')
    .eq('id', fileId).single()
  if (!file) return { status: 'skipped', message: 'File not found' }
  if (!DRAFTABLE.includes(file.status)) return { status: 'skipped', message: `File is ${file.status}` }
  if (file.draft_status === 'ready') return { status: 'ready' }
  if ((file.draft_attempts ?? 0) >= MAX_ATTEMPTS) return { status: 'failed', message: 'Too many attempts; the consultant can write this file manually.' }

  // Atomic claim: pending/failed, or "generating" for too long (a crashed run)
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString()
  const { data: claimed } = await supabase
    .from('she_files')
    .update({ draft_status: 'generating', draft_started_at: new Date().toISOString(), draft_attempts: (file.draft_attempts ?? 0) + 1 })
    .eq('id', fileId).eq('draft_attempts', file.draft_attempts ?? 0)
    .or(`draft_status.in.(pending,failed),and(draft_status.eq.generating,draft_started_at.lt.${staleBefore})`)
    .select('id')
  if (!claimed?.length) return { status: 'skipped', message: 'Draft is already being generated' }

  const fail = async (message: string, report: any = {}) => {
    await supabase.from('she_files').update({ draft_status: 'failed', draft_report: { error: message, ...report } }).eq('id', fileId)
    return { status: 'failed' as const, message }
  }

  try {
    // Template: the file's project type, falling back to the general template
    const typeCode = PROJECT_TYPE_MAP[file.wizard_data?.projectType ?? ''] ?? FALLBACK_TYPE_CODE
    const { data: types } = await supabase.from('project_types').select('id, code').in('code', [typeCode, FALLBACK_TYPE_CODE])
    const preferred = types?.find((t: any) => t.code === typeCode)
    const fallback = types?.find((t: any) => t.code === FALLBACK_TYPE_CODE)
    const { data: templates } = await supabase
      .from('she_templates').select('id, version, content, project_type_id')
      .eq('is_active', true).in('project_type_id', [preferred?.id, fallback?.id].filter(Boolean))
      .order('created_at', { ascending: false })
    const tpl = templates?.find((t: any) => t.project_type_id === preferred?.id) ?? templates?.find((t: any) => t.project_type_id === fallback?.id)
    if (!tpl) return await fail('No active template found. Add one to she_templates (see migration 004).')

    const contractorName = file.contractor?.company_name || file.contractor?.full_name
    const { data, activityLabels } = buildTemplateData(file, contractorName)
    const specs = findAiBlocks(tpl.content)
    const info = describeProject(data, activityLabels)

    const blockReports: any[] = []
    const results = await runPool(specs, 4, async (spec, idx) => {
      let errors: string[] = []
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const raw = await callClaude({ system: AI_SYSTEM_PROMPT, user: buildBlockUserPrompt(spec, info, errors), maxTokens: 2000 })
          const text = normaliseAiOutput(raw)
          errors = validateAiOutput(text, { requireActivities: spec.requireActivities, activityLabels })
          if (!errors.length) { blockReports[idx] = { index: idx, ok: true, attempts: attempt }; return text }
        } catch (err: any) {
          errors = [`Request failed: ${cleanUserText(err?.message, 160)}`]
        }
      }
      blockReports[idx] = { index: idx, ok: false, attempts: 2, errors }
      return null
    })

    const assembled = assembleDraft(tpl.content, data, results)
    const report = {
      model: aiModel(), template_version: tpl.version, ms: Date.now() - t0,
      blocks: blockReports, unknown_fields: assembled.unknown, missing_fields: assembled.missing,
    }
    await supabase.from('she_files').update({
      generated_draft: assembled.text, draft_status: 'ready', draft_generated_at: new Date().toISOString(),
      template_id: tpl.id, template_version: tpl.version, draft_report: report,
    }).eq('id', fileId)
    return { status: 'ready' }
  } catch (err: any) {
    console.error('[draft] failed for', fileId, err)
    return await fail(cleanUserText(err?.message ?? 'Unknown error', 200))
  }
}
