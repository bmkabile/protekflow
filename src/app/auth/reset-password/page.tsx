'use client'
// src/app/auth/reset-password/page.tsx
// Step 2 of password reset: the user arrives here from /auth/callback with a temporary
// recovery session and chooses a new password.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g500:'#22c55e',g600:'#16a34a',g700:'#15803d',
  g900:'#14532d',g950:'#052e16',white:'#ffffff',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}
const inp = {width:'100%',padding:'10px 14px',border:`1px solid ${C.g100}`,borderRadius:8,fontSize:14,color:C.g900,fontFamily:C.sans,outline:'none',boxSizing:'border-box' as const,background:C.white}
const lbl = {display:'block' as const,fontSize:13,fontWeight:500,color:C.g700,marginBottom:5}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // The callback route has already exchanged the emailed code for a session cookie.
  // If there is no session, the link was expired, already used, or opened in a different browser.
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setReady(data.user ? 'ok' : 'invalid'))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setLoading(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }

    // Sign out every other device so a stolen session cannot outlive the reset.
    await supabase.auth.signOut({ scope: 'others' })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    router.push(`/${profile?.role ?? ''}`)
    router.refresh()
  }

  return (
    <div style={{minHeight:'100vh',background:C.g950,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:C.sans}}>
      <div style={{background:C.white,borderRadius:20,padding:'40px 36px',width:'100%',maxWidth:420}}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none',marginBottom:28}}>
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="8" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontFamily:C.serif,fontWeight:600,color:C.g900,fontSize:17}}>ProtekFlow</span>
        </Link>

        {ready === 'checking' && <p style={{fontSize:14,color:C.g600}}>Checking your reset link…</p>}

        {ready === 'invalid' && (
          <>
            <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:700,color:C.g900,margin:'0 0 8px'}}>This link is no longer valid</h1>
            <p style={{fontSize:14,color:C.g700,lineHeight:1.55,margin:'0 0 20px'}}>
              Reset links expire and work once. Open the link in the same browser you requested it from, or request a new one.
            </p>
            <Link href="/auth/forgot-password" style={{display:'block',textAlign:'center',background:C.g900,color:C.white,fontWeight:700,padding:12,borderRadius:10,textDecoration:'none',fontSize:15}}>
              Request a new link
            </Link>
          </>
        )}

        {ready === 'ok' && (
          <>
            <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:700,color:C.g900,margin:'0 0 4px'}}>Choose a new password</h1>
            <p style={{fontSize:13,color:C.g600,margin:'0 0 24px'}}>You will be signed in once it is saved.</p>
            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label htmlFor="pw" style={lbl}>New password</label>
                <input id="pw" style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} autoComplete="new-password" />
              </div>
              <div>
                <label htmlFor="pw2" style={lbl}>Confirm new password</label>
                <input id="pw2" style={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat the password" required minLength={8} autoComplete="new-password" />
              </div>
              {error && <div role="alert" style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px'}}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{background:C.g900,color:C.white,fontWeight:700,padding:12,borderRadius:10,border:'none',cursor:'pointer',fontSize:15,fontFamily:C.sans,opacity:loading?0.6:1}}>
                {loading ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
