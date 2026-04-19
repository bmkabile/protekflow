'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g500:'#22c55e',g600:'#16a34a',g700:'#15803d',
  g800:'#166534',g900:'#14532d',g950:'#052e16',white:'#ffffff',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      setError('This account does not have admin access.')
      setLoading(false); return
    }
    router.push('/admin'); router.refresh()
  }

  const inp = {width:'100%',padding:'10px 14px',border:`1px solid #dcfce7`,borderRadius:8,fontSize:14,color:C.g900,fontFamily:C.sans,outline:'none',boxSizing:'border-box' as const,background:C.white}

  return (
    <div style={{minHeight:'100vh',background:'#030d06',display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:C.sans}}>
      <div style={{background:C.white,borderRadius:20,padding:'40px 36px',width:'100%',maxWidth:400}}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none',marginBottom:8}}>
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="8" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontFamily:C.serif,fontWeight:600,color:C.g900,fontSize:17}}>ProtekFlow</span>
          <span style={{background:'#fee2e2',color:'#991b1b',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,marginLeft:4}}>ADMIN</span>
        </Link>

        <div style={{borderLeft:`3px solid #fca5a5`,paddingLeft:12,marginBottom:24,marginTop:20}}>
          <div style={{fontSize:12,color:'#991b1b',fontWeight:600}}>Restricted access</div>
          <div style={{fontSize:12,color:'#9ca3af',marginTop:2}}>Legacy Landmark (Pty) Ltd internal use only.</div>
        </div>

        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{display:'block',fontSize:13,fontWeight:500,color:C.g700,marginBottom:5}}>Admin email</label>
            <input style={inp} type="email" placeholder="admin@protekflow.co.za" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{display:'block',fontSize:13,fontWeight:500,color:C.g700,marginBottom:5}}>Password</label>
            <input style={inp} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px'}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{background:C.g900,color:C.white,fontWeight:700,padding:'12px',borderRadius:10,border:'none',cursor:'pointer',fontSize:15,fontFamily:C.sans,opacity:loading?0.6:1,marginTop:4}}>
            {loading?'Verifying…':'Access admin →'}
          </button>
        </form>

        <p style={{textAlign:'center',fontSize:12,color:'#9ca3af',marginTop:20}}>
          <Link href="/" style={{color:'#9ca3af',textDecoration:'none'}}>← Back to home</Link>
        </p>
      </div>
    </div>
  )
}
