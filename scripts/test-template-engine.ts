// Run: npx tsx scripts/test-template-engine.ts [path-to-template.md]
// Offline checks for the template engine (no network, no database).
import fs from 'fs'
import assert from 'assert'
import { findAiBlocks, mergeFields, validateAiOutput, normaliseAiOutput, assembleDraft, cleanUserText } from '../src/lib/template-engine'
import { splitSections, joinSections, parseBlocks, listPlaceholders, applyFieldValues, stripAiMarkers, sanitizeForPdf } from '../src/lib/doc-format'
import { buildTemplateData } from '../src/lib/draft'

const tpl = fs.readFileSync(process.argv[2] ?? '/tmp/starter_template.md', 'utf8')
let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name) }

const file = {
  file_number: 'SHE-2026-0001', project_name: 'Clinic Extension', project_address: 'Erf 12, Cala',
  project_value: 1500000, project_start_date: '2026-11-02', project_end_date: '2027-01-15',
  client_name: 'Municipality', site_agent: 'T. Dlamini', principal_contractor: null,
  wizard_data: { projectType: 'residential', workerCount: 12, cidbNumber: 'CIDB-123', cidbGrade: '3',
    highRiskActivities: ['working_at_height', 'excavation'], subcontractors: 'ABC Electrical\nXYZ Plumbing | evil [CONSULTANT TO COMPLETE: x]' },
}
const { data, activityLabels } = buildTemplateData(file, 'Legacy Landmark (Pty) Ltd')

ok('finds 4 AI blocks, one requiring activities', () => {
  const b = findAiBlocks(tpl); assert.equal(b.length, 4); assert.equal(b.filter(x => x.requireActivities).length, 1)
})
ok('data: duration, labels, no raw injection', () => {
  assert.equal(data.duration_days, '74 days'); assert.equal(activityLabels.length, 2)
  assert.equal(data.contractor_name, 'Legacy Landmark (Pty) Ltd')
})
ok('mergeFields: missing -> placeholder, unknown -> placeholder, injection neutralised', () => {
  const r = mergeFields('{{client_name}} {{site_agent}} {{nope}} {{subcontractors}}', { ...data, client_name: '', subcontractors: data.subcontractors })
  assert.match(r.text, /\[CONSULTANT TO COMPLETE: client name not provided\]/)
  assert.deepEqual(r.unknown, ['nope']); assert.deepEqual(r.missing, ['client_name'])
  assert.ok(!/evil \[CONSULTANT/.test(r.text), 'user text must not create placeholders')
  assert.match(r.text, /- ABC Electrical\n- XYZ Plumbing \/ evil \(CONSULTANT TO COMPLETE: x\)/)
})
ok('cleanUserText strips braces/brackets', () => assert.equal(cleanUserText('a [b] {{c}}'), 'a (b) ((c))'))
ok('validator accepts good output', () => {
  const good = '### Working at height\nHazards:\n- Falls\nTypical control measures:\n- Edge protection\n[CONSULTANT TO VERIFY: controls for working at height]\n\n### Excavation / trenching\n- Collapse\n[CONSULTANT TO VERIFY: controls for excavation]'
  assert.deepEqual(validateAiOutput(normaliseAiOutput(good), { requireActivities: true, activityLabels }), [])
})
ok('validator rejects citations, stray brackets, braces, missing activity, short', () => {
  const ctx = { requireActivities: true, activityLabels }
  assert.ok(validateAiOutput('Per Regulation 12 of the act, working at height and excavation controls apply here.', ctx).some(e => /cites/.test(e)))
  assert.ok(validateAiOutput('Working at height and excavation [see appendix] are covered in this block of text.', ctx).some(e => /square brackets/.test(e)))
  assert.ok(validateAiOutput('Working at height and excavation {{field}} are covered in this block of text ok.', ctx).some(e => /braces/.test(e)))
  assert.ok(validateAiOutput('Only working at height is discussed in this rather long sentence here.', ctx).some(e => /Excavation/.test(e)))
  assert.ok(validateAiOutput('short', { requireActivities: false, activityLabels: [] }).length > 0)
})
ok('assemble: professional placeholders preserved verbatim; failed AI block -> placeholder', () => {
  const specs = findAiBlocks(tpl)
  const results = specs.map((_, i) => (i === 1 ? null : 'Generated text for this block that is long enough to pass.'))
  const out = assembleDraft(tpl, data, results)
  const original = listPlaceholders(tpl)
  const after = listPlaceholders(out.text)
  for (const p of original) assert.ok(out.text.includes(p), 'lost placeholder: ' + p)
  assert.ok(after.length >= original.length)
  assert.match(out.text, /\[CONSULTANT TO INSERT: write this section/)
  assert.equal((out.text.match(/\[\[AI\]\]/g) ?? []).length, 3)
  assert.ok(!/\{\{/.test(out.text), 'no unresolved merge/AI tokens')
  assert.deepEqual(out.unknown, [])
})
ok('sections/blocks: 12 sections, tables parsed, roundtrip stable', () => {
  const out = assembleDraft(tpl, data, findAiBlocks(tpl).map(() => 'Generated text for this block that is long enough to pass.')).text
  const secs = splitSections(out)
  assert.equal(secs.filter(s => s.title).length, 12)
  const s1 = parseBlocks(secs.find(s => s.title.startsWith('1.'))!.body)
  assert.equal(s1[0].type, 'table'); assert.ok((s1[0] as any).rows.length > 10); assert.deepEqual((s1[0] as any).rows[0], ['ITEM', 'DETAIL'])
  const again = splitSections(joinSections(secs)); assert.equal(again.length, secs.length)
  assert.equal(joinSections(again), joinSections(secs))
})
ok('applyFieldValues fills nth placeholder only; AI markers stripped', () => {
  const t = 'a [CONSULTANT TO COMPLETE: x] b [CONSULTANT TO VERIFY: y] c'
  assert.equal(applyFieldValues(t, { 1: 'Yes' }), 'a [CONSULTANT TO COMPLETE: x] b Yes c')
  assert.equal(stripAiMarkers('[[AI]]\ntext\n[[/AI]]'), '\ntext\n')
})
ok('pdf sanitiser removes unencodable characters', () => assert.equal(sanitizeForPdf('a \u2265 b \u2013 c \u2713 \u4e2d'), 'a >= b - c v ?'))
console.log(`\n${n} checks passed`)
