// src/lib/pdf-generator.ts
// Builds the signed SHE file PDF: cover, contents, body (sections / tables / bullets),
// certification page with the professional's signature, running header/footer, page numbers
// and a content fingerprint. Uses only the standard PDF fonts, so all text is sanitised first.

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import crypto from 'crypto'
import { parseBlocks, splitSections, sanitizeForPdf, stripAiMarkers } from './doc-format'

export interface SheFileData {
  fileNumber: string
  projectName: string
  projectAddress: string
  projectValue: string
  clientName: string
  siteAgent: string
  startDate: string
  endDate: string
  contractorName: string
  cidbNumber: string
  workerCount: string
  highRiskActivities: string
  projectType: string
  consultantName: string
  sacpcmpNumber: string
  sacpcmpCategory: string
  signingDate: string
  documentText: string
  signatureImageBase64: string   // data:image/png;base64,...
}

// A4, margins
const W = 595.28, H = 841.89
const M = 56, TOP = H - 64, BOTTOM = 70
const CW = W - 2 * M

const GREEN  = rgb(0.06, 0.25, 0.19)
const LIGHT  = rgb(0.91, 0.96, 0.93)
const GREY   = rgb(0.42, 0.45, 0.43)
const LINE   = rgb(0.80, 0.84, 0.82)
const INK    = rgb(0.10, 0.12, 0.11)
const WHITE  = rgb(1, 1, 1)

// NOTE: confirm this wording with your signing professionals / legal advisor before relying on it.
const CERTIFICATION = [
  'I am registered with the South African Council for the Project and Construction Management Professions (SACPCMP) under the registration number stated below, and that registration was current on the date of signing.',
  'I have reviewed this SHE file and, to the best of my professional knowledge, it is suitable for the project described in section 1.',
  'This file is based on the information supplied by the contractor at intake. The contractor remains responsible for implementing it and for keeping the supporting documents it refers to.',
]

