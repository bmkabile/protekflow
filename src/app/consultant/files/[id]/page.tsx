'use client'
// src/app/consultant/files/[id]/page.tsx
// Consultant reviews AI-generated draft and triggers DocuSeal signing

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',
  white:'#ffffff', amber:'#fef3c7', amberText:'#92400e',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

const SECTIONS = [
  'Legal framework',
  'Project team & appointments (CR8)',
  'Scope of work',
  'Hazard identification & risk assessment (CR9)',
  'Emergency preparedness plan (CR29)',
  'Site rules & induction (CR8(4))',
  'First aid arrangements (GS Reg 3)',
  'Incident reporting & investigation (CR23)',
  'PPE register (GS Reg 2)',
  'Fall protection plan (CR10)',
  'Excavation work (CR11)',
  'Electrical installation (CR22)',
  'Plant, machinery & equipment (CR21)',
  'Fire prevention (GN R924)',
  'Housekeeping & waste (CR27)',
  'Toolbox talks register',
  'Subcontractor management (CR7)',
  'Professional certification',
]

export default function ConsultantFileReview() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const [file, setFile]             = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [signing, setSigning]       = useState(false)
  const [attested, setAttested]     = useState(false)
  const [checkedSections, setCheckedSections] = useState<number[]>([])
  const [error, setError]           = useState('')
  const [activeTab, setActiveTab]   = useState<'draft'|'sections'|'info'>('info')

  useEffect(() => {
    fetch(`/api/files/${id}`)
      .then(r => r.json())
      .then(d => { setFile(d.file); setLoading(false) })
      .catch(() => { setError('Failed to load file'); setLoading(false) })

    // Mark as in_review when consultant opens it
    fetch(`/api/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_review', review_started_at: new Date().toISOString() }),
    }).catch(() => {})
  }, [id])

  const toggleSection = (i: number) =>
    setCheckedSections(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  const allChecked = checkedSections.length === SECTIONS.length

  const handleSign = async () => {
    if (!attested) { setError('Please confirm the professional attestation before signing.'); return }
    setSigning(true); setError('')
    try {
      const res = await fetch(`/api/files/${id}/sign`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to initiate signing'); setSigning(false); return }
      // Redirect to DocuSeal signing URL
      window.location.href = data.signing_url
    } catch { setError('Network error — please try again.'); setSigning(false) }
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:C.g50,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.sans}}>
      <div style={{color:C.g500,fontSize:14}}>Loading file…</div>
    </div>
  )

  if (!file) return (
    <div style={{minHeight:'100vh',background:C.g50,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.sans}}>
      <div style={{color:'#ef4444',fontSize:14}}>{error || 'File not found or not assigned to you.'}</div>
    </div>
  )

  const slaRemaining = file.sla_deadline
    ? new Date(file.sla_deadline).getTime() - Date.now() : null
  const slaHrs = slaRemaining !== null ? Math.max(0, Math.round(slaRemaining/(1000*60*60))) : null
  const slaPct = slaRemaining !== null ? Math.max(0, Math.min(100, (slaRemaining/(48*3600000))*100)) : null
  const slaColor = slaPct !== null ? (slaPct<20?'#ef4444':slaPct<50?'#f59e0b':C.g600) : C.g600

  const tab = (id: 'draft'|'sections'|'info', label: string) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
      fontSize:13, fontFamily:C.sans, fontWeight:500,
      background: activeTab===id ? C.g900 : 'transparent',
      color: activeTab===id ? C.white : C.g600,
    }}>{label}</button>
  )

  return (
    <div style={{fontFamily:C.sans,minHeight:'100vh',background:C.g50}}>
      <header style={{background:C.g900,padding:'0 28px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="7" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontFamily:C.serif,fontWeight:600,color:C.white,fontSize:17}}>ProtekFlow</span>
          <span style={{color:C.g400,fontSize:13,marginLeft:8}}>/ Review &amp; Sign</span>
        </div>
        <Link href="/consultant" style={{color:C.g400,fontSize:13,textDecoration:'none'}}>← Dashboard</Link>
      </header>

      <div style={{maxWidth:860,margin:'0 auto',padding:'24px 20px'}}>

        {/* File header */}
        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 22px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:10}}>
            <div>
              <div style={{fontFamily:'monospace',fontSize:12,color:C.g500,marginBottom:3}}>{file.file_number}</div>
              <h1 style={{fontFamily:C.serif,fontSize:20,fontWeight:700,color:C.g900,margin:'0 0 3px'}}>{file.project_name}</h1>
              <div style={{fontSize:13,color:C.g600}}>{file.project_address}</div>
            </div>
            {slaHrs !== null && (
              <div style={{textAlign:'right',minWidth:140}}>
                <div style={{fontSize:12,color:C.g500,marginBottom:3}}>SLA deadline</div>
                <div style={{fontSize:16,fontWeight:700,color:slaColor,marginBottom:4}}>{slaHrs}h remaining</div>
                <div style={{height:5,borderRadius:3,background:C.g100,overflow:'hidden'}}>
                  <div style={{width:`${slaPct}%`,height:'100%',background:slaColor}}/>
                </div>
              </div>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
            {[
              ['Contractor', (file.contractor as any)?.company_name ?? (file.contractor as any)?.full_name ?? '—'],
              ['Project value', file.project_value ? `R${Number(file.project_value).toLocaleString('en-ZA')}` : '—'],
              ['Workers', file.wizard_data?.workerCount ?? '—'],
              ['Your earn', file.is_complex ? 'R8,100' : 'R3,825'],
            ].map(([k,v]) => (
              <div key={String(k)} style={{background:C.g50,borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:11,color:C.g500,marginBottom:3}}>{k}</div>
                <div style={{fontSize:14,fontWeight:600,color:C.g900}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{display:'flex',gap:6,marginBottom:14,background:C.white,border:`1px solid ${C.g100}`,borderRadius:10,padding:6,width:'fit-content'}}>
          {tab('info','Project info')}
          {tab('sections','Section checklist')}
          {file.generated_draft && tab('draft','AI draft')}
        </div>

        {/* Tab: Project info */}
        {activeTab==='info' && (
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 22px',marginBottom:16}}>
            <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 14px'}}>Project information from contractor</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
              {[
                ['Project name',    file.project_name],
                ['Site address',    file.project_address],
                ['Client',          file.client_name ?? '—'],
                ['Site agent',      file.site_agent ?? '—'],
                ['Start date',      file.project_start_date ?? '—'],
                ['End date',        file.project_end_date ?? '—'],
                ['Project value',   file.project_value ? `R${Number(file.project_value).toLocaleString('en-ZA')}` : '—'],
                ['Workers on site', file.wizard_data?.workerCount ?? '—'],
                ['High-risk items', file.wizard_data?.highRiskActivities?.join(', ') || 'None declared'],
                ['Client type',     file.wizard_data?.clientType ?? '—'],
                ['CIDB number',     file.wizard_data?.cidbNumber || '—'],
                ['Complex project', file.is_complex ? 'Yes — CHSM required' : 'No'],
              ].map(([k,v]) => (
                <div key={String(k)} style={{display:'flex',justifyContent:'space-between',padding:'8px 4px',borderBottom:`1px solid ${C.g50}`,fontSize:13}}>
                  <span style={{color:C.g500,paddingRight:12}}>{k}</span>
                  <span style={{color:C.g900,fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Section checklist */}
        {activeTab==='sections' && (
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 22px',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div>
                <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 3px'}}>Section review checklist</h2>
                <p style={{fontSize:12,color:C.g500,margin:0}}>Check each section as you review it. All sections must be checked before signing.</p>
              </div>
              <span style={{fontSize:13,fontWeight:600,color:allChecked?C.g700:C.g400}}>{checkedSections.length}/{SECTIONS.length}</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {SECTIONS.map((s,i) => (
                <div key={i} onClick={() => toggleSection(i)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',border:`1px solid ${checkedSections.includes(i)?C.g500:C.g100}`,borderRadius:8,cursor:'pointer',background:checkedSections.includes(i)?C.g50:C.white,transition:'all 0.1s'}}>
                  <div style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${checkedSections.includes(i)?C.g500:C.g300}`,background:checkedSections.includes(i)?C.g500:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:C.white,fontSize:11,fontWeight:700}}>
                    {checkedSections.includes(i)?'✓':''}
                  </div>
                  <span style={{fontSize:13,color:checkedSections.includes(i)?C.g900:C.g700,fontWeight:checkedSections.includes(i)?500:400}}>{s}</span>
                </div>
              ))}
            </div>
            {!allChecked && (
              <div style={{marginTop:12,fontSize:12,color:C.g500,textAlign:'center'}}>
                Check all {SECTIONS.length} sections to enable signing
              </div>
            )}
          </div>
        )}

        {/* Tab: AI Draft */}
        {activeTab==='draft' && file.generated_draft && (
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 22px',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 3px'}}>AI-generated draft</h2>
                <p style={{fontSize:12,color:C.g500,margin:0}}>Contractor fields are pre-filled. Complete all <code style={{background:C.g50,padding:'1px 5px',borderRadius:4}}>[CONSULTANT TO COMPLETE]</code> sections before signing.</p>
              </div>
            </div>
            <div style={{background:C.g50,borderRadius:10,padding:'16px',maxHeight:400,overflow:'auto',fontFamily:'monospace',fontSize:11,lineHeight:1.9,color:C.g800,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
              {file.generated_draft}
            </div>
            <div style={{marginTop:10,fontSize:12,color:C.g500}}>
              This draft has been uploaded to DocuSeal. When you click &quot;Sign via DocuSeal&quot; below, you&apos;ll be taken to complete and sign the final document.
            </div>
          </div>
        )}

        {/* Attestation & sign */}
        <div style={{background:C.g900,borderRadius:14,padding:'20px 22px',marginBottom:16}}>
          <h3 style={{fontSize:14,fontWeight:600,color:C.g200,margin:'0 0 10px'}}>Professional attestation</h3>
          <p style={{fontSize:13,color:C.g300,lineHeight:1.6,marginBottom:16}}>
            By signing this SHE file, I confirm that I am a SACPCMP-registered Health and Safety professional, that I have reviewed the contents of this file, that it complies with the OHS Act 85/1993 and Construction Regulations 2014, and that I accept professional responsibility for the signed document.
          </p>
          <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
            <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)}
              style={{marginTop:2,accentColor:C.g500,width:16,height:16,flexShrink:0}}/>
            <span style={{fontSize:13,color:C.g200,lineHeight:1.5}}>
              I confirm the above attestation and accept professional responsibility for this SHE file.
            </span>
          </label>
        </div>

        {error && (
          <div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px',marginBottom:12}}>
            {error}
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <Link href="/consultant" style={{background:'transparent',border:`1px solid ${C.g200}`,color:C.g700,fontWeight:500,padding:'10px 20px',borderRadius:9,fontSize:13,textDecoration:'none'}}>
            ← Back to dashboard
          </Link>
          <button onClick={handleSign} disabled={signing || !attested}
            style={{background:signing||!attested?C.g200:C.g600,color:signing||!attested?C.g500:C.white,fontWeight:700,padding:'11px 28px',borderRadius:10,border:'none',cursor:signing||!attested?'not-allowed':'pointer',fontSize:14,fontFamily:C.sans,opacity:signing?0.7:1}}>
            {signing ? 'Opening DocuSeal…' : 'Sign via DocuSeal →'}
          </button>
        </div>

        {!attested && (
          <p style={{textAlign:'center',fontSize:12,color:C.g400,marginTop:10}}>
            Confirm the professional attestation above to enable signing
          </p>
        )}
      </div>
    </div>
  )
}
