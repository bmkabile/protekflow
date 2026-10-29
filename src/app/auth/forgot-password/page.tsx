'use client'
// src/app/auth/forgot-password/page.tsx
// Step 1 of password reset: the user enters their email and Supabase sends a reset link.
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g500:'#22c55e',g600:'#16a34a',g700:'#15803d',
  g900:'#14532d',g950:'#052e16',white:'#ffffff',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // The callback exchanges the emailed code for a session, then forwards to `next`.
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })
    setLoading(false)
    // Only surface real delivery problems (rate limit, bad SMTP). Never reveal whether the
    // address has an account: unknown emails get the same confirmation as known ones.
    if (err && /rate limit|too many/i.test(err.message)) {
      setError('Too many reset requests. Wait a few minutes and try again.')
      return
    }
    if (err && err.status && err.status >= 500) {
      setError('We could not send the email right now. Please try again shortly.')
      return
    }
    setSent(true)
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

        {sent ? (
          <>
            <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:700,color:C.g900,margin:'0 0 8px'}}>Check your email</h1>
            <p style={{fontSize:14,color:C.g700,lineHeight:1.55,margin:'0 0 20px'}}>
              If an account exists for <strong>{email}</strong>, a reset link is on its way. The link expires after a short time, so use it soon.
            </p>
            <p style={{fontSize:12,color:'#6b7280',lineHeight:1.5,margin:'0 0 20px'}}>
              Nothing after a few minutes? Check your spam folder, then request a new link.
            </p>
            <Link href="/auth/login" style={{display:'block',textAlign:'center',background:C.g900,color:C.white,fontWeight:700,padding:12,borderRadius:10,textDecoration:'none',fontSize:15}}>
              Back to log in
            </Link>
          </>
        ) : (
          <>
            <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:700,color:C.g900,margin:'0 0 4px'}}>Reset your password</h1>
            <p style={{fontSize:13,color:C.g600,margin:'0 0 24px'}}>Enter your account email and we will send you a reset link.</p>
            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label htmlFor="email" style={{display:'block',fontSize:13,fontWeight:500,color:C.g700,marginBottom:5}}>Email address</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"
                  style={{width:'100%',padding:'10px 14px',border:`1px solid ${C.g100}`,borderRadius:8,fontSize:14,color:C.g900,fontFamily:C.sans,outline:'none',boxSizing:'border-box',background:C.white}} />
              </div>
              {error && <div role="alert" style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',fontSize:13,borderRadius:8,padding:'10px 14px'}}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{background:C.g900,color:C.white,fontWeight:700,padding:12,borderRadius:10,border:'none',cursor:'pointer',fontSize:15,fontFamily:C.sans,opacity:loading?0.6:1}}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p style={{textAlign:'center',fontSize:13,color:C.g600,marginTop:20}}>
              Remembered it? <Link href="/auth/login" style={{color:C.g900,fontWeight:600,textDecoration:'none'}}>Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
