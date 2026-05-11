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
export const dynamic = 'force-dynamic'
export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [role, setRole] = useState<'contractor'|'consultant'>('contractor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    router.push(params.get('redirect') ?? `/${profile?.role ?? 'contractor'}`)
    router.refresh()
  }

  return (
    <div style={{minHeight:'100vh',background:C.g950,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:C.sans}}>
      <div style={{background:C.white,borderRadius:20,padding:'40px 36px',width:'100%',maxWidth:420}}>
        {/* Logo */}
        <Link href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none',marginBottom:28}}>
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="8" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontFamily:C.serif,fontWeight:600,color:C.g900,fontSize:17}}>ProtekFlow</span>
        </Link>

        {/* Role tabs */}
        <div style={{display:'flex',gap:6,marginBottom:24,background:C.g50,borderRadius:10,padding:4}}>
          {(['contractor','consultant'] as const).map(r => (
            <button key={r} onClick={() => setRole(r)} style={{flex:1,padding:'8px 4px',borderRadius:8,border:'none',fontSize:13,fontWeight:500,cursor:'pointer',background:role===r?C.g900:C.g50,color:role===r?C.white:C.g700,transition:'all 0.15s',textTransform:'capitalize',fontFamily:C.sans}}>{r}</button>
          ))}
        </div>

        <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:700,color:C.g900,margin:'0 0 4px'}}>Welcome back</h1>
        <p style={{fontSize:13,color:C.g600,margin:'0 0 24px'}}>{role==='contractor'?'Access your SHE files and projects':'Manage your assignments and earnings'}</p>

        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:14}}>
          {[{label:'Email address',type:'email',val:email,set:setEmail,ph:'you@example.com'},
            {label:'Password',type:'password',val:password,set:setPassword,ph:'••••••••'}].map(f => (
            <div key={f.label}>
              <label style={{display:'block',fontSize:13,fontWeight:500,color:C.g700,marginBottom:5}}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required
                style={{width:'100%',padding:'10px 14px',border:`1px solid ${C.g100}`,borderRadius:8,fontSize:14,color:C.g900,fontFamily:C.sans,outline:'none',boxSizing:'border-box' as const,background:C.white}} />
            </div>
          ))}
          {error && <div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px'}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{background:C.g900,color:C.white,fontWeight:700,padding:'12px',borderRadius:10,border:'none',cursor:'pointer',fontSize:15,fontFamily:C.sans,opacity:loading?0.6:1,marginTop:4}}>
            {loading?'Logging in…':'Log in →'}
          </button>
        </form>

        <p style={{textAlign:'center',fontSize:13,color:C.g600,marginTop:20}}>
          No account? <Link href="/auth/signup" style={{color:C.g900,fontWeight:600,textDecoration:'none'}}>Sign up free</Link>
        </p>
        <p style={{textAlign:'center',fontSize:12,color:'#9ca3af',marginTop:8}}>
          <Link href="/auth/admin-login" style={{color:'#9ca3af',textDecoration:'none'}}>Admin login</Link>
          {' · '}
          <Link href="/" style={{color:'#9ca3af',textDecoration:'none'}}>← Home</Link>
        </p>
      </div>
    </div>
  )
}
