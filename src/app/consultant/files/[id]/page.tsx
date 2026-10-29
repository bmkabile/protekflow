'use client'
// src/app/consultant/files/[id]/page.tsx
// Reviewer workspace: review the draft section by section, resolve every placeholder,
// edit any text, sign, and generate the PDF. Progress autosaves to the server.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  splitSections, joinSections, parseBlocks, applyFieldValues, countPlaceholders,
  makePlaceholderRe, type Section,
} from '@/lib/doc-format'
import { highRiskLabel, projectTypeLabel } from '@/lib/templates'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',g950:'#052e16',
  white:'#ffffff', amber:'#fef3c7', amberBorder:'#fde68a', amberText:'#92400e',
  ai:'#f5f3ff', aiBorder:'#c4b5fd', aiText:'#5b21b6',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}
const REMOVE = '\u0001'                      // value meaning "confirmed - delete the flag"
const resolve = (v: string | undefined) => (v === REMOVE ? '' : v)
const fieldRe = new RegExp(`(${makePlaceholderRe().source})`, 'g')

type Values = Record<string, string>         // key: `${sectionIndex}:${n}`

function sectionValues(values: Values, si: number): Record<number, string | undefined> {
  const out: Record<number, string | undefined> = {}
  for (const [k, v] of Object.entries(values)) {
    const [s, n] = k.split(':').map(Number)
    if (s === si && v && v.trim()) out[n] = resolve(v)
  }
  return out
}

/** One placeholder rendered as an input */
function Field(props: {
  token: string; value: string; inTable: boolean; onChange: (v: string) => void
}) {
  const { token, value, inTable, onChange } = props
  const kind = (token.match(/TO (COMPLETE|INSERT|VERIFY)/) ?? [])[1] as 'COMPLETE' | 'INSERT' | 'VERIFY'
  const hint = token.replace(/^\[CONSULTANT TO (COMPLETE|INSERT|VERIFY):?\s*/, '').replace(/\]$/, '').trim()
  const filled = value.trim().length > 0 && value !== REMOVE
  const shown = value === REMOVE ? '' : value
  const base = {
    background: filled ? '#f0fdf4' : C.amber, border: `1px solid ${filled ? C.g300 : C.amberBorder}`,
    borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: C.sans, color: C.g900, outline: 'none',
    boxSizing: 'border-box' as const, width: '100%',
  }
  const attrs = filled ? {} : { 'data-unfilled': '1' }

  if (kind === 'INSERT') return (
    <span style={{display:'block',margin:'6px 0'}}>
      <span style={{fontSize:11,color:C.amberText,display:'block',marginBottom:3}}>Insert: {hint || 'content required'}</span>
      <textarea {...attrs} value={shown} onChange={e => onChange(e.target.value)} rows={4} style={{...base, resize:'vertical'}} placeholder="Write or paste the content here" />
    </span>
  )
  if (kind === 'VERIFY') return (
    <span style={{display:'inline-flex',flexWrap:'wrap',alignItems:'center',gap:6,margin:'2px 0',maxWidth:'100%'}}>
      {!filled && <span style={{fontSize:11,color:C.amberText,background:C.amber,border:`1px solid ${C.amberBorder}`,borderRadius:5,padding:'2px 6px'}}>Verify: {hint}</span>}
      {filled && <span style={{fontSize:12,color:C.g800}}>{value === REMOVE ? 'Verified (flag removed)' : shown}</span>}
      {inTable ? (<>
        <button type="button" onClick={() => onChange('Yes')} style={chip}>Yes</button>
        <button type="button" onClick={() => onChange('N/A')} style={chip}>N/A</button>
        <input {...attrs} value={value === REMOVE ? '' : shown} onChange={e => onChange(e.target.value)} placeholder="or type" style={{...base, width:110}} />
      </>) : (<>
        <button type="button" onClick={() => onChange(REMOVE)} style={{...chip, background:C.g100, borderColor:C.g300, color:C.g800}}>Confirm &amp; remove flag</button>
        <input value={value === REMOVE ? '' : shown} onChange={e => onChange(e.target.value)} placeholder="or replace with a note" style={{...base, width:190}} />
      </>)}
      {filled && <button type="button" onClick={() => onChange('')} style={{...chip, color:C.g600}}>Undo</button>}
    </span>
  )
  return (
    <input {...attrs} value={shown} onChange={e => onChange(e.target.value)} placeholder={hint || 'Complete this field'} title={hint}
      style={{...base, width: inTable ? '100%' : 'min(100%, 280px)', display: inTable ? 'block' : 'inline-block', margin: inTable ? 0 : '0 2px'}} />
  )
}
const chip = { fontSize:11, padding:'2px 8px', borderRadius:5, border:`1px solid ${C.g200}`, background:C.white, color:C.g700, cursor:'pointer', fontFamily:C.sans } as const

