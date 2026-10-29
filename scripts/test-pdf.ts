// Run: npx tsx scripts/test-pdf.ts  -> writes /tmp/sample-she.pdf from the starter template
import fs from 'fs'
import { generateSheFilePdf } from '../src/lib/pdf-generator'
import { assembleDraft, findAiBlocks } from '../src/lib/template-engine'
import { buildTemplateData } from '../src/lib/draft'
import { applyFieldValues, listPlaceholders, stripAiMarkers } from '../src/lib/doc-format'

const tpl = fs.readFileSync('/tmp/starter_template.md', 'utf8')
const file = { file_number: 'SHE-2026-0001', project_name: 'Sakhisizwe Clinic Extension Phase 2 \u2013 Cala', project_address: 'Erf 123, Hospital Street, Cala, Eastern Cape',
  project_value: 1500000, project_start_date: '2026-11-02', project_end_date: '2027-01-15', client_name: 'Sakhisizwe Local Municipality', site_agent: 'T. Dlamini',
  wizard_data: { projectType: 'residential', workerCount: 12, cidbNumber: 'CIDB 12345', cidbGrade: '3', highRiskActivities: ['working_at_height', 'excavation'], subcontractors: 'ABC Electrical\nXYZ Plumbing' } }
const { data } = buildTemplateData(file, 'Legacy Landmark (Pty) Ltd')
const ai = findAiBlocks(tpl).map(() => '### Working at height\nHazards:\n- Falls from roof edges \u2265 2 m\nTypical control measures:\n- Edge protection and harnesses\n[CONSULTANT TO VERIFY: controls for working at height]')
let text = assembleDraft(tpl, data, ai).text
const n = listPlaceholders(text).length
const values: Record<number, string> = {}; for (let i = 0; i < n; i++) values[i] = i % 3 === 0 ? 'Yes' : 'Filled value ' + i
text = stripAiMarkers(applyFieldValues(text, values))
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC'
generateSheFilePdf({ fileNumber: 'SHE-2026-0001', projectName: file.project_name, projectAddress: file.project_address, projectValue: 'R1 500 000', clientName: file.client_name,
  siteAgent: 'T. Dlamini', startDate: '2 November 2026', endDate: '15 January 2027', contractorName: 'Legacy Landmark (Pty) Ltd', cidbNumber: 'CIDB 12345', workerCount: '12',
  highRiskActivities: 'Working at height', projectType: 'Residential construction', consultantName: 'Nomsa Khumalo', sacpcmpNumber: 'CHSO-0000', sacpcmpCategory: 'CHSO',
  signingDate: '26 October 2026', documentText: text, signatureImageBase64: png }).then(r => {
  fs.writeFileSync('/tmp/sample-she.pdf', r.bytes); console.log('pdf bytes', r.bytes.length, 'fingerprint', r.contentSha256.slice(0, 16), 'placeholders filled', n)
})
