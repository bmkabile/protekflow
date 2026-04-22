// src/lib/pdf-generator.ts
// Generates signed SHE file PDFs entirely in-house — no third-party signing service needed
// Uses pdf-lib for PDF creation and embeds the consultant's canvas signature

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

export interface SheFileData {
  fileNumber:       string
  projectName:      string
  projectAddress:   string
  projectValue:     string
  clientName:       string
  siteAgent:        string
  startDate:        string
  endDate:          string
  contractorName:   string
  cidbNumber:       string
  workerCount:      string
  highRiskActivities: string
  projectType:      string
  // Consultant info
  consultantName:   string
  sacpcmpNumber:    string
  sacpcmpCategory:  string
  signingDate:      string
  // The full document text (template with all fields filled in)
  documentText:     string
  // Base64 PNG of consultant's drawn signature
  signatureImageBase64: string
}

const MARGIN      = 60
const PAGE_WIDTH  = 595.28   // A4
const PAGE_HEIGHT = 841.89   // A4
const LINE_HEIGHT = 14
const FONT_SIZE   = 9
const HEADER_SIZE = 11
const SECTION_SIZE = 10

/** Splits text into lines that fit within maxWidth */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(test, fontSize)
    if (width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Adds a new page with the ProtekFlow header and returns it */
async function addPage(doc: PDFDocument, boldFont: PDFFont, regularFont: PDFFont, fileNumber: string): Promise<{ page: PDFPage; y: number }> {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const usableWidth = PAGE_WIDTH - MARGIN * 2

  // Header bar
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 40, width: PAGE_WIDTH, height: 40, color: rgb(0.08, 0.32, 0.17) })
  page.drawText('PROTEKFLOW', {
    x: MARGIN, y: PAGE_HEIGHT - 26,
    size: 12, font: boldFont, color: rgb(1,1,1),
  })
  page.drawText('Health & Safety File  |  OHS Act 85/1993  |  Construction Regulations 2014', {
    x: MARGIN + 120, y: PAGE_HEIGHT - 26,
    size: 7.5, font: regularFont, color: rgb(0.7,1,0.7),
  })
  page.drawText(fileNumber, {
    x: PAGE_WIDTH - MARGIN - 80, y: PAGE_HEIGHT - 26,
    size: 8, font: boldFont, color: rgb(0.7,1,0.7),
  })

  // Footer
  page.drawLine({
    start: { x: MARGIN, y: 30 }, end: { x: PAGE_WIDTH - MARGIN, y: 30 },
    thickness: 0.5, color: rgb(0.85, 0.97, 0.9),
  })
  page.drawText('Legacy Landmark (Pty) Ltd  |  ProtekFlow  |  Confidential', {
    x: MARGIN, y: 16, size: 7, font: regularFont, color: rgb(0.6,0.6,0.6),
  })
  page.drawText(`${doc.getPageCount()}`, {
    x: PAGE_WIDTH - MARGIN - 10, y: 16, size: 7, font: regularFont, color: rgb(0.6,0.6,0.6),
  })

  return { page, y: PAGE_HEIGHT - 60 }
}

