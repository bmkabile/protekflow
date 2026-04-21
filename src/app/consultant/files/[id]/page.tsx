'use client'
// src/app/consultant/files/[id]/page.tsx
// Consultant fills in [CONSULTANT TO COMPLETE] fields, draws signature, generates PDF

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',
  white:'#ffffff', amber:'#fef3c7', amberText:'#92400e',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

const PLACEHOLDER = '[CONSULTANT TO COMPLETE]'

/** Parses draft text into segments: plain text or editable placeholders */
function parseDraft(text: string): Array<{ type: 'text'|'field'; content: string; id: number }> {
  const parts = text.split(/(\[CONSULTANT TO COMPLETE[^\]]*\]|\[CONSULTANT TO INSERT[^\]]*\]|\[CONSULTANT TO VERIFY[^\]]*\])/g)
  let fieldId = 0
  return parts.map(part => {
    if (/^\[CONSULTANT TO/.test(part)) {
      return { type: 'field' as const, content: part, id: fieldId++ }
    }
    return { type: 'text' as const, content: part, id: -1 }
  })
}

/** Merges filled values back into the document text */
function mergeDraft(segments: ReturnType<typeof parseDraft>, values: Record<number, string>): string {
  return segments.map(seg => {
    if (seg.type === 'field') return values[seg.id] ?? seg.content
    return seg.content
  }).join('')
}

