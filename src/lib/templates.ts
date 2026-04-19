// src/lib/templates.ts
// Template selection logic — maps wizard answers to the right SHE template
import { createAdminClient } from './supabase-server'

export type WizardAnswers = {
  projectType:        string        // e.g. 'residential', 'electrical'
  projectName:        string
  projectAddress:     string
  projectValue:       number        // ZAR
  durationDays:       number
  workerCount:        number
  highRiskActivities: string[]      // e.g. ['working_at_height', 'excavation']
  clientType:         'private' | 'public_sector' | 'soe' | 'cidb_grade6plus'
  contractorName:     string
  cidbNumber:         string
  startDate:          string
  endDate:            string
  clientName?:        string
  siteAgent?:         string
}

export const PROJECT_TYPE_MAP: Record<string, string> = {
  residential:         'T01',
  light_commercial:    'T02',
  civil_earthworks:    'T03',
  electrical:          'T04',
  plumbing_mechanical: 'T05',
  roofing:             'T06',
  demolition:          'T07',
  painting_cladding:   'T08',
  interior_fitout:     'T09',
  general_maintenance: 'T10',
}

// Project types in plain English for the wizard dropdown
export const PROJECT_TYPE_OPTIONS = [
  { value: 'residential',         label: 'Residential construction' },
  { value: 'light_commercial',    label: 'Light commercial construction' },
  { value: 'civil_earthworks',    label: 'Civil / earthworks' },
  { value: 'electrical',          label: 'Electrical installation' },
  { value: 'plumbing_mechanical', label: 'Plumbing and mechanical' },
  { value: 'roofing',             label: 'Roofing (industrial/commercial)' },
  { value: 'demolition',          label: 'Demolition' },
  { value: 'painting_cladding',   label: 'Painting and cladding' },
  { value: 'interior_fitout',     label: 'Interior fit-out' },
  { value: 'general_maintenance', label: 'General maintenance' },
]

export const HIGH_RISK_OPTIONS = [
  { value: 'working_at_height',   label: 'Working at height (>2m)' },
  { value: 'excavation',          label: 'Excavation / trenching' },
  { value: 'confined_spaces',     label: 'Confined spaces' },
  { value: 'asbestos',            label: 'Asbestos handling' },
  { value: 'hot_work',            label: 'Hot work / welding' },
  { value: 'electrical_hv',       label: 'Electrical (HV)' },
  { value: 'demolition_activity', label: 'Structural demolition' },
  { value: 'cranes_lifting',      label: 'Cranes / lifting operations' },
  { value: 'explosives',          label: 'Explosives / blasting' },
]

/** Returns true if project triggers complex pricing (R9,000) and CHSM-only matching */
export function isComplex(answers: WizardAnswers): boolean {
  if (answers.projectValue > 5_000_000) return true
  if (answers.highRiskActivities.length >= 3) return true
  if (answers.clientType === 'soe') return true
  if (answers.clientType === 'cidb_grade6plus') return true
  return false
}

/** Selects the correct template and returns everything needed to generate a draft */
export async function selectTemplate(answers: WizardAnswers) {
  const code = PROJECT_TYPE_MAP[answers.projectType]
  if (!code) throw new Error(`Unknown project type: ${answers.projectType}`)

  const complex = isComplex(answers)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('project_types')
    .select(`
      id, code, label, requires_chsm, high_risk, price_standard, price_complex,
      she_templates (
        id, content, version,
        customisation_minutes_min, customisation_minutes_max
      )
    `)
    .eq('code', code)
    .single()

  if (error || !data) throw new Error(`Project type not found: ${code}`)

  const templates = (data as any).she_templates as any[]
  const template  = templates?.find((t: any) => t.is_active !== false) ?? templates?.[0]

  return {
    projectTypeId:     data.id,
    templateId:        template?.id ?? null,
    templateContent:   template?.content ?? null,
    templateVersion:   template?.version ?? '1.0',
    isComplex:         complex,
    requiresChsm:      complex || data.requires_chsm,
    price:             complex ? data.price_complex : data.price_standard,
    customisationMins: {
      min: template?.customisation_minutes_min ?? 30,
      max: template?.customisation_minutes_max ?? 45,
    },
  }
}

/** Builds the Claude prompt — fills contractor fields, leaves consultant fields intact */
export function buildClaudePrompt(templateContent: string, answers: WizardAnswers): string {
  return `You are a South African construction health and safety document specialist with deep knowledge of the OHS Act 85/1993 and Construction Regulations 2014.

Using the SHE file template below and the contractor's project information, produce a completed draft SHE file.

STRICT RULES:
1. Replace every placeholder marked [CONTRACTOR TO PROVIDE] or [FROM WIZARD] with the actual project information provided below.
2. Leave every placeholder marked [CONSULTANT TO COMPLETE], [CONSULTANT TO INSERT], or [CONSULTANT TO VERIFY] EXACTLY as-is — these are for the SACPCMP professional reviewer.
3. Do NOT add, remove, or reorder any sections.
4. Preserve ALL table structures, section headings, and numbering exactly.
5. Output the completed document as plain text with identical structure to the template.
6. For any risk assessments, use the specific high-risk activities declared below.
7. All dates must be in South African format: DD/MM/YYYY.

PROJECT INFORMATION:
- Project name: ${answers.projectName}
- Site address: ${answers.projectAddress}
- Principal contractor: ${answers.contractorName}
- CIDB registration: ${answers.cidbNumber}
- Project value: R${answers.projectValue.toLocaleString('en-ZA')}
- Client / employer: ${answers.clientName ?? '[CONSULTANT TO COMPLETE]'}
- Site agent: ${answers.siteAgent ?? '[CONSULTANT TO COMPLETE]'}
- Start date: ${answers.startDate}
- Completion date: ${answers.endDate}
- Duration: ${answers.durationDays} days
- Workers on site: ${answers.workerCount}
- High-risk activities: ${answers.highRiskActivities.length > 0 ? answers.highRiskActivities.join(', ') : 'None declared by contractor'}
- Client type: ${answers.clientType}

TEMPLATE:
${templateContent}`
}
