// src/lib/doc-format.ts
// The SHE document is stored as simple markdown-like text. This module is shared by the
// reviewer editor (browser) and the PDF generator (server), so it must stay dependency-free.
//
//   ## 1. SECTION TITLE         section heading
//   ### 1.1 Sub heading         sub heading
//   | a | b |  (with |---|---|)  table (first row is the header)
//   - item                      bullet
//   [[AI]] ... [[/AI]]          text written by the AI (highlighted for the reviewer, stripped from the PDF)
//   [CONSULTANT TO COMPLETE|INSERT|VERIFY: ...]   placeholder the professional must resolve

export const PLACEHOLDER_SOURCE = '\\[CONSULTANT TO (?:COMPLETE|INSERT|VERIFY)[^\\]]*\\]'
export const makePlaceholderRe = () => new RegExp(PLACEHOLDER_SOURCE, 'g')
export const AI_START = '[[AI]]'
export const AI_END = '[[/AI]]'

export type Block =
  | { type: 'h3'; text: string; ai: boolean }
  | { type: 'table'; rows: string[][]; ai: boolean }
  | { type: 'bullets'; items: string[]; ai: boolean }
  | { type: 'para'; text: string; ai: boolean }

export type Section = { title: string; body: string }

export function stripAiMarkers(text: string): string {
  return text.replace(/^\s*\[\[\/?AI\]\]\s*$/gm, '').replace(/\n{3,}/g, '\n\n')
}

export function listPlaceholders(text: string): string[] {
  return text.match(makePlaceholderRe()) ?? []
}
export const countPlaceholders = (text: string) => listPlaceholders(text).length

/** Splits into sections at "## " headings. Text before the first heading becomes a section with an empty title. */
export function splitSections(text: string): Section[] {
  const lines = text.split('\n')
  const sections: Section[] = []
  let cur: Section = { title: '', body: '' }
  let started = false
  const push = () => { if (started || cur.body.trim()) sections.push({ title: cur.title, body: cur.body.replace(/^\n+|\n+$/g, '') }) }
  for (const line of lines) {
    const m = line.match(/^##\s+(.*)$/)
    if (m) { push(); cur = { title: m[1].trim(), body: '' }; started = true }
    else cur.body += (cur.body ? '\n' : '') + line
  }
  push()
  return sections
}

export function joinSections(sections: Section[]): string {
  return sections.map(s => (s.title ? `## ${s.title}\n` : '') + s.body).join('\n\n').trim() + '\n'
}

const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const isSepRow = (l: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l)

/** Parses a section body into renderable blocks (order of text is preserved). */
export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = []
  let ai = false
  let para: string[] = []
  const flush = () => { if (para.length) { blocks.push({ type: 'para', text: para.join('\n'), ai }); para = [] } }
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    if (t === AI_START) { flush(); ai = true; continue }
    if (t === AI_END)   { flush(); ai = false; continue }
    if (!t) { flush(); continue }
    if (/^###\s+/.test(t)) { flush(); blocks.push({ type: 'h3', text: t.replace(/^###\s+/, ''), ai }); continue }
    if (isTableLine(t)) {
      flush()
      const rows: string[][] = []
      while (i < lines.length && isTableLine(lines[i].trim())) {
        const l = lines[i].trim()
        if (!isSepRow(l)) rows.push(l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
        i++
      }
      i--
      blocks.push({ type: 'table', rows, ai })
      continue
    }
    if (/^[-*]\s+/.test(t)) {
      flush()
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++ }
      i--
      blocks.push({ type: 'bullets', items, ai })
      continue
    }
    para.push(t)
  }
  flush()
  return blocks
}

/** Replaces the Nth placeholder (document order) with a value; unfilled ones are kept as they are. */
export function applyFieldValues(text: string, values: Record<number, string | undefined>): string {
  let n = 0
  return text.replace(makePlaceholderRe(), m => {
    const v = values[n++]
    return v === undefined ? m : v
  })
}

/** Maps characters the standard PDF fonts cannot encode to safe equivalents. */
export function sanitizeForPdf(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25CF\u25AA\u2023]/g, '*')
    .replace(/\u2192/g, '->').replace(/\u2190/g, '<-')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/[\u00A0\u2007\u202F\u2009]/g, ' ')
    .replace(/[\u2713\u2714]/g, 'v')
    .replace(/\t/g, '    ')
    // anything still outside Latin-1 cannot be drawn by the standard fonts
    .replace(/[^\n\x20-\x7E\u00A1-\u00FF]/g, '?')
}