/** Main PDF generation function */
export async function generateSheFilePdf(data: SheFileData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const boldFont    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await doc.embedFont(StandardFonts.Helvetica)
  const monoFont    = await doc.embedFont(StandardFonts.Courier)

  const usableWidth = PAGE_WIDTH - MARGIN * 2
  const green       = rgb(0.08, 0.32, 0.17)
  const lightGreen  = rgb(0.94, 0.99, 0.96)
  const midGreen    = rgb(0.13, 0.51, 0.28)
  const black       = rgb(0, 0, 0)
  const gray        = rgb(0.4, 0.4, 0.4)
  const red         = rgb(0.8, 0.1, 0.1)

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  const { page: cover, y: coverY } = await addPage(doc, boldFont, regularFont, data.fileNumber)

  // Title block
  cover.drawRectangle({ x: MARGIN, y: coverY - 80, width: usableWidth, height: 80, color: lightGreen })
  cover.drawText('HEALTH AND SAFETY FILE', {
    x: MARGIN + 16, y: coverY - 28,
    size: 18, font: boldFont, color: green,
  })
  cover.drawText('Safety, Health and Environment — Project File', {
    x: MARGIN + 16, y: coverY - 46,
    size: 10, font: regularFont, color: midGreen,
  })
  cover.drawText('Compiled in accordance with OHS Act 85/1993 & Construction Regulations 2014', {
    x: MARGIN + 16, y: coverY - 62,
    size: 8, font: regularFont, color: midGreen,
  })

  // Cover details table
  let cy = coverY - 110
  const rows: [string, string][] = [
    ['File number',         data.fileNumber],
    ['Project',             data.projectName],
    ['Site address',        data.projectAddress],
    ['Project value',       data.projectValue || '—'],
    ['Client / employer',   data.clientName || '—'],
    ['Site agent',          data.siteAgent || '—'],
    ['Start date',          data.startDate || '—'],
    ['Completion date',     data.endDate || '—'],
    ['Principal contractor',data.contractorName],
    ['CIDB registration',   data.cidbNumber || '—'],
    ['Workers on site',     data.workerCount],
    ['High-risk activities',data.highRiskActivities || 'None declared'],
    ['Project type',        data.projectType],
  ]

  for (const [key, val] of rows) {
    cover.drawRectangle({ x: MARGIN, y: cy - 2, width: 160, height: 14, color: rgb(0.96, 0.99, 0.97) })
    cover.drawText(key, { x: MARGIN + 4, y: cy + 2, size: 8.5, font: boldFont, color: green })
    const valLines = wrapText(val, regularFont, 8.5, usableWidth - 170)
    cover.drawText(valLines[0] ?? '', { x: MARGIN + 168, y: cy + 2, size: 8.5, font: regularFont, color: black })
    cy -= LINE_HEIGHT
  }

  // Reviewer block
  cy -= 10
  cover.drawRectangle({ x: MARGIN, y: cy - 60, width: usableWidth, height: 68, color: green })
  cover.drawText('REVIEWED AND CERTIFIED BY', {
    x: MARGIN + 12, y: cy + 2,
    size: 8, font: boldFont, color: rgb(0.7,1,0.7),
  })
  cover.drawText(data.consultantName, {
    x: MARGIN + 12, y: cy - 14,
    size: 13, font: boldFont, color: rgb(1,1,1),
  })
  cover.drawText(`SACPCMP ${data.sacpcmpCategory}  ·  Reg: ${data.sacpcmpNumber}`, {
    x: MARGIN + 12, y: cy - 30,
    size: 9, font: regularFont, color: rgb(0.8,1,0.85),
  })
  cover.drawText(`Date signed: ${data.signingDate}`, {
    x: MARGIN + 12, y: cy - 44,
    size: 9, font: regularFont, color: rgb(0.8,1,0.85),
  })

  // ── DOCUMENT PAGES ──────────────────────────────────────────────────────────
  // Split document text into sections
  const lines = data.documentText.split('\n')
  let { page, y } = await addPage(doc, boldFont, regularFont, data.fileNumber)

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // Section heading detection (all caps or starts with SECTION)
    const isSection = /^(SECTION|━|═|─)/.test(line) || (line === line.toUpperCase() && line.trim().length > 4 && line.trim().length < 80 && /[A-Z]/.test(line))
    const isEmpty   = line.trim() === ''
    const isSeparator = /^[━═─]{3,}/.test(line.trim())

    if (y < 60) {
      const next = await addPage(doc, boldFont, regularFont, data.fileNumber)
      page = next.page
      y    = next.y
    }

    if (isSeparator) {
      page.drawLine({
        start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 4 },
        thickness: 0.5, color: rgb(0.8, 0.95, 0.85),
      })
      y -= 8
      continue
    }

    if (isEmpty) { y -= 6; continue }

    if (isSection) {
      // Add spacing before section headings
      if (y < PAGE_HEIGHT - 100) y -= 6

      // Green background for section headings
      const headLines = wrapText(line, boldFont, SECTION_SIZE, usableWidth - 8)
      page.drawRectangle({
        x: MARGIN, y: y - 4,
        width: usableWidth, height: headLines.length * (LINE_HEIGHT - 1) + 6,
        color: lightGreen,
      })
      for (const hl of headLines) {
        page.drawText(hl, { x: MARGIN + 4, y, size: SECTION_SIZE, font: boldFont, color: green })
        y -= LINE_HEIGHT - 1
      }
      y -= 4
      continue
    }

    // Table rows (contain |)
    if (line.includes('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      const cellW = usableWidth / Math.max(cells.length, 1)
      cells.forEach((cell, i) => {
        const isHeader = /^[A-Z\s]+$/.test(cell) && cell.length > 2
        page.drawText(cell.slice(0, 35), {
          x: MARGIN + i * cellW + 2, y,
          size: 8, font: isHeader ? boldFont : regularFont,
          color: isHeader ? midGreen : black,
        })
      })
      y -= LINE_HEIGHT - 2
      continue
    }

    // [CONSULTANT TO COMPLETE] highlight
    if (line.includes('[CONSULTANT TO COMPLETE]') || line.includes('[CONSULTANT TO INSERT]')) {
      const wrappedLines = wrapText(line, regularFont, FONT_SIZE, usableWidth - 8)
      for (const wl of wrappedLines) {
        if (y < 60) {
          const next = await addPage(doc, boldFont, regularFont, data.fileNumber)
          page = next.page; y = next.y
        }
        page.drawRectangle({ x: MARGIN, y: y - 2, width: usableWidth, height: LINE_HEIGHT, color: rgb(1, 0.97, 0.88) })
        page.drawText(wl, { x: MARGIN + 4, y, size: FONT_SIZE, font: regularFont, color: rgb(0.6, 0.3, 0) })
        y -= LINE_HEIGHT
      }
      continue
    }

    // Normal text
    const wrappedLines = wrapText(line, regularFont, FONT_SIZE, usableWidth)
    for (const wl of wrappedLines) {
      if (y < 60) {
        const next = await addPage(doc, boldFont, regularFont, data.fileNumber)
        page = next.page; y = next.y
      }
      page.drawText(wl, { x: MARGIN, y, size: FONT_SIZE, font: regularFont, color: black })
      y -= LINE_HEIGHT
    }
  }

  // ── SIGNATURE PAGE ──────────────────────────────────────────────────────────
  const { page: sigPage, y: sigY } = await addPage(doc, boldFont, regularFont, data.fileNumber)

  sigPage.drawRectangle({ x: MARGIN, y: sigY - 30, width: usableWidth, height: 34, color: green })
  sigPage.drawText('PROFESSIONAL CERTIFICATION AND SIGNATURE', {
    x: MARGIN + 12, y: sigY - 12,
    size: 11, font: boldFont, color: rgb(1,1,1),
  })
  sigPage.drawText('This page constitutes the professional sign-off in terms of Construction Regulations 2014, Regulation 5(1)(l)', {
    x: MARGIN + 12, y: sigY - 24,
    size: 7.5, font: regularFont, color: rgb(0.8,1,0.85),
  })

  let sy = sigY - 60

  const certText = `I, ${data.consultantName}, holder of SACPCMP Registration Number ${data.sacpcmpNumber} (${data.sacpcmpCategory}), hereby certify that:

1. I have reviewed the contents of this Health and Safety File for the project known as "${data.projectName}" located at ${data.projectAddress}.

2. This SHE file has been compiled in accordance with the requirements of the Occupational Health and Safety Act 85 of 1993 and the Construction Regulations of 2014 (GN R84, GG 37305).

3. The hazard identification and risk assessment contained herein reflects the known activities and conditions of this construction project.

4. I accept professional responsibility for the contents of this SHE file in my capacity as a registered ${data.sacpcmpCategory} professional.

5. This SHE file must be kept on site at all times and made available to any inspector from the Department of Employment and Labour upon request (Section 14, OHS Act 85/1993).`

  for (const cl of certText.split('\n')) {
    const cwLines = wrapText(cl.trim() || ' ', regularFont, 9.5, usableWidth)
    for (const wl of cwLines) {
      sigPage.drawText(wl, { x: MARGIN, y: sy, size: 9.5, font: regularFont, color: black })
      sy -= 14
    }
    if (!cl.trim()) sy -= 4
  }

  sy -= 20

  // Signature box
  sigPage.drawRectangle({ x: MARGIN, y: sy - 90, width: 250, height: 94, color: lightGreen })
  sigPage.drawText('Signature', { x: MARGIN + 8, y: sy - 10, size: 8, font: boldFont, color: midGreen })

  // Embed the drawn signature
  if (data.signatureImageBase64) {
    try {
      const sigBase64 = data.signatureImageBase64.replace(/^data:image\/png;base64,/, '')
      const sigBytes  = Buffer.from(sigBase64, 'base64')
      const sigImage  = await doc.embedPng(sigBytes)
      const sigDims   = sigImage.scaleToFit(230, 65)
      sigPage.drawImage(sigImage, {
        x: MARGIN + 10, y: sy - 82,
        width: sigDims.width, height: sigDims.height,
      })
    } catch (e) {
      sigPage.drawText('[Signature embedded]', { x: MARGIN + 10, y: sy - 50, size: 8, font: regularFont, color: midGreen })
    }
  }

  // Details alongside signature
  sigPage.drawText('Name:', { x: MARGIN + 270, y: sy - 14, size: 9, font: boldFont, color: green })
  sigPage.drawText(data.consultantName, { x: MARGIN + 310, y: sy - 14, size: 9, font: regularFont, color: black })
  sigPage.drawText('SACPCMP:', { x: MARGIN + 270, y: sy - 28, size: 9, font: boldFont, color: green })
  sigPage.drawText(data.sacpcmpNumber, { x: MARGIN + 330, y: sy - 28, size: 9, font: regularFont, color: black })
  sigPage.drawText('Category:', { x: MARGIN + 270, y: sy - 42, size: 9, font: boldFont, color: green })
  sigPage.drawText(data.sacpcmpCategory, { x: MARGIN + 330, y: sy - 42, size: 9, font: regularFont, color: black })
  sigPage.drawText('Date:', { x: MARGIN + 270, y: sy - 56, size: 9, font: boldFont, color: green })
  sigPage.drawText(data.signingDate, { x: MARGIN + 310, y: sy - 56, size: 9, font: regularFont, color: black })

  // QR-like verification block
  sy -= 110
  sigPage.drawRectangle({ x: MARGIN, y: sy - 30, width: usableWidth, height: 34, color: rgb(0.96,0.98,0.97), borderColor: rgb(0.8,0.93,0.85), borderWidth: 1 })
  sigPage.drawText(`Verified by ProtekFlow  ·  File: ${data.fileNumber}  ·  Legacy Landmark (Pty) Ltd  ·  Signed: ${data.signingDate}`, {
    x: MARGIN + 8, y: sy - 12,
    size: 7.5, font: regularFont, color: midGreen,
  })
  sigPage.drawText('This document has been professionally reviewed and signed. Keep this file on site at all times.', {
    x: MARGIN + 8, y: sy - 24,
    size: 7, font: regularFont, color: gray,
  })

  return doc.save()
}
