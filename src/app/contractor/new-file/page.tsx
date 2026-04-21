'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatZAR, PRICING } from '@/lib/pricing'
import { PROJECT_TYPE_OPTIONS, HIGH_RISK_OPTIONS } from '@/lib/templates'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',
  white:'#ffffff',amber:'#fef3c7',amberText:'#92400e',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

const TYPE_ICONS: Record<string,string> = {
  residential:'🏠', light_commercial:'🏢', civil_earthworks:'🚧',
  electrical:'⚡', plumbing_mechanical:'🔧', roofing:'🏗️',
  demolition:'⚠️', painting_cladding:'🎨', interior_fitout:'🪟',
  general_maintenance:'🔨',
}

const STEPS = ['Project type','Project details','Site & contacts','Review & pay']
const PRICE_MAP: Record<string,number> = {
  standard:PRICING.FILE_STANDARD, volume_a:PRICING.FILE_VOLUME_A,
  volume_b:PRICING.FILE_VOLUME_B, volume_c:PRICING.FILE_VOLUME_C,
}
const VOLUME_TIERS = [
  {v:'standard', n:'1–2 files',  desc:'Standard rate',              price:PRICING.FILE_STANDARD},
  {v:'volume_a', n:'3–5 files',  desc:'Volume A — save R375/file',  price:PRICING.FILE_VOLUME_A},
  {v:'volume_b', n:'6–11 files', desc:'Volume B — save R875/file',  price:PRICING.FILE_VOLUME_B},
  {v:'volume_c', n:'12+ files',  desc:'Volume C — save R1,375/file',price:PRICING.FILE_VOLUME_C},
]

const inp = (extra={}) => ({
  width:'100%', padding:'9px 12px', border:`1px solid ${C.g100}`,
  borderRadius:8, fontSize:13, color:C.g900, fontFamily:C.sans,
  outline:'none', background:C.white, boxSizing:'border-box' as const, ...extra
})
const lbl = {display:'block' as const, fontSize:12, fontWeight:500, color:C.g700, marginBottom:5}
const btn = (bg:string, color:string, extra={}) => ({
  background:bg, color, padding:'10px 22px', borderRadius:9, border:'none',
  cursor:'pointer', fontSize:13, fontFamily:C.sans, fontWeight:700, ...extra
})

