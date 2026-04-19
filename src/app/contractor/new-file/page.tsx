'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatZAR, PRICING } from '@/lib/pricing'
import { PROJECT_TYPE_OPTIONS, HIGH_RISK_OPTIONS } from '@/lib/templates'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',
  white:'#ffffff', serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}
const inp = {width:'100%',padding:'10px 14px',border:`1px solid ${C.g100}`,borderRadius:8,fontSize:14,color:C.g900,fontFamily:C.sans,outline:'none',boxSizing:'border-box' as const,background:C.white}
const lbl = {display:'block' as const,fontSize:13,fontWeight:500,color:C.g700,marginBottom:5}

const STEPS = ['Project type','Project details','Site & contacts','Review & pay']
const PRICE_MAP = { standard:PRICING.FILE_STANDARD, volume_a:PRICING.FILE_VOLUME_A, volume_b:PRICING.FILE_VOLUME_B, volume_c:PRICING.FILE_VOLUME_C }

type VolumeTier = 'standard'|'volume_a'|'volume_b'|'volume_c'

export default function NewFilePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    project_type: '', project_name: '', project_address: '',
    project_value: '', project_start_date: '', project_end_date: '',
    duration_days: '30', worker_count: '5',
    high_risk_activities: [] as string[],
    client_type: 'private' as string,
    principal_contractor: '', client_name: '', site_agent: '', cidb_number: '',
    volume_tier: 'standard' as VolumeTier,
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const toggleRisk = (v: string) =>
    setForm(f => ({
      ...f,
      high_risk_activities: f.high_risk_activities.includes(v)
        ? f.high_risk_activities.filter(x => x !== v)
        : [...f.high_risk_activities, v]
    }))

  const price = PRICE_MAP[form.volume_tier]
  const isComplex = parseFloat(form.project_value||'0') > 5000000 || form.high_risk_activities.length >= 3

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/files/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          project_value: parseFloat(form.project_value||'0'),
          duration_days: parseInt(form.duration_days||'30'),
          worker_count:  parseInt(form.worker_count||'1'),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); setLoading(false); return }

      // Redirect to PayFast
      const pf = document.createElement('form')
      pf.method = 'POST'; pf.action = data.payment.payfast_url
      Object.entries(data.payment).forEach(([k,v]) => {
        if (k === 'payfast_url') return
        const i = document.createElement('input'); i.type='hidden'; i.name=k; i.value=String(v)
        pf.appendChild(i)
      })
      document.body.appendChild(pf); pf.submit()
    } catch { setError('Network error — please try again.'); setLoading(false) }
  }

  const stepProgress = (
    <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:32}}>
      {STEPS.map((s,i) => (
        <div key={s} style={{display:'flex',alignItems:'center',gap:4,flex:1}}>
          <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0,
            background:step>i?C.g500:step===i?C.g900:'transparent',
            color:step>i?C.g900:C.white,
            border:step>i?'none':step===i?'none':`1px solid ${C.g200}`}}>
            {step>i?'✓':i+1}
          </div>
          <span style={{fontSize:12,color:step===i?C.g900:C.g400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s}</span>
          {i<STEPS.length-1 && <div style={{flex:1,height:1,background:step>i?C.g400:C.g100,minWidth:8}}/>}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.g50,fontFamily:C.sans}}>
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

      <div style={{maxWidth:640,margin:'0 auto',padding:'36px 20px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:600,color:C.g900,margin:'0 0 4px'}}>New SHE file</h1>
          <p style={{fontSize:13,color:C.g600,margin:0}}>AI-drafted · SACPCMP-signed · 48-hour delivery</p>
        </div>

        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:16,padding:32}}>
          {stepProgress}

          {/* STEP 0 — Project type */}
          {step===0 && (
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              <h2 style={{fontFamily:C.serif,fontSize:20,fontWeight:600,color:C.g900,margin:0}}>What type of project is this?</h2>
              <div>
                <label style={lbl}>Project type <span style={{color:'#ef4444'}}>*</span></label>
                <select value={form.project_type} onChange={set('project_type')}
                  style={{...inp,cursor:'pointer'}}>
                  <option value="">Select a project type…</option>
                  {PROJECT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>High-risk activities on this site</label>
                <p style={{fontSize:12,color:C.g500,margin:'0 0 10px'}}>Select all that apply. 3+ triggers complex pricing (R9,000).</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {HIGH_RISK_OPTIONS.map(o => (
                    <label key={o.value} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',border:`1px solid ${form.high_risk_activities.includes(o.value)?C.g500:C.g100}`,borderRadius:8,cursor:'pointer',background:form.high_risk_activities.includes(o.value)?C.g50:C.white}}>
                      <input type="checkbox" checked={form.high_risk_activities.includes(o.value)} onChange={() => toggleRisk(o.value)} style={{accentColor:C.g600}} />
                      <span style={{fontSize:13,color:C.g800}}>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {isComplex && (
                <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#92400e'}}>
                  ⚠️ This project qualifies as <strong>complex</strong> — it requires a CHSM-registered consultant and is priced at R9,000.
                </div>
              )}
              <div style={{display:'flex',justifyContent:'flex-end',paddingTop:8}}>
                <button onClick={() => setStep(1)} disabled={!form.project_type}
                  style={{background:form.project_type?C.g900:'#d1d5db',color:C.white,fontWeight:700,padding:'11px 24px',borderRadius:10,border:'none',cursor:form.project_type?'pointer':'not-allowed',fontSize:14,fontFamily:C.sans}}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 1 — Project details */}
          {step===1 && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <h2 style={{fontFamily:C.serif,fontSize:20,fontWeight:600,color:C.g900,margin:0}}>Project details</h2>
              <div>
                <label style={lbl}>Project name <span style={{color:'#ef4444'}}>*</span></label>
                <input style={inp} type="text" placeholder="e.g. Sakhisizwe Clinic Extension Phase 2" value={form.project_name} onChange={set('project_name')} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={lbl}>Project value (R)</label>
                  <input style={inp} type="number" placeholder="e.g. 1500000" value={form.project_value} onChange={set('project_value')} />
                </div>
                <div>
                  <label style={lbl}>Client type</label>
                  <select value={form.client_type} onChange={set('client_type')} style={{...inp,cursor:'pointer'}}>
                    <option value="private">Private</option>
                    <option value="public_sector">Public sector</option>
                    <option value="soe">State-owned entity (SOE)</option>
                    <option value="cidb_grade6plus">CIDB Grade 6+</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={lbl}>Start date</label>
                  <input style={inp} type="date" value={form.project_start_date} onChange={set('project_start_date')} />
                </div>
                <div>
                  <label style={lbl}>End date</label>
                  <input style={inp} type="date" value={form.project_end_date} onChange={set('project_end_date')} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={lbl}>Workers on site</label>
                  <input style={inp} type="number" placeholder="e.g. 12" value={form.worker_count} onChange={set('worker_count')} />
                </div>
                <div>
                  <label style={lbl}>CIDB number</label>
                  <input style={inp} type="text" placeholder="Your CIDB reg number" value={form.cidb_number} onChange={set('cidb_number')} />
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',paddingTop:8}}>
                <button onClick={() => setStep(0)} style={{background:'none',border:`1px solid ${C.g200}`,color:C.g700,fontWeight:500,padding:'10px 20px',borderRadius:10,cursor:'pointer',fontSize:14,fontFamily:C.sans}}>← Back</button>
                <button onClick={() => setStep(2)} disabled={!form.project_name}
                  style={{background:form.project_name?C.g900:'#d1d5db',color:C.white,fontWeight:700,padding:'11px 24px',borderRadius:10,border:'none',cursor:form.project_name?'pointer':'not-allowed',fontSize:14,fontFamily:C.sans}}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — Site & contacts */}
          {step===2 && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <h2 style={{fontFamily:C.serif,fontSize:20,fontWeight:600,color:C.g900,margin:0}}>Site &amp; contacts</h2>
              <div>
                <label style={lbl}>Site address <span style={{color:'#ef4444'}}>*</span></label>
                <input style={inp} type="text" placeholder="e.g. Erf 123, Hospital Street, Cala, Eastern Cape" value={form.project_address} onChange={set('project_address')} />
              </div>
              <div>
                <label style={lbl}>Client / employer name</label>
                <input style={inp} type="text" placeholder="e.g. Sakhisizwe Local Municipality" value={form.client_name} onChange={set('client_name')} />
              </div>
              <div>
                <label style={lbl}>Site agent / construction manager</label>
                <input style={inp} type="text" placeholder="Full name" value={form.site_agent} onChange={set('site_agent')} />
              </div>

              {/* Volume tier */}
              <div>
                <label style={lbl}>How many SHE files do you expect this year?</label>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {([['standard','1–2 files','Standard rate',formatZAR(PRICING.FILE_STANDARD)],
                     ['volume_a','3–5 files','Volume A',formatZAR(PRICING.FILE_VOLUME_A)],
                     ['volume_b','6–11 files','Volume B',formatZAR(PRICING.FILE_VOLUME_B)],
                     ['volume_c','12+ files','Volume C',formatZAR(PRICING.FILE_VOLUME_C)]] as const
                  ).map(([tier,files,label,p]) => (
                    <label key={tier} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',border:`2px solid ${form.volume_tier===tier?C.g500:C.g100}`,borderRadius:10,cursor:'pointer',background:form.volume_tier===tier?C.g50:C.white}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <input type="radio" name="volume_tier" value={tier} checked={form.volume_tier===tier} onChange={() => setForm(f => ({...f,volume_tier:tier}))} style={{accentColor:C.g600}} />
                        <div>
                          <div style={{fontSize:14,fontWeight:500,color:C.g900}}>{files}</div>
                          <div style={{fontSize:12,color:C.g500}}>{label}</div>
                        </div>
                      </div>
                      <div style={{fontFamily:C.serif,fontWeight:700,color:C.g900,fontSize:17}}>{p}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',paddingTop:8}}>
                <button onClick={() => setStep(1)} style={{background:'none',border:`1px solid ${C.g200}`,color:C.g700,fontWeight:500,padding:'10px 20px',borderRadius:10,cursor:'pointer',fontSize:14,fontFamily:C.sans}}>← Back</button>
                <button onClick={() => setStep(3)} disabled={!form.project_address}
                  style={{background:form.project_address?C.g900:'#d1d5db',color:C.white,fontWeight:700,padding:'11px 24px',borderRadius:10,border:'none',cursor:form.project_address?'pointer':'not-allowed',fontSize:14,fontFamily:C.sans}}>
                  Review →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Review & pay */}
          {step===3 && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <h2 style={{fontFamily:C.serif,fontSize:20,fontWeight:600,color:C.g900,margin:0}}>Review &amp; pay</h2>

              <div style={{background:C.g50,borderRadius:12,padding:20,display:'flex',flexDirection:'column',gap:10,fontSize:14}}>
                {[
                  ['Project type',    PROJECT_TYPE_OPTIONS.find(o=>o.value===form.project_type)?.label??form.project_type],
                  ['Project name',    form.project_name],
                  ['Site address',    form.project_address],
                  ['Client',         form.client_name||'—'],
                  ['High-risk items', form.high_risk_activities.length > 0 ? form.high_risk_activities.join(', ') : 'None'],
                  ['Volume tier',     form.volume_tier.replace('_',' ')],
                ].map(([k,v]) => (
                  <div key={k} style={{display:'flex',justifyContent:'space-between',gap:16}}>
                    <span style={{color:C.g500,flexShrink:0}}>{k}</span>
                    <span style={{color:C.g900,fontWeight:500,textAlign:'right'}}>{v}</span>
                  </div>
                ))}
                <div style={{borderTop:`1px solid ${C.g200}`,paddingTop:12,marginTop:4,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <span style={{fontWeight:600,color:C.g700}}>Total due</span>
                  <span style={{fontFamily:C.serif,fontSize:26,fontWeight:700,color:C.g900}}>{formatZAR(price)}</span>
                </div>
              </div>

              {isComplex && (
                <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#92400e'}}>
                  Complex project — priced at R9,000. Requires CHSM-registered consultant.
                </div>
              )}

              <div style={{background:C.g900,borderRadius:12,padding:20,fontSize:13}}>
                <div style={{color:C.g400,fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:12}}>What happens next</div>
                {['AI generates your SHE file draft from your project details','A verified SACPCMP consultant reviews and e-signs via DocuSeal','Completed file delivered within 48 hours of payment'].map(s => (
                  <div key={s} style={{display:'flex',gap:8,marginBottom:6,color:C.g200}}>
                    <span style={{color:C.g500,fontWeight:700,flexShrink:0}}>✓</span>{s}
                  </div>
                ))}
              </div>

              {error && <div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px'}}>{error}</div>}

              <p style={{fontSize:12,color:C.g400,textAlign:'center',margin:0}}>You will be redirected to PayFast to complete payment securely.</p>

              <div style={{display:'flex',justifyContent:'space-between',paddingTop:4}}>
                <button onClick={() => setStep(2)} style={{background:'none',border:`1px solid ${C.g200}`,color:C.g700,fontWeight:500,padding:'10px 20px',borderRadius:10,cursor:'pointer',fontSize:14,fontFamily:C.sans}}>← Back</button>
                <button onClick={handleSubmit} disabled={loading}
                  style={{background:loading?C.g700:C.g900,color:C.white,fontWeight:700,padding:'12px 28px',borderRadius:10,border:'none',cursor:loading?'not-allowed':'pointer',fontSize:14,fontFamily:C.sans,opacity:loading?0.7:1}}>
                  {loading ? 'Generating & redirecting…' : `Pay ${formatZAR(price)} →`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
