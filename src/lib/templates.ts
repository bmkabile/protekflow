// src/lib/templates.ts
// Intake vocabulary (project types, high-risk activities) and complexity rules.
// Template content itself lives in the database (she_templates) - see template-engine.ts.

export type ClientType = 'private' | 'public_sector' | 'soe' | 'cidb_grade6plus'

/** Extra intake answers stored in she_files.wizard_data (camelCase JSON) */
export type WizardData = {
  projectType:        string            // key of PROJECT_TYPE_MAP
  workerCount:        number
  highRiskActivities: string[]          // values from HIGH_RISK_OPTIONS
  clientType:         ClientType
  cidbNumber:         string
  cidbGrade?:         string
  subcontractors?:    string            // free text, one per line
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
  interior_fit_out:    'T09',
  general_maintenance: 'T10',
}

export const FALLBACK_TYPE_CODE = 'T00'

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
  { value: 'working_at_height',   label: 'Working at height (above 2 m)' },
  { value: 'excavation',          label: 'Excavation / trenching' },
  { value: 'confined_spaces',     label: 'Confined spaces' },
  { value: 'asbestos',            label: 'Asbestos handling' },
  { value: 'hot_work',            label: 'Hot work / welding' },
  { value: 'electrical_hv',       label: 'Electrical (HV)' },
  { value: 'demolition_activity', label: 'Structural demolition' },
  { value: 'cranes_lifting',      label: 'Cranes / lifting operations' },
  { value: 'explosives',          label: 'Explosives / blasting' },
]

export const CLIENT_TYPE_OPTIONS: { value: ClientType; label: string }[] = [
  { value: 'private',         label: 'Private client' },
  { value: 'public_sector',   label: 'Public sector (municipality, department)' },
  { value: 'soe',             label: 'State-owned entity' },
  { value: 'cidb_grade6plus', label: 'CIDB grade 6 or higher project' },
]

export const projectTypeLabel = (v?: string) =>
  PROJECT_TYPE_OPTIONS.find(o => o.value === v)?.label ?? 'Construction work'
export const highRiskLabel = (v: string) =>
  HIGH_RISK_OPTIONS.find(o => o.value === v)?.label ?? v
export const clientTypeLabel = (v?: string) =>
  CLIENT_TYPE_OPTIONS.find(o => o.value === v)?.label ?? ''

/**
 * Complex projects need a more senior signer (CHSM-level) when matching.
 * This no longer affects price: every file is the same fixed fee.
 */
export function isComplex(a: { projectValue?: number; highRiskActivities: string[]; clientType?: string }): boolean {
  if ((a.projectValue ?? 0) > 5_000_000) return true
  if (a.highRiskActivities.length >= 3) return true
  if (a.clientType === 'soe' || a.clientType === 'cidb_grade6plus') return true
  return false
}
