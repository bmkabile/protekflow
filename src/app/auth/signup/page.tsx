'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g500:'#22c55e',g600:'#16a34a',g700:'#15803d',
  g800:'#166534',g900:'#14532d',g950:'#052e16',white:'#ffffff',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

const inp = {width:'100%',padding:'10px 14px',border:`1px solid #dcfce7`,borderRadius:8,fontSize:14,color:'#14532d',fontFamily:C.sans,outline:'none',boxSizing:'border-box' as const,background:'white'}
const lbl = {display:'block' as const,fontSize:13,fontWeight:500,color:C.g700,marginBottom:5}

export default function SignupPage() {
  const router = useRouter()
  const params = useSearchParams()
  const defaultRole = (params.get('role') as 'contractor'|'consultant') ?? 'contractor'
  const [role, setRole] = useState<'contractor'|'consultant'>(defaultRole)
  const [form, setForm] = useState({ full_name:'', email:'', password:'', company_name:'', phone:'', sacpcmp_number:'', cidb_number:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k:string) => (e:React.ChangeEvent<HTMLInputElement>) => setForm(f => ({...f,[k]:e.target.value}))

  const handleSignup = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const supabase = createClient()
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name, role } }
    })
    if (authErr) { setError(authErr.message); setLoading(false); return }
    if (!authData.user) { setError('Signup failed — please try again.'); setLoading(false); return }
    const uid = authData.user.id
    await supabase.from('profiles').insert({ id:uid, role, full_name:form.full_name, company_name:form.company_name||null, phone:form.phone||null })
    if (role==='contractor') { await supabase.from('contractors').insert({ id:uid, cidb_number:form.cidb_number||null }) }
    else { await supabase.from('consultants').insert({ id:uid, sacpcmp_number:form.sacpcmp_number, verification_status:'pending' }) }
    router.push(`/${role}`); router.refresh()
  }

  return (
    <div style={{minHeight:'100vh',background:C.g950,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:C.sans}}>
      <div style={{background:C.white,borderRadius:20,padding:'40px 36px',width:'100%',maxWidth:440}}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none',marginBottom:28}}>
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="8" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontFamily:C.serif,fontWeight:600,color:C.g900,fontSize:17}}>ProtekFlow</span>
        </Link>

        <div style={{display:'flex',gap:6,marginBottom:24,background:C.g50,borderRadius:10,padding:4}}>
          {(['contractor','consultant'] as const).map(r => (
            <button key={r} onClick={() => setRole(r)} style={{flex:1,padding:'8px 4px',borderRadius:8,border:'none',fontSize:13,fontWeight:500,cursor:'pointer',background:role===r?C.g900:C.g50,color:role===r?C.white:C.g700,fontFamily:C.sans,textTransform:'capitalize'}}>
              {r}
            </button>
          ))}
        </div>

        <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:700,color:C.g900,margin:'0 0 4px'}}>Create account</h1>
        <p style={{fontSize:13,color:C.g600,margin:'0 0 24px'}}>
          {role==='contractor' ? 'Get your SHE file in 48 hours — R4,500 fixed fee' : 'Start earning R3,375–R3,825 per signed SHE file'}
        </p>

        <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div><label style={lbl}>Full name</label><input style={inp} type="text" placeholder="Your full name" value={form.full_name} onChange={set('full_name')} required /></div>
          <div><label style={lbl}>Company / trading name</label><input style={inp} type="text" placeholder="Mkabile Construction CC" value={form.company_name} onChange={set('company_name')} /></div>
          <div><label style={lbl}>Email address</label><input style={inp} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required /></div>

          {role==='consultant' && (
            <div>
              <label style={lbl}>SACPCMP registration number *</label>
              <input style={inp} type="text" placeholder="e.g. CHSO-12345" value={form.sacpcmp_number} onChange={set('sacpcmp_number')} required />
              <p style={{fontSize:11,color:C.g500,margin:'4px 0 0'}}>Verified against the SACPCMP public register before first assignment.</p>
            </div>
          )}
          {role==='contractor' && (
            <div><label style={lbl}>CIDB number (optional)</label><input style={inp} type="text" placeholder="Your CIDB registration number" value={form.cidb_number} onChange={set('cidb_number')} /></div>
          )}
          <div><label style={lbl}>Password</label><input style={inp} type="password" placeholder="At least 8 characters" value={form.password} onChange={set('password')} required minLength={8} /></div>

          {error && <div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px'}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{background:C.g900,color:C.white,fontWeight:700,padding:'12px',borderRadius:10,border:'none',cursor:'pointer',fontSize:15,fontFamily:C.sans,opacity:loading?0.6:1,marginTop:4}}>
            {loading?'Creating account…':'Create account →'}
          </button>
        </form>

        <p style={{textAlign:'center',fontSize:13,color:C.g600,marginTop:20}}>
          Already registered? <Link href="/auth/login" style={{color:C.g900,fontWeight:600,textDecoration:'none'}}>Log in</Link>
        </p>
        <p style={{textAlign:'center',fontSize:12,color:'#9ca3af',marginTop:6}}>
          <Link href="/" style={{color:'#9ca3af',textDecoration:'none'}}>← Back to home</Link>
        </p>
      </div>
    </div>
  )
}