export async function generateSheFilePdf(d: SheFileData): Promise<{ bytes: Uint8Array; contentSha256: string; pdfSha256: string }> {
  const text = stripAiMarkers(d.documentText)
  const contentSha256 = crypto.createHash('sha256').update(text, 'utf8').digest('hex')

  const doc = await PDFDocument.create()
  doc.setTitle(sanitizeForPdf(`SHE File ${d.fileNumber} - ${d.projectName}`))
  doc.setAuthor(sanitizeForPdf(d.consultantName))
  doc.setProducer('ProtekFlow')
  const reg  = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const clean = (s: string) => sanitizeForPdf(String(s ?? ''))

  const wrap = (s: string, font: PDFFont, size: number, maxW: number): string[] => {
    const out: string[] = []
    for (const para of clean(s).split('\n')) {
      if (!para.trim()) { out.push(''); continue }
      let line = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        let w = word
        while (font.widthOfTextAtSize(w, size) > maxW) {       // break very long tokens
          let cut = w.length - 1
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxW) cut--
          if (line) { out.push(line); line = '' }
          out.push(w.slice(0, cut)); w = w.slice(cut)
        }
        const test = line ? `${line} ${w}` : w
        if (font.widthOfTextAtSize(test, size) <= maxW) line = test
        else { out.push(line); line = w }
      }
      out.push(line)
    }
    return out
  }

  // ---- Cover ----
  const cover = doc.addPage([W, H])
  cover.drawRectangle({ x: 0, y: H - 250, width: W, height: 250, color: GREEN })
  cover.drawText('SAFETY, HEALTH AND ENVIRONMENT FILE', { x: M, y: H - 120, size: 22, font: bold, color: WHITE })
  cover.drawText(clean(`File ${d.fileNumber}`), { x: M, y: H - 150, size: 12, font: reg, color: rgb(0.8, 0.92, 0.86) })
  let ty = H - 190
  for (const l of wrap(d.projectName, bold, 18, CW).slice(0, 2)) { cover.drawText(l, { x: M, y: ty, size: 18, font: bold, color: WHITE }); ty -= 24 }

  const facts: [string, string][] = [
    ['Site address', d.projectAddress], ['Type of work', d.projectType], ['Principal contractor', d.contractorName],
    ['Client', d.clientName], ['CIDB registration', d.cidbNumber], ['Site agent', d.siteAgent],
    ['Programme', [d.startDate, d.endDate].filter(Boolean).join('  to  ')], ['Contract value', d.projectValue],
  ].filter(([, v]) => v && String(v).trim()) as [string, string][]
  let fy = H - 300
  for (const [k, v] of facts) {
    cover.drawText(clean(k).toUpperCase(), { x: M, y: fy, size: 8, font: bold, color: GREY })
    const ls = wrap(v, reg, 11, CW - 150)
    ls.forEach((l, i) => cover.drawText(l, { x: M + 150, y: fy - (i ? 14 * i : 0), size: 11, font: reg, color: INK }))
    fy -= 14 * Math.max(1, ls.length) + 10
    cover.drawLine({ start: { x: M, y: fy + 8 }, end: { x: W - M, y: fy + 8 }, thickness: 0.5, color: LINE })
  }
  cover.drawRectangle({ x: M, y: 90, width: CW, height: 58, color: LIGHT })
  cover.drawText('Reviewed and signed by', { x: M + 14, y: 128, size: 8, font: bold, color: GREY })
  cover.drawText(clean(`${d.consultantName}  |  SACPCMP ${d.sacpcmpNumber} (${d.sacpcmpCategory})`), { x: M + 14, y: 112, size: 11, font: bold, color: GREEN })
  cover.drawText(clean(`Signed ${d.signingDate}`), { x: M + 14, y: 98, size: 9, font: reg, color: GREY })

  // ---- Contents page (filled after layout) ----
  const toc = doc.addPage([W, H])

  // ---- Body ----
  let page: PDFPage = doc.addPage([W, H])
  let y = TOP
  const newPage = () => { page = doc.addPage([W, H]); y = TOP }
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage() }
  const tocEntries: { title: string; page: number }[] = []

  const sections = splitSections(text)
  for (const sec of sections) {
    if (!sec.title) {
      // preamble: the "# TITLE" line is on the cover already
      const rest = sec.body.split('\n').filter(l => l.trim() && !/^#\s/.test(l.trim())).join('\n')
      if (!rest) continue
      sec.body = rest
    }
    if (sec.title) {
      ensure(60)
      tocEntries.push({ title: sec.title, page: doc.getPageCount() })
      page.drawRectangle({ x: M, y: y - 22, width: CW, height: 24, color: GREEN })
      page.drawText(clean(sec.title).toUpperCase(), { x: M + 10, y: y - 15, size: 10.5, font: bold, color: WHITE })
      y -= 38
    }
    for (const b of parseBlocks(sec.body)) {
      if (b.type === 'h3') {
        ensure(90)   // keep a sub-heading together with what follows it
        page.drawText(clean(b.text), { x: M, y: y - 10, size: 11, font: bold, color: GREEN })
        y -= 22
      } else if (b.type === 'para') {
        for (const l of wrap(b.text, reg, 10, CW)) {
          ensure(15)
          if (l) page.drawText(l, { x: M, y: y - 10, size: 10, font: reg, color: INK })
          y -= 14
        }
        y -= 6
      } else if (b.type === 'bullets') {
        for (const item of b.items) {
          const ls = wrap(item, reg, 10, CW - 18)
          ensure(14 * Math.min(ls.length, 2) + 2)
          page.drawCircle({ x: M + 5, y: y - 6, size: 1.6, color: GREEN })
          for (const l of ls) { ensure(14); page.drawText(l, { x: M + 16, y: y - 10, size: 10, font: reg, color: INK }); y -= 14 }
          y -= 2
        }
        y -= 6
      } else if (b.type === 'table' && b.rows.length) {
        const cols = Math.max(...b.rows.map(r => r.length))
        const rows = b.rows.map(r => Array.from({ length: cols }, (_, i) => r[i] ?? ''))
        const weights = Array.from({ length: cols }, (_, c) =>
          Math.min(46, Math.max(10, ...rows.map(r => Math.min(46, clean(r[c]).length * 0.6)))))
        const total = weights.reduce((a, b) => a + b, 0)
        let widths = weights.map(w => Math.max(70, (w / total) * CW))
        const scale = CW / widths.reduce((a, b) => a + b, 0); widths = widths.map(w => w * scale)
        const pad = 5, fs = 9, lh = 12

        const drawRow = (row: string[], header: boolean) => {
          const cells = row.map((c, i) => wrap(c, header ? bold : reg, fs, widths[i] - 2 * pad))
          const h = Math.max(...cells.map(c => c.length)) * lh + 2 * pad - 2
          return { cells, h }
        }
        const draw = (cells: string[][], h: number, header: boolean) => {
          if (header) page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: LIGHT })
          let x = M
          cells.forEach((lines, i) => {
            page.drawRectangle({ x, y: y - h, width: widths[i], height: h, borderColor: LINE, borderWidth: 0.6 })
            lines.forEach((l, li) => { if (l) page.drawText(l, { x: x + pad, y: y - pad - 8 - li * lh + 1, size: fs, font: header ? bold : reg, color: header ? GREEN : INK }) })
            x += widths[i]
          })
          y -= h
        }
        const paint = (row: string[], header: boolean) => {
          const r = drawRow(row, header)
          if (y - r.h < BOTTOM) {
            newPage()
            if (!header) { const hd = drawRow(rows[0], true); draw(hd.cells, hd.h, true) }   // repeat header on the new page
          }
          draw(r.cells, r.h, header)
        }
        // keep the header row together with the first body row
        const firstH = drawRow(rows[0], true).h + (rows[1] ? drawRow(rows[1], false).h : 0)
        ensure(firstH)
        paint(rows[0], true)
        for (const r of rows.slice(1)) paint(r, false)
        y -= 12
      }
    }
    y -= 8
  }

  // ---- Certification and signature page ----
  newPage()
  tocEntries.push({ title: 'PROFESSIONAL CERTIFICATION AND SIGNATURE', page: doc.getPageCount() })
  page.drawRectangle({ x: M, y: y - 22, width: CW, height: 24, color: GREEN })
  page.drawText('PROFESSIONAL CERTIFICATION AND SIGNATURE', { x: M + 10, y: y - 15, size: 10.5, font: bold, color: WHITE })
  y -= 44
  page.drawText(clean(`I, ${d.consultantName}, confirm that:`), { x: M, y: y - 10, size: 10.5, font: bold, color: INK }); y -= 26
  CERTIFICATION.forEach((c, i) => {
    const ls = wrap(c, reg, 10, CW - 22)
    page.drawText(`${i + 1}.`, { x: M, y: y - 10, size: 10, font: bold, color: GREEN })
    ls.forEach(l => { page.drawText(l, { x: M + 20, y: y - 10, size: 10, font: reg, color: INK }); y -= 14 })
    y -= 6
  })
  y -= 14
  const boxH = 150
  page.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, borderColor: LINE, borderWidth: 0.8 })
  const b64 = d.signatureImageBase64.replace(/^data:image\/png;base64,/, '')
  const sig = await doc.embedPng(Buffer.from(b64, 'base64'))
  const sc = Math.min(220 / sig.width, 70 / sig.height)
  page.drawImage(sig, { x: M + 16, y: y - 16 - sig.height * sc, width: sig.width * sc, height: sig.height * sc })
  page.drawLine({ start: { x: M + 16, y: y - 96 }, end: { x: M + 250, y: y - 96 }, thickness: 0.8, color: INK })
  const info: [string, string][] = [['Name', d.consultantName], ['SACPCMP registration', `${d.sacpcmpNumber} (${d.sacpcmpCategory})`], ['Date signed', d.signingDate]]
  info.forEach(([k, v], i) => {
    page.drawText(clean(k).toUpperCase(), { x: M + 16, y: y - 112 - i * 13, size: 7, font: bold, color: GREY })
    page.drawText(clean(v), { x: M + 140, y: y - 112 - i * 13, size: 9.5, font: reg, color: INK })
  })
  y -= boxH + 26
  page.drawText('DOCUMENT FINGERPRINT (SHA-256 OF THE DOCUMENT TEXT)', { x: M, y: y - 8, size: 7.5, font: bold, color: GREY })
  page.drawText(contentSha256.slice(0, 32), { x: M, y: y - 22, size: 9, font: reg, color: INK })
  page.drawText(contentSha256.slice(32), { x: M, y: y - 34, size: 9, font: reg, color: INK })
  page.drawText('Keep this fingerprint with your records. Any change to the document text changes it.', { x: M, y: y - 50, size: 8, font: reg, color: GREY })

  // ---- Fill contents page ----
  let cy = TOP
  toc.drawText('CONTENTS', { x: M, y: cy - 12, size: 16, font: bold, color: GREEN }); cy -= 44
  for (const e of tocEntries) {
    const label = clean(e.title)
    toc.drawText(label.length > 70 ? label.slice(0, 67) + '...' : label, { x: M, y: cy, size: 10.5, font: reg, color: INK })
    const pn = String(e.page)
    toc.drawText(pn, { x: W - M - reg.widthOfTextAtSize(pn, 10.5), y: cy, size: 10.5, font: bold, color: GREEN })
    cy -= 22
    if (cy < BOTTOM) break
  }

  // ---- Running header and footer (not on the cover) ----
  const pages = doc.getPages(), total = pages.length
  pages.forEach((p, i) => {
    if (i === 0) return
    p.drawText(clean(`SHE File ${d.fileNumber}  |  ${d.projectName}`).slice(0, 90), { x: M, y: H - 36, size: 8, font: reg, color: GREY })
    p.drawLine({ start: { x: M, y: H - 42 }, end: { x: W - M, y: H - 42 }, thickness: 0.5, color: LINE })
    p.drawLine({ start: { x: M, y: 48 }, end: { x: W - M, y: 48 }, thickness: 0.5, color: LINE })
    p.drawText(clean(`Signed by ${d.consultantName}, SACPCMP ${d.sacpcmpNumber}  |  Fingerprint ${contentSha256.slice(0, 12)}`), { x: M, y: 34, size: 7.5, font: reg, color: GREY })
    const pn = `Page ${i + 1} of ${total}`
    p.drawText(pn, { x: W - M - reg.widthOfTextAtSize(pn, 8), y: 34, size: 8, font: reg, color: GREY })
  })

  const bytes = await doc.save()
  const pdfSha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  return { bytes, contentSha256, pdfSha256 }
}