export default function ConsultantFileEdit() {
  const { id }     = useParams<{ id: string }>()
  const router     = useRouter()
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const isDrawing  = useRef(false)

  const [file, setFile]                   = useState<any>(null)
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')
  const [attested, setAttested]           = useState(false)
  const [activeTab, setActiveTab]         = useState<'edit'|'info'|'preview'>('edit')
  const [segments, setSegments]           = useState<ReturnType<typeof parseDraft>>([])
  const [values, setValues]               = useState<Record<number, string>>({})
  const [hasSig, setHasSig]               = useState(false)

  // Load file
  useEffect(() => {
    fetch(`/api/files/${id}`)
      .then(r => r.json())
      .then(d => {
        setFile(d.file)
        if (d.file?.generated_draft) {
          const segs = parseDraft(d.file.generated_draft)
          setSegments(segs)
        }
        setLoading(false)
        // Mark as in_review
        fetch(`/api/files/${id}`, {
          method:'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ status:'in_review', review_started_at: new Date().toISOString() })
        }).catch(()=>{})
      })
      .catch(() => { setError('Failed to load file'); setLoading(false) })
  }, [id])

  // Signature canvas setup
  useEffect(() => {
    if (activeTab !== 'edit') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#14532d'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }, [activeTab])

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const ctx    = canvas.getContext('2d')!
    isDrawing.current = true
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }, [])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const ctx    = canvas.getContext('2d')!
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
    setHasSig(true)
  }, [])

  const endDraw = useCallback(() => { isDrawing.current = false }, [])

  const clearSig = () => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  const fieldCount     = segments.filter(s => s.type === 'field').length
  const filledCount    = Object.keys(values).filter(k => (values[Number(k)] ?? '').trim().length > 0).length
  const completionPct  = fieldCount > 0 ? Math.round((filledCount / fieldCount) * 100) : 0

  const handleSubmit = async () => {
    if (!attested) { setError('Please confirm the professional attestation.'); return }
    if (!hasSig)   { setError('Please draw your signature.'); return }
    if (filledCount < fieldCount) {
      const remaining = fieldCount - filledCount
      if (!window.confirm(`${remaining} section${remaining!==1?'s':''} are still marked [CONSULTANT TO COMPLETE]. Submit anyway?`)) return
    }

    setSubmitting(true); setError('')
    const completedText  = mergeDraft(segments, values)
    const signatureBase64 = canvasRef.current!.toDataURL('image/png')

    try {
      const res = await fetch(`/api/files/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedText, signatureBase64 }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Submission failed'); setSubmitting(false); return }
      setSuccess(`PDF generated successfully! File ${data.fileNumber} is now complete.`)
      setTimeout(() => router.push('/consultant'), 2500)
    } catch { setError('Network error — please try again.'); setSubmitting(false) }
  }

  const inp = { width:'100%', padding:'7px 10px', border:`1px solid ${C.g100}`,
    borderRadius:6, fontSize:12, color:C.g900, fontFamily:C.sans,
    outline:'none', background:'#fffef5', boxSizing:'border-box' as const,
    resize:'vertical' as const, minHeight:60 }

  if (loading) return (
    <div style={{minHeight:'100vh',background:C.g50,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.sans}}>
      <div style={{color:C.g500}}>Loading file…</div>
    </div>
  )

  if (!file) return (
    <div style={{minHeight:'100vh',background:C.g50,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.sans}}>
      <div style={{color:'#ef4444'}}>{error || 'File not found.'}</div>
    </div>
  )

  const slaRem  = file.sla_deadline ? new Date(file.sla_deadline).getTime() - Date.now() : null
  const slaHrs  = slaRem !== null ? Math.max(0, Math.round(slaRem/(3600000))) : null
  const slaPct  = slaRem !== null ? Math.max(0, Math.min(100, (slaRem/(48*3600000))*100)) : null
  const slaColor = slaPct !== null ? (slaPct<20?'#ef4444':slaPct<50?'#f59e0b':C.g600) : C.g600

  return (
    <div style={{fontFamily:C.sans,minHeight:'100vh',background:C.g50}}>
      {/* Nav */}
      <header style={{background:C.g900,padding:'0 24px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:40}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <svg width="26" height="26" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="7" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontFamily:C.serif,fontWeight:600,color:C.white,fontSize:16}}>ProtekFlow</span>
          <span style={{color:C.g400,fontSize:12,marginLeft:6}}>/ Review &amp; Sign</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {slaHrs !== null && (
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11,fontWeight:600,color:slaColor}}>{slaHrs}h SLA remaining</div>
              <div style={{width:120,height:3,background:C.g800,borderRadius:2,overflow:'hidden',marginTop:2}}>
                <div style={{width:`${slaPct}%`,height:'100%',background:slaColor}}/>
              </div>
            </div>
          )}
          <Link href="/consultant" style={{color:C.g400,fontSize:12,textDecoration:'none'}}>← Dashboard</Link>
        </div>
      </header>

      <div style={{maxWidth:920,margin:'0 auto',padding:'20px 16px'}}>

        {/* File header */}
        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'16px 20px',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
            <div>
              <div style={{fontFamily:'monospace',fontSize:11,color:C.g500,marginBottom:2}}>{file.file_number}</div>
              <h1 style={{fontFamily:C.serif,fontSize:19,fontWeight:700,color:C.g900,margin:'0 0 3px'}}>{file.project_name}</h1>
              <div style={{fontSize:13,color:C.g600}}>{file.project_address}</div>
            </div>
            {/* Completion progress */}
            <div style={{textAlign:'right',minWidth:160}}>
              <div style={{fontSize:12,color:C.g600,marginBottom:4}}>Sections completed</div>
              <div style={{fontSize:20,fontWeight:700,fontFamily:C.serif,color:completionPct===100?C.g700:C.g900}}>{filledCount}/{fieldCount}</div>
              <div style={{height:5,borderRadius:3,background:C.g100,overflow:'hidden',marginTop:4}}>
                <div style={{width:`${completionPct}%`,height:'100%',background:completionPct===100?C.g500:C.g400,transition:'width 0.3s'}}/>
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{display:'flex',gap:4,marginBottom:14}}>
          {([['edit','✏ Edit & Sign'],['info','ℹ Project info'],['preview','👁 Preview document']] as const).map(([t,l]) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
              fontSize:13, fontFamily:C.sans, fontWeight:500,
              background:activeTab===t?C.g900:'transparent',
              color:activeTab===t?C.white:C.g600,
              transition:'all 0.1s'
            }}>{l}</button>
          ))}
        </div>

        {/* ── TAB: Project info ─────────────────────────────────────────── */}
        {activeTab==='info' && (
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'18px 20px'}}>
            <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 14px'}}>Project information</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
              {[
                ['File number',    file.file_number],
                ['Project name',   file.project_name],
                ['Site address',   file.project_address],
                ['Client',         file.client_name??'—'],
                ['Site agent',     file.site_agent??'—'],
                ['Start date',     file.project_start_date??'—'],
                ['End date',       file.project_end_date??'—'],
                ['Project value',  file.project_value?`R${Number(file.project_value).toLocaleString('en-ZA')}`:'—'],
                ['Workers',        file.wizard_data?.workerCount??'—'],
                ['High-risk',      (file.wizard_data?.highRiskActivities??[]).join(', ')||'None declared'],
                ['Complex',        file.is_complex?'Yes — CHSM required':'No'],
                ['CIDB number',    file.wizard_data?.cidbNumber||'—'],
              ].map(([k,v]) => (
                <div key={String(k)} style={{display:'flex',justifyContent:'space-between',padding:'8px 4px',borderBottom:`1px solid ${C.g50}`,fontSize:13}}>
                  <span style={{color:C.g500}}>{k}</span>
                  <span style={{color:C.g900,fontWeight:500,textAlign:'right',maxWidth:'55%'}}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: Preview ──────────────────────────────────────────────── */}
        {activeTab==='preview' && (
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:0}}>Document preview</h2>
              <span style={{fontSize:12,color:C.g500}}>Unfilled fields shown in amber</span>
            </div>
            <div style={{background:'#fffef5',borderRadius:10,padding:'16px',maxHeight:500,overflow:'auto',fontFamily:'monospace',fontSize:11,lineHeight:2,color:C.g800,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
              {mergeDraft(segments, values).split('\n').map((line, i) => {
                const hasPlaceholder = /\[CONSULTANT TO/.test(line)
                return (
                  <div key={i} style={{background:hasPlaceholder?'#fef3c7':'transparent',borderRadius:hasPlaceholder?3:0,marginBottom:1}}>
                    {line || ' '}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── TAB: Edit & Sign ──────────────────────────────────────────── */}
        {activeTab==='edit' && (<>

          {/* Editable document */}
          {!file.generated_draft ? (
            <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:12,padding:20,marginBottom:14,textAlign:'center'}}>
              <div style={{fontSize:14,fontWeight:600,color:C.amberText,marginBottom:6}}>No AI draft available</div>
              <div style={{fontSize:13,color:C.amberText}}>The AI draft for this file was not generated (template may not be seeded yet). Please review the project details and complete the document manually.</div>
            </div>
          ) : (
            <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,marginBottom:14,overflow:'hidden'}}>
              <div style={{background:C.g900,padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.white}}>SHE file document</div>
                  <div style={{fontSize:11,color:C.g300,marginTop:1}}>Fill in all amber fields. Contractor fields are pre-populated.</div>
                </div>
                <div style={{fontSize:12,color:completionPct===100?C.g400:'#f59e0b',fontWeight:600}}>
                  {completionPct}% complete
                </div>
              </div>
              <div style={{padding:'16px 18px',maxHeight:520,overflow:'auto',fontSize:12,lineHeight:1.9,fontFamily:'monospace',color:C.g800,whiteSpace:'pre-wrap'}}>
                {segments.map((seg, idx) => {
                  if (seg.type === 'text') return <span key={idx}>{seg.content}</span>
                  // Editable field
                  const val = values[seg.id] ?? ''
                  const isFilled = val.trim().length > 0
                  return (
                    <span key={idx} style={{display:'inline-block',minWidth:120,verticalAlign:'middle',margin:'0 2px'}}>
                      <input
                        value={val}
                        onChange={e => setValues(v => ({...v,[seg.id]:e.target.value}))}
                        placeholder="Complete this field…"
                        style={{
                          background: isFilled ? '#f0fdf4' : C.amber,
                          border: `1px solid ${isFilled?C.g300:'#fde68a'}`,
                          borderRadius:5, padding:'2px 8px',
                          fontSize:11, fontFamily:C.sans, color:C.g900,
                          outline:'none', minWidth:160, verticalAlign:'middle',
                        }}
                      />
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Signature pad */}
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'18px 20px',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 3px'}}>Professional signature</h2>
                <p style={{fontSize:12,color:C.g500,margin:0}}>Draw your signature in the box below using your mouse or trackpad.</p>
              </div>
              <button onClick={clearSig} style={{fontSize:12,color:C.g600,background:'none',border:`1px solid ${C.g200}`,padding:'5px 12px',borderRadius:7,cursor:'pointer',fontFamily:C.sans}}>
                Clear
              </button>
            </div>
            <div style={{border:`2px dashed ${hasSig?C.g400:C.g200}`,borderRadius:10,overflow:'hidden',cursor:'crosshair',background:'#fcfffe',transition:'border-color 0.15s'}}>
              <canvas
                ref={canvasRef}
                width={800} height={140}
                style={{display:'block',width:'100%',height:140,touchAction:'none'}}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
              />
            </div>
            {!hasSig && (
              <div style={{textAlign:'center',fontSize:12,color:C.g400,marginTop:8}}>
                Draw your signature above to enable document signing
              </div>
            )}
          </div>

          {/* Attestation */}
          <div style={{background:C.g900,borderRadius:12,padding:'16px 20px',marginBottom:14}}>
            <h3 style={{fontSize:13,fontWeight:600,color:C.g200,margin:'0 0 8px'}}>Professional attestation</h3>
            <p style={{fontSize:12,color:C.g300,lineHeight:1.65,marginBottom:12}}>
              By signing this document, I confirm that I am a currently registered SACPCMP Health and Safety professional, that I have reviewed and am satisfied with the content of this SHE file, that it complies with the OHS Act 85/1993 and Construction Regulations 2014, and that I accept professional responsibility for this signed document.
            </p>
            <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
              <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)}
                style={{marginTop:2,accentColor:C.g500,width:15,height:15,flexShrink:0}}/>
              <span style={{fontSize:12,color:C.g200,lineHeight:1.5}}>
                I confirm this attestation and accept professional responsibility for this SHE file.
              </span>
            </label>
          </div>

          {error && (
            <div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px',marginBottom:12}}>
              {error}
            </div>
          )}
          {success && (
            <div style={{background:C.g100,border:`1px solid ${C.g300}`,color:C.g800,fontSize:13,borderRadius:8,padding:'12px 16px',marginBottom:12,fontWeight:600}}>
              ✓ {success}
            </div>
          )}

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <Link href="/consultant" style={{background:'transparent',border:`1px solid ${C.g200}`,color:C.g700,fontWeight:500,padding:'10px 20px',borderRadius:9,fontSize:13,textDecoration:'none'}}>
              ← Back
            </Link>
            <button onClick={handleSubmit}
              disabled={submitting || !attested || !hasSig}
              style={{
                background: submitting||!attested||!hasSig ? C.g200 : C.g500,
                color: submitting||!attested||!hasSig ? C.g500 : C.g950,
                fontWeight:700, padding:'12px 32px', borderRadius:10,
                border:'none', cursor: submitting||!attested||!hasSig?'not-allowed':'pointer',
                fontSize:14, fontFamily:C.sans, opacity:submitting?0.7:1,
                transition:'all 0.15s',
              }}>
              {submitting ? 'Generating PDF…' : `Sign & Generate PDF →`}
            </button>
          </div>

          {(!attested || !hasSig) && (
            <p style={{textAlign:'center',fontSize:11,color:C.g400,marginTop:8}}>
              {!hasSig && !attested ? 'Draw signature and confirm attestation to sign'
               : !hasSig ? 'Draw your signature to sign'
               : 'Confirm attestation to sign'}
            </p>
          )}
        </>)}

      </div>
    </div>
  )
}