export default function ConsultantFileEdit() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)
  const lastSaved = useRef('')
  const dirty     = useRef(false)

  const [file, setFile]               = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [drafting, setDrafting]       = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [attested, setAttested]       = useState(false)
  const [hasSig, setHasSig]           = useState(false)
  const [tab, setTab]                 = useState<'edit'|'info'|'preview'>('edit')
  const [sections, setSections]       = useState<Section[]>([])
  const [values, setValues]           = useState<Values>({})
  const [reviewed, setReviewed]       = useState<boolean[]>([])
  const [rawEdit, setRawEdit]         = useState<{ si: number; text: string } | null>(null)
  const [initialTotal, setInitialTotal] = useState(0)
  const [saveState, setSaveState]     = useState<'idle'|'saving'|'saved'|'error'>('idle')

  /* ---------- loading ---------- */
  const applyFile = useCallback((f: any) => {
    setFile(f)
    if (!f?.generated_draft) return
    const rs = f.review_state
    if (rs?.v === 1 && Array.isArray(rs.sections) && rs.sections.length) {
      setSections(rs.sections); setValues(rs.values ?? {}); setReviewed(rs.reviewed ?? rs.sections.map(() => false))
      setInitialTotal(rs.initialTotal ?? countPlaceholders(f.generated_draft))
    } else {
      const secs = splitSections(f.generated_draft).filter(s => s.title || s.body.trim())
      setSections(secs); setValues({}); setReviewed(secs.map(() => false))
      setInitialTotal(countPlaceholders(f.generated_draft))
    }
  }, [])

  const fetchFile = useCallback(async () => {
    const r = await fetch(`/api/files/${id}`); const d = await r.json()
    if (!r.ok) throw new Error(d.error ?? 'Failed to load file')
    return d.file
  }, [id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const f = await fetchFile()
        if (cancelled) return
        applyFile(f); setLoading(false)
        // Mark as in review (ignored by the server once the file is no longer open)
        fetch(`/api/files/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'in_review' }) }).catch(() => {})
        // No draft yet: generate it now (idempotent; the server returns quickly if one is already running)
        if (!f.generated_draft && ['paid','matched','in_review'].includes(f.status)) {
          setDrafting(true)
          for (let i = 0; i < 30 && !cancelled; i++) {
            const res = await fetch(`/api/files/${id}/draft`, { method:'POST' }).then(r => r.json()).catch(() => ({}))
            const nf = await fetchFile().catch(() => null)
            if (nf?.generated_draft || nf?.draft_status === 'failed' || res.status === 'failed') { if (nf) applyFile(nf); break }
            await new Promise(r => setTimeout(r, 6000))
          }
          if (!cancelled) setDrafting(false)
        }
      } catch (e: any) { if (!cancelled) { setError(e.message ?? 'Failed to load file'); setLoading(false) } }
    })()
    return () => { cancelled = true }
  }, [id, applyFile, fetchFile])

  /* ---------- document model ---------- */
  const mergeSection = useCallback((si: number) => applyFieldValues(sections[si]?.body ?? '', sectionValues(values, si)), [sections, values])
  const mergedFull = useMemo(
    () => joinSections(sections.map((s, i) => ({ title: s.title, body: applyFieldValues(s.body, sectionValues(values, i)) }))),
    [sections, values])
  const unresolved = useMemo(() => countPlaceholders(mergedFull), [mergedFull])
  const sectionUnresolved = (si: number) => countPlaceholders(mergeSection(si))
  const pct = initialTotal > 0 ? Math.max(0, Math.min(100, Math.round(((initialTotal - unresolved) / initialTotal) * 100))) : (sections.length ? 100 : 0)
  const allReviewed = sections.length > 0 && reviewed.length === sections.length && reviewed.every(Boolean)

  const setField = (si: number, n: number, v: string) => { dirty.current = true; setValues(prev => ({ ...prev, [`${si}:${n}`]: v })) }
  const toggleReviewed = (si: number) => { dirty.current = true; setReviewed(r => r.map((x, i) => (i === si ? !x : x))) }

  const startRaw = (si: number) => {
    const merged = mergeSection(si)
    dirty.current = true
    setSections(s => s.map((sec, i) => (i === si ? { ...sec, body: merged } : sec)))
    setValues(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k.split(':')[0]) !== si)))
    setReviewed(r => r.map((x, i) => (i === si ? false : x)))
    setRawEdit({ si, text: merged })
  }
  const saveRaw = () => {
    if (!rawEdit) return
    dirty.current = true
    setSections(s => s.map((sec, i) => (i === rawEdit.si ? { ...sec, body: rawEdit.text.replace(/\r/g, '') } : sec)))
    setRawEdit(null)
  }

  /* ---------- autosave ---------- */
  useEffect(() => {
    if (!file || !dirty.current || file.status === 'completed') return
    const state = { v: 1, sections, values, reviewed, initialTotal, savedAt: new Date().toISOString() }
    const snapshot = JSON.stringify({ sections, values, reviewed })
    if (snapshot === lastSaved.current) return
    setSaveState('saving')
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/files/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ review_state: state }) })
        if (!r.ok) throw new Error()
        lastSaved.current = snapshot; setSaveState('saved')
      } catch { setSaveState('error') }
    }, 1500)
    return () => clearTimeout(t)
  }, [sections, values, reviewed, initialTotal, file, id])

  const jumpToNext = () => {
    const el = document.querySelector<HTMLElement>('[data-unfilled="1"]')
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => el.focus?.(), 300)
  }

  /* ---------- signature (pointer events: mouse, touch and pen) ---------- */
  useEffect(() => {
    if (tab !== 'edit') return
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return
    ctx.strokeStyle = '#14532d'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  }, [tab, loading])
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!, r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext('2d')!; e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSig(true)
  }
  const endDraw = () => { drawing.current = false }
  const clearSig = () => { const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHasSig(false) }

  /* ---------- submit ---------- */
  const canSign = unresolved === 0 && allReviewed && attested && hasSig && !submitting && !rawEdit
  const handleSubmit = async () => {
    setError('')
    if (unresolved > 0) return setError(`${unresolved} placeholder(s) are still unresolved.`)
    if (!allReviewed)   return setError('Tick "Reviewed" on every section before signing.')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/files/${id}/complete`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ completedText: mergedFull, signatureBase64: canvasRef.current!.toDataURL('image/png') }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Submission failed'); setSubmitting(false); return }
      setSuccess(`Signed. File ${data.fileNumber} is complete and the PDF is stored securely.`)
      setTimeout(() => router.push('/consultant'), 2500)
    } catch { setError('Network error - please try again.'); setSubmitting(false) }
  }

  /* ---------- rendering helpers ---------- */
  const renderInline = (text: string, si: number, counter: { n: number }, inTable: boolean) =>
    text.split(fieldRe).map((part, i) => {
      if (!/^\[CONSULTANT TO (COMPLETE|INSERT|VERIFY)/.test(part)) return <span key={i}>{part}</span>
      const n = counter.n++
      return <Field key={i} token={part} inTable={inTable} value={values[`${si}:${n}`] ?? ''} onChange={v => setField(si, n, v)} />
    })

  const aiBox = (ai: boolean, node: React.ReactNode, key: number) => ai
    ? <div key={key} style={{background:C.ai,borderLeft:`3px solid ${C.aiBorder}`,borderRadius:6,padding:'8px 12px',margin:'8px 0'}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:0.4,color:C.aiText,marginBottom:4}}>AI-WRITTEN - REVIEW CAREFULLY</div>{node}</div>
    : <div key={key}>{node}</div>

  const renderSection = (sec: Section, si: number) => {
    const counter = { n: 0 }
    return parseBlocks(sec.body).map((b, bi) => {
      let node: React.ReactNode
      if (b.type === 'h3') node = <div style={{fontWeight:700,color:C.g900,fontSize:13,margin:'12px 0 4px'}}>{renderInline(b.text, si, counter, false)}</div>
      else if (b.type === 'para') node = <div style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.7,color:C.g900,margin:'4px 0'}}>{renderInline(b.text, si, counter, false)}</div>
      else if (b.type === 'bullets') node = <ul style={{margin:'4px 0',paddingLeft:20,fontSize:13,lineHeight:1.7,color:C.g900}}>{b.items.map((it, ii) => <li key={ii}>{renderInline(it, si, counter, false)}</li>)}</ul>
      else node = (
        <div style={{overflowX:'auto',margin:'8px 0'}}>
          <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
            <tbody>{b.rows.map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => ri === 0
                ? <th key={ci} style={{textAlign:'left',background:C.g100,color:C.g900,border:`1px solid ${C.g200}`,padding:'6px 8px',fontSize:11}}>{cell}</th>
                : <td key={ci} style={{border:`1px solid ${C.g100}`,padding:'5px 8px',verticalAlign:'top',minWidth:90}}>{renderInline(cell, si, counter, true)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>)
      return aiBox(b.ai, node, bi)
    })
  }

  /* ---------- screens ---------- */
  const wrap = (children: React.ReactNode) => <div style={{minHeight:'100vh',background:C.g50,fontFamily:C.sans}}>{children}</div>
  if (loading) return wrap(<div style={{padding:60,textAlign:'center',color:C.g500}}>Loading file...</div>)
  if (!file)   return wrap(<div style={{padding:60,textAlign:'center',color:'#ef4444'}}>{error || 'File not found.'}</div>)

  const w = file.wizard_data ?? {}
  const closed = ['completed','signed','awaiting_sign','cancelled'].includes(file.status)
  const report = file.draft_report
  const aiWritten = report?.blocks?.filter((b: any) => b?.ok).length ?? 0
  const aiTotal = report?.blocks?.length ?? 0

  return wrap(<>
    <header style={{background:C.g900,padding:'12px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{fontFamily:C.serif,fontWeight:600,color:C.white,fontSize:16}}>ProtekFlow <span style={{color:C.g400,fontWeight:400,fontSize:13}}>/ Review {file.file_number}</span></div>
      <Link href="/consultant" style={{color:C.g300,fontSize:13,textDecoration:'none'}}>&larr; Back to dashboard</Link>
    </header>

    <div style={{maxWidth:900,margin:'0 auto',padding:'22px 20px 60px'}}>
      {/* File summary + progress */}
      <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'16px 20px',marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div>
            <h1 style={{fontFamily:C.serif,fontSize:19,fontWeight:700,color:C.g900,margin:'0 0 3px'}}>{file.project_name}</h1>
            <div style={{fontSize:13,color:'#4b5563'}}>{file.project_address}</div>
            {aiTotal > 0 && <div style={{fontSize:12,color:C.aiText,marginTop:6}}>AI wrote {aiWritten} of {aiTotal} blocks{aiWritten < aiTotal ? `; the rest are left for you to write` : ''}. Template v{file.template_version ?? '?'}.</div>}
          </div>
          <div style={{textAlign:'right',minWidth:170}}>
            <div style={{fontSize:12,color:'#4b5563',marginBottom:2}}>Placeholders resolved</div>
            <div style={{fontSize:20,fontWeight:700,fontFamily:C.serif,color:unresolved===0?C.g700:C.g900}}>{Math.max(0,initialTotal-unresolved)}/{initialTotal}</div>
            <div style={{height:5,borderRadius:3,background:C.g100,overflow:'hidden',marginTop:4}}><div style={{width:`${pct}%`,height:'100%',background:C.g500,transition:'width 0.3s'}}/></div>
            <div style={{fontSize:11,color:'#6b7280',marginTop:4}}>{saveState==='saving'?'Saving...':saveState==='saved'?'Progress saved':saveState==='error'?'Could not save - check connection':''}</div>
          </div>
        </div>
      </div>

      {closed && (
        <div style={{background:C.g100,border:`1px solid ${C.g300}`,borderRadius:10,padding:'12px 16px',marginBottom:14,fontSize:13,color:C.g800}}>
          This file is <b>{file.status}</b> and can no longer be edited. {file.status === 'completed' && <a href={`/api/files/${id}/download`} style={{color:C.g700,fontWeight:600}}>Download the signed PDF</a>}
        </div>
      )}

      <div style={{display:'flex',gap:4,marginBottom:14}}>
        {([['edit','Review & sign'],['info','Project info'],['preview','Preview']] as const).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontFamily:C.sans,fontWeight:500,background:tab===t?C.g900:'transparent',color:tab===t?C.white:'#4b5563'}}>{l}</button>
        ))}
      </div>

      {/* ---------- INFO ---------- */}
      {tab==='info' && (
        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'18px 20px'}}>
          <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 14px'}}>Project information</h2>
          {[
            ['File number', file.file_number], ['Project name', file.project_name], ['Type of work', projectTypeLabel(w.projectType)],
            ['Site address', file.project_address], ['Client', file.client_name ?? '--'], ['Site agent', file.site_agent ?? '--'],
            ['Start date', file.project_start_date ?? '--'], ['End date', file.project_end_date ?? '--'],
            ['Project value', file.project_value ? `R${Number(file.project_value).toLocaleString('en-ZA')}` : '--'],
            ['Workers', w.workerCount ?? '--'], ['CIDB', [w.cidbNumber, w.cidbGrade && `grade ${w.cidbGrade}`].filter(Boolean).join(', ') || '--'],
            ['High-risk activities', (w.highRiskActivities ?? []).map(highRiskLabel).join(', ') || 'None declared'],
            ['Complex project', file.is_complex ? 'Yes - senior (CHSM) sign-off' : 'No'],
            ['Subcontractors', w.subcontractors || 'None declared'],
          ].map(([k, v]) => (
            <div key={String(k)} style={{display:'flex',justifyContent:'space-between',gap:16,padding:'8px 4px',borderBottom:`1px solid ${C.g50}`,fontSize:13}}>
              <span style={{color:'#6b7280'}}>{k}</span><span style={{color:C.g900,fontWeight:500,textAlign:'right',maxWidth:'62%',whiteSpace:'pre-wrap'}}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---------- PREVIEW ---------- */}
      {tab==='preview' && (
        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'18px 20px'}}>
          <div style={{fontSize:12,color:'#6b7280',marginBottom:10}}>How the document reads now. Unresolved placeholders are highlighted.</div>
          {splitSections(mergedFull).map((sec, i) => (
            <div key={i} style={{marginBottom:18}}>
              {sec.title && <div style={{background:C.g900,color:C.white,fontSize:12,fontWeight:700,padding:'6px 10px',borderRadius:4,marginBottom:6}}>{sec.title.toUpperCase()}</div>}
              {parseBlocks(sec.body).map((b, bi) => {
                const hl = (t: string) => t.split(fieldRe).map((p, k) => /^\[CONSULTANT TO/.test(p) ? <mark key={k} style={{background:C.amber,padding:'0 2px'}}>{p}</mark> : <span key={k}>{p}</span>)
                if (b.type === 'h3') return <div key={bi} style={{fontWeight:700,fontSize:13,margin:'10px 0 3px',color:C.g900}}>{hl(b.text)}</div>
                if (b.type === 'para') return <div key={bi} style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.65,margin:'3px 0'}}>{hl(b.text)}</div>
                if (b.type === 'bullets') return <ul key={bi} style={{margin:'3px 0',paddingLeft:20,fontSize:13,lineHeight:1.65}}>{b.items.map((it, k) => <li key={k}>{hl(it)}</li>)}</ul>
                return <div key={bi} style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:12,margin:'6px 0'}}><tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => ri===0 ? <th key={ci} style={{textAlign:'left',background:C.g100,border:`1px solid ${C.g200}`,padding:'5px 8px'}}>{c}</th> : <td key={ci} style={{border:`1px solid ${C.g100}`,padding:'5px 8px',verticalAlign:'top'}}>{hl(c)}</td>)}</tr>)}</tbody></table></div>
              })}
            </div>
          ))}
        </div>
      )}

      {/* ---------- REVIEW & SIGN ---------- */}
      {tab==='edit' && (<>
        {drafting && (
          <div style={{background:C.white,border:`1px solid ${C.g200}`,borderRadius:12,padding:22,marginBottom:14,textAlign:'center',color:C.g800,fontSize:14}}>
            Preparing the draft for this file. This usually takes under a minute; you can keep this page open.
          </div>
        )}
        {!drafting && sections.length === 0 && (
          <div style={{background:C.amber,border:`1px solid ${C.amberBorder}`,borderRadius:12,padding:20,marginBottom:14,textAlign:'center'}}>
            <div style={{fontSize:14,fontWeight:600,color:C.amberText,marginBottom:6}}>No draft is available yet</div>
            <div style={{fontSize:13,color:C.amberText,marginBottom:12}}>{file.draft_report?.error ?? 'The draft has not been generated.'}</div>
            {!closed && <button onClick={() => location.reload()} style={{...chip,fontSize:13,padding:'6px 14px'}}>Try again</button>}
          </div>
        )}

        {sections.length > 0 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'0 0 10px',gap:10,flexWrap:'wrap'}}>
            <div style={{fontSize:12,color:'#4b5563'}}>
              <span style={{background:C.amber,border:`1px solid ${C.amberBorder}`,borderRadius:4,padding:'1px 6px',marginRight:8}}>amber = needs you</span>
              <span style={{background:C.ai,border:`1px solid ${C.aiBorder}`,borderRadius:4,padding:'1px 6px'}}>purple = AI-written text</span>
            </div>
            {unresolved > 0 && <button onClick={jumpToNext} style={{...chip,fontSize:12,padding:'5px 12px',background:C.g900,color:C.white,borderColor:C.g900}}>Jump to next unfilled field</button>}
          </div>
        )}

        {sections.map((sec, si) => {
          const left = sectionUnresolved(si)
          const editing = rawEdit?.si === si
          return (
            <div key={si} style={{background:C.white,border:`1px solid ${reviewed[si]?C.g300:C.g100}`,borderRadius:12,marginBottom:12,overflow:'hidden'}}>
              <div style={{background:reviewed[si]?C.g700:C.g900,padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
                <div style={{color:C.white,fontSize:13,fontWeight:600}}>{sec.title || 'Document'}</div>
                <div style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}>
                  <span style={{color:left?'#fcd34d':C.g200}}>{left ? `${left} to complete` : 'complete'}</span>
                  {!closed && !editing && <button onClick={() => startRaw(si)} style={{...chip,background:'transparent',color:C.g200,borderColor:C.g600}}>Edit text</button>}
                  {!closed && <label style={{color:C.white,display:'flex',alignItems:'center',gap:5,cursor:'pointer'}}>
                    <input type="checkbox" checked={!!reviewed[si]} disabled={editing} onChange={() => toggleReviewed(si)} style={{accentColor:C.g400}} /> Reviewed
                  </label>}
                </div>
              </div>
              <div style={{padding:'10px 16px 14px'}}>
                {editing ? (<>
                  <div style={{fontSize:11,color:'#6b7280',marginBottom:6}}>Edit the raw text. Tables use | separators; keep [CONSULTANT TO ...] placeholders if something still needs resolving.</div>
                  <textarea value={rawEdit!.text} onChange={e => setRawEdit({ si, text: e.target.value })} rows={16}
                    style={{width:'100%',boxSizing:'border-box',fontFamily:'monospace',fontSize:12,lineHeight:1.6,padding:10,border:`1px solid ${C.g200}`,borderRadius:8}} />
                  <div style={{display:'flex',gap:8,marginTop:8}}>
                    <button onClick={saveRaw} style={{...chip,background:C.g700,color:C.white,borderColor:C.g700,padding:'6px 14px',fontSize:12}}>Save changes</button>
                    <button onClick={() => setRawEdit(null)} style={{...chip,padding:'6px 14px',fontSize:12}}>Cancel</button>
                  </div>
                </>) : renderSection(sec, si)}
              </div>
            </div>
          )
        })}

        {sections.length > 0 && !closed && (<>
          {/* Signature */}
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'18px 20px',margin:'16px 0 14px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 3px'}}>Professional signature</h2>
                <p style={{fontSize:12,color:'#6b7280',margin:0}}>Draw your signature with a mouse, finger or stylus.</p>
              </div>
              <button onClick={clearSig} style={{...chip,fontSize:12,padding:'5px 12px'}}>Clear</button>
            </div>
            <div style={{border:`2px dashed ${hasSig?C.g400:C.g200}`,borderRadius:10,overflow:'hidden',background:'#fcfffe'}}>
              <canvas ref={canvasRef} width={800} height={160}
                style={{display:'block',width:'100%',height:160,touchAction:'none',cursor:'crosshair'}}
                onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerLeave={endDraw} onPointerCancel={endDraw} />
            </div>
          </div>

          {/* Attestation */}
          <div style={{background:C.g900,borderRadius:12,padding:'16px 20px',marginBottom:14}}>
            <h3 style={{fontSize:13,fontWeight:600,color:C.g200,margin:'0 0 8px'}}>Professional attestation</h3>
            <p style={{fontSize:12,color:C.g300,lineHeight:1.65,margin:'0 0 12px'}}>
              By signing, I confirm that I am a currently registered SACPCMP professional, that I have reviewed every section of this SHE file, and that I accept professional responsibility for its content.
            </p>
            <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
              <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} style={{marginTop:2,accentColor:C.g500,width:15,height:15}} />
              <span style={{fontSize:12,color:C.g200,lineHeight:1.5}}>I confirm this attestation.</span>
            </label>
          </div>

          {error && <div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px',marginBottom:12}}>{error}</div>}
          {success && <div style={{background:C.g100,border:`1px solid ${C.g300}`,color:C.g800,fontSize:13,borderRadius:8,padding:'12px 16px',marginBottom:12,fontWeight:600}}>{success}</div>}

          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <button onClick={handleSubmit} disabled={!canSign} style={{
              background: canSign ? C.g500 : C.g200, color: canSign ? C.g950 : '#6b7280', fontWeight:700, padding:'12px 32px', borderRadius:10,
              border:'none', cursor: canSign ? 'pointer' : 'not-allowed', fontSize:14, fontFamily:C.sans }}>
              {submitting ? 'Generating PDF...' : 'Sign & generate PDF'}
            </button>
          </div>
          {!canSign && !submitting && (
            <p style={{textAlign:'right',fontSize:12,color:'#6b7280',marginTop:8}}>
              To sign: {[
                unresolved > 0 && `resolve ${unresolved} placeholder${unresolved!==1?'s':''}`,
                !allReviewed && 'tick Reviewed on every section',
                !hasSig && 'draw your signature',
                !attested && 'confirm the attestation',
              ].filter(Boolean).join(', ')}.
            </p>
          )}
        </>)}
        {sections.length > 0 && closed && error && <div style={{color:'#991b1b',fontSize:13}}>{error}</div>}
      </>)}
    </div>
  </>)
}