export default function NewFilePage() {
  const [step, setStep]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm] = useState({
    project_type:'', project_name:'', project_address:'',
    project_value:'', start:'', end:'',
    workers:'5', cidb:'', client_type:'private',
    client_name:'', site_agent:'',
    risks:[] as string[], volume:'standard',
  })

  const set = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({...f,[k]:e.target.value}))

  const toggleRisk = (v:string) =>
    setForm(f => ({...f, risks: f.risks.includes(v)
      ? f.risks.filter(r=>r!==v) : [...f.risks,v]}))

  const isComplex = parseFloat(form.project_value||'0') > 5_000_000 || form.risks.length >= 3
  const price     = isComplex ? 900000 : PRICE_MAP[form.volume]

  // Auto-calc duration when dates change
  const durationDays = form.start && form.end
    ? Math.max(1, Math.round((new Date(form.end).getTime()-new Date(form.start).getTime())/(1000*60*60*24)))
    : 30

  const handlePay = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/files/create', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          project_type: form.project_type, project_name: form.project_name,
          project_address: form.project_address, project_value: parseFloat(form.project_value||'0'),
          project_start_date: form.start, project_end_date: form.end,
          duration_days: durationDays, worker_count: parseInt(form.workers||'1'),
          high_risk_activities: form.risks, client_type: form.client_type,
          client_name: form.client_name, site_agent: form.site_agent,
          cidb_number: form.cidb, volume_tier: form.volume,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); setLoading(false); return }
      const pf = document.createElement('form')
      pf.method='POST'; pf.action=data.payment.payfast_url
      Object.entries(data.payment).forEach(([k,v]) => {
        if (k==='payfast_url') return
        const i=document.createElement('input'); i.type='hidden'; i.name=k; i.value=String(v); pf.appendChild(i)
      })
      document.body.appendChild(pf); pf.submit()
    } catch { setError('Network error — please try again.'); setLoading(false) }
  }

  // ── Shared layout ──────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:C.sans, minHeight:'100vh', background:C.g50}}>
      {/* Nav */}
      <header style={{background:C.g900,padding:'0 28px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="7" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontFamily:C.serif,fontWeight:600,color:C.white,fontSize:17}}>ProtekFlow</span>
        </div>
        <Link href="/contractor" style={{color:C.g400,fontSize:13,textDecoration:'none'}}>← Dashboard</Link>
      </header>

      <div style={{maxWidth:620,margin:'0 auto',padding:'28px 20px'}}>
        {/* Header */}
        <div style={{marginBottom:20}}>
          <h1 style={{fontFamily:C.serif,fontSize:22,fontWeight:700,color:C.g900,margin:'0 0 3px'}}>New SHE file</h1>
          <p style={{fontSize:13,color:C.g600,margin:0}}>AI-drafted · SACPCMP-signed · 48-hour delivery</p>
        </div>

        {/* Progress */}
        <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
          {STEPS.map((s,i) => (
            <div key={s} style={{display:'flex',alignItems:'center',flex:1}}>
              <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0,
                background:step>i?C.g500:step===i?C.g900:'transparent',
                color:step>i?C.g900:C.white,
                border:step>i?'none':step===i?'none':`1px solid ${C.g200}`}}>
                {step>i?'✓':i+1}
              </div>
              <span style={{fontSize:11,color:step===i?C.g900:C.g400,marginLeft:5,whiteSpace:'nowrap'}}>{s}</span>
              {i<STEPS.length-1 && <div style={{flex:1,height:1,background:step>i?C.g400:C.g100,margin:'0 6px'}}/>}
            </div>
          ))}
        </div>

        {/* Live price chip */}
        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:10,padding:'11px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <span style={{fontSize:12,color:C.g600}}>
            {isComplex ? '⚠ Complex project — CHSM required' : 'Estimated price'}
          </span>
          <span style={{fontFamily:C.serif,fontSize:20,fontWeight:700,color:isComplex?'#92400e':C.g900}}>
            {formatZAR(price)}
          </span>
        </div>

        {/* Card */}
        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:24}}>

          {/* ── STEP 0: Project type ─────────────────────────────────────── */}
          {step===0 && (<>
            <p style={{fontSize:12,fontWeight:600,color:C.g500,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:12}}>What type of project?</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:18}}>
              {PROJECT_TYPE_OPTIONS.map(t => (
                <div key={t.value} onClick={() => setForm(f=>({...f,project_type:t.value}))}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',border:`${form.project_type===t.value?'2px':'1px'} solid ${form.project_type===t.value?C.g500:C.g100}`,borderRadius:10,cursor:'pointer',background:form.project_type===t.value?C.g50:C.white,transition:'all 0.1s'}}>
                  <div style={{width:30,height:30,borderRadius:8,background:form.project_type===t.value?C.g200:C.g50,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                    {TYPE_ICONS[t.value]||'🔨'}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.g900,lineHeight:1.2}}>{t.label.replace(' construction','').replace(' (industrial/commercial','')}</div>
                  </div>
                </div>
              ))}
            </div>

            <p style={{fontSize:12,fontWeight:600,color:C.g500,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>High-risk activities</p>
            <p style={{fontSize:12,color:C.g500,marginBottom:10}}>Select all that apply. 3+ triggers complex pricing (R9,000).</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:14}}>
              {HIGH_RISK_OPTIONS.map(r => (
                <div key={r.value} onClick={() => toggleRisk(r.value)}
                  style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:`1px solid ${form.risks.includes(r.value)?C.g500:C.g100}`,borderRadius:8,cursor:'pointer',background:form.risks.includes(r.value)?C.g50:C.white,fontSize:12,color:C.g800,transition:'all 0.1s'}}>
                  <div style={{width:14,height:14,borderRadius:4,border:`1.5px solid ${form.risks.includes(r.value)?C.g500:C.g300}`,background:form.risks.includes(r.value)?C.g500:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:C.white,fontSize:10,fontWeight:700}}>
                    {form.risks.includes(r.value)?'✓':''}
                  </div>
                  {r.label}
                </div>
              ))}
            </div>

            {isComplex && (
              <div style={{background:C.amber,border:'1px solid #fde68a',borderRadius:8,padding:'10px 12px',fontSize:12,color:C.amberText,marginBottom:14,display:'flex',gap:8}}>
                <span>⚠</span>
                <span>Complex project — requires a CHSM-registered consultant. Price: <strong>R9,000</strong>.</span>
              </div>
            )}

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:8}}>
              <span style={{fontSize:12,color:C.g500}}>{form.risks.length} risk{form.risks.length!==1?'s':''} selected</span>
              <button onClick={() => setStep(1)} disabled={!form.project_type}
                style={btn(form.project_type?C.g900:'#d1d5db', form.project_type?C.white:C.g500)}>
                Continue →
              </button>
            </div>
          </>)}

          {/* ── STEP 1: Project details ──────────────────────────────────── */}
          {step===1 && (<>
            <div style={{background:C.g50,borderRadius:8,padding:'10px 14px',marginBottom:18,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
              <span style={{fontSize:18}}>{TYPE_ICONS[form.project_type]||'🔨'}</span>
              <span style={{fontWeight:600,color:C.g900}}>{PROJECT_TYPE_OPTIONS.find(t=>t.value===form.project_type)?.label}</span>
              <span style={{color:C.g500,fontSize:12,marginLeft:'auto',cursor:'pointer'}} onClick={()=>setStep(0)}>Change</span>
            </div>

            <div style={{marginBottom:14}}>
              <label style={lbl}>Project name *</label>
              <input style={inp()} type="text" value={form.project_name} onChange={set('project_name')} placeholder="e.g. Sakhisizwe Clinic Extension Phase 2"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div>
                <label style={lbl}>Project value (R)</label>
                <input style={inp()} type="number" value={form.project_value} onChange={set('project_value')} placeholder="e.g. 1500000"/>
              </div>
              <div>
                <label style={lbl}>Client type</label>
                <select style={inp({cursor:'pointer'})} value={form.client_type} onChange={set('client_type')}>
                  <option value="private">Private</option>
                  <option value="public_sector">Public sector</option>
                  <option value="soe">SOE</option>
                  <option value="cidb_grade6plus">CIDB Grade 6+</option>
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div>
                <label style={lbl}>Start date</label>
                <input style={inp()} type="date" value={form.start} onChange={set('start')}/>
              </div>
              <div>
                <label style={lbl}>End date</label>
                <input style={inp()} type="date" value={form.end} onChange={set('end')}/>
              </div>
            </div>
            {form.start && form.end && (
              <div style={{fontSize:12,color:C.g600,marginBottom:14,marginTop:-8}}>
                Duration: <strong>{durationDays} days</strong>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div>
                <label style={lbl}>Workers on site</label>
                <input style={inp()} type="number" value={form.workers} onChange={set('workers')} placeholder="e.g. 12"/>
              </div>
              <div>
                <label style={lbl}>CIDB number (optional)</label>
                <input style={inp()} type="text" value={form.cidb} onChange={set('cidb')} placeholder="Your CIDB reg number"/>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:8}}>
              <button onClick={()=>setStep(0)} style={btn('transparent',C.g700,{border:`1px solid ${C.g200}`})}>← Back</button>
              <button onClick={()=>setStep(2)} disabled={!form.project_name}
                style={btn(form.project_name?C.g900:'#d1d5db', form.project_name?C.white:C.g500)}>Continue →</button>
            </div>
          </>)}

          {/* ── STEP 2: Site & contacts ──────────────────────────────────── */}
          {step===2 && (<>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Site address *</label>
              <input style={inp()} type="text" value={form.project_address} onChange={set('project_address')} placeholder="e.g. Erf 123, Hospital Street, Cala, Eastern Cape"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
              <div>
                <label style={lbl}>Client / employer name</label>
                <input style={inp()} type="text" value={form.client_name} onChange={set('client_name')} placeholder="e.g. Sakhisizwe Municipality"/>
              </div>
              <div>
                <label style={lbl}>Site agent / construction manager</label>
                <input style={inp()} type="text" value={form.site_agent} onChange={set('site_agent')} placeholder="Full name"/>
              </div>
            </div>

            <p style={{fontSize:12,fontWeight:600,color:C.g500,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Volume pricing</p>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
              {VOLUME_TIERS.map(vt => (
                <div key={vt.v} onClick={() => setForm(f=>({...f,volume:vt.v}))}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',border:`${form.volume===vt.v?'2px':'1px'} solid ${form.volume===vt.v?C.g500:C.g100}`,borderRadius:10,cursor:'pointer',background:form.volume===vt.v?C.g50:C.white,transition:'all 0.1s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${form.volume===vt.v?C.g600:C.g300}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {form.volume===vt.v && <div style={{width:8,height:8,borderRadius:'50%',background:C.g600}}/>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:C.g900}}>{vt.n}</div>
                      <div style={{fontSize:11,color:C.g500}}>{vt.desc}</div>
                    </div>
                  </div>
                  <span style={{fontFamily:C.serif,fontWeight:700,color:C.g900,fontSize:16}}>{formatZAR(vt.price)}</span>
                </div>
              ))}
            </div>

            <div style={{display:'flex',justifyContent:'space-between',paddingTop:8}}>
              <button onClick={()=>setStep(1)} style={btn('transparent',C.g700,{border:`1px solid ${C.g200}`})}>← Back</button>
              <button onClick={()=>setStep(3)} disabled={!form.project_address}
                style={btn(form.project_address?C.g900:'#d1d5db', form.project_address?C.white:C.g500)}>Review →</button>
            </div>
          </>)}

          {/* ── STEP 3: Review & pay ─────────────────────────────────────── */}
          {step===3 && (<>
            <div style={{background:C.g50,borderRadius:10,padding:'14px 16px',marginBottom:14}}>
              {[
                ['Project type', PROJECT_TYPE_OPTIONS.find(t=>t.value===form.project_type)?.label||'—'],
                ['Project',      form.project_name||'—'],
                ['Site',         form.project_address||'—'],
                ['Client',       form.client_name||'—'],
                ['Period',       form.start&&form.end?`${form.start} → ${form.end} (${durationDays}d)`:'—'],
                ['Workers',      form.workers],
                ['High-risk',    form.risks.length>0?`${form.risks.length} activit${form.risks.length===1?'y':'ies'} declared`:'None'],
                ['Volume',       VOLUME_TIERS.find(v=>v.v===form.volume)?.n||'Standard'],
              ].map(([k,v]) => (
                <div key={String(k)} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${C.g100}`,fontSize:13}}>
                  <span style={{color:C.g500}}>{k}</span>
                  <span style={{color:C.g900,fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',paddingTop:12,marginTop:4,borderTop:`1px solid ${C.g200}`}}>
                <span style={{fontSize:14,fontWeight:600,color:C.g700}}>Total due</span>
                <span style={{fontFamily:C.serif,fontSize:26,fontWeight:700,color:isComplex?'#92400e':C.g900}}>{formatZAR(price)}</span>
              </div>
            </div>

            {isComplex && (
              <div style={{background:C.amber,border:'1px solid #fde68a',borderRadius:8,padding:'10px 12px',fontSize:12,color:C.amberText,marginBottom:14,display:'flex',gap:8}}>
                <span>⚠</span><span>Complex project — priced at R9,000. CHSM-registered consultant required.</span>
              </div>
            )}

            <div style={{background:C.g900,borderRadius:10,padding:16,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:600,color:C.g400,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>What happens after payment</div>
              {['Claude AI generates your SHE file draft from your project details',
                'A verified SACPCMP consultant reviews and e-signs via DocuSeal',
                'Completed signed file delivered to you within 48 hours'].map(s => (
                <div key={s} style={{display:'flex',gap:8,color:C.g200,fontSize:13,marginBottom:6,lineHeight:1.4}}>
                  <span style={{color:C.g500,fontWeight:700,flexShrink:0}}>✓</span>{s}
                </div>
              ))}
            </div>

            {error && <div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px',marginBottom:12}}>{error}</div>}
            <p style={{fontSize:12,color:C.g400,textAlign:'center',marginBottom:12}}>You will be redirected to PayFast to complete payment securely.</p>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button onClick={()=>setStep(2)} style={btn('transparent',C.g700,{border:`1px solid ${C.g200}`})}>← Back</button>
              <button onClick={handlePay} disabled={loading}
                style={btn(loading?C.g700:C.g500, C.g950, {opacity:loading?0.7:1,fontSize:14,padding:'12px 28px',borderRadius:10})}>
                {loading?'Generating draft…':`Pay ${formatZAR(price)} via PayFast →`}
              </button>
            </div>
          </>)}

        </div>
      </div>
    </div>
  )
}
