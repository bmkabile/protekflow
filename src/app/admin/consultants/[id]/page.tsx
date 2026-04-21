// src/app/admin/consultants/[id]/page.tsx
// Admin verifies a consultant's SACPCMP registration

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g500:'#22c55e',g600:'#16a34a',g700:'#15803d',
  g800:'#166534',g900:'#14532d',white:'#ffffff',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

export default async function AdminVerifyConsultant({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/admin-login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const admin = createAdminClient()
  const { data: consultant } = await admin
    .from('consultants')
    .select('*, profiles(full_name, company_name, phone)')
    .eq('id', params.id)
    .single()

  if (!consultant) redirect('/admin')

  const { data: authUser } = await admin.auth.admin.getUserById(params.id)
  const email = authUser?.user?.email ?? '—'

  // Count files assigned to this consultant
  const { count: fileCount } = await admin
    .from('she_files').select('id', { count: 'exact', head: true })
    .eq('consultant_id', params.id)

  const isVerified  = consultant.verification_status === 'verified'
  const isRejected  = consultant.verification_status === 'rejected'
  const isSuspended = consultant.verification_status === 'suspended'

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
          <span style={{background:'#ef4444',color:C.white,fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,marginLeft:4}}>ADMIN</span>
        </div>
        <Link href="/admin" style={{color:'#86efac',fontSize:13,textDecoration:'none'}}>← Admin overview</Link>
      </header>

      <div style={{maxWidth:680,margin:'0 auto',padding:'28px 20px'}}>
        <div style={{marginBottom:22}}>
          <h1 style={{fontFamily:C.serif,fontSize:22,fontWeight:700,color:C.g900,margin:'0 0 3px'}}>Consultant verification</h1>
          <p style={{fontSize:13,color:C.g600,margin:0}}>Review and verify SACPCMP registration before enabling on platform</p>
        </div>

        {/* Consultant card */}
        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'20px 22px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
            <div style={{width:48,height:48,borderRadius:'50%',background:C.g100,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.serif,fontSize:20,fontWeight:700,color:C.g800}}>
              {(consultant as any).profiles?.full_name?.[0] ?? 'C'}
            </div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.g900}}>{(consultant as any).profiles?.full_name}</div>
              <div style={{fontSize:13,color:C.g600}}>{(consultant as any).profiles?.company_name ?? 'Independent consultant'}</div>
            </div>
            <div style={{marginLeft:'auto'}}>
              <span style={{
                display:'inline-block',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                background:isVerified?C.g100:isRejected?'#fee2e2':isSuspended?'#fee2e2':'#fef3c7',
                color:isVerified?C.g800:isRejected?'#991b1b':isSuspended?'#991b1b':'#92400e'
              }}>
                {consultant.verification_status}
              </span>
            </div>
          </div>

          {[
            ['Email',             email],
            ['Phone',             (consultant as any).profiles?.phone ?? '—'],
            ['SACPCMP number',    consultant.sacpcmp_number],
            ['SACPCMP category',  consultant.sacpcmp_category ?? 'Not specified'],
            ['SACPCMP expiry',    consultant.sacpcmp_expiry ?? 'Not provided'],
            ['City',              consultant.city],
            ['Province',          consultant.province],
            ['Files completed',   String(fileCount ?? 0)],
            ['Current tier',      consultant.tier],
            ['Registered',        new Date(consultant.created_at).toLocaleDateString('en-ZA',{dateStyle:'long'})],
          ].map(([k,v]) => (
            <div key={String(k)} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:`1px solid ${C.g50}`,fontSize:13}}>
              <span style={{color:C.g500}}>{k}</span>
              <span style={{color:C.g900,fontWeight:500,fontFamily:k==='SACPCMP number'?'monospace':C.sans}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Verification instructions */}
        <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:12,padding:'16px 18px',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:600,color:'#92400e',marginBottom:8}}>Verification checklist</div>
          {[
            `Search SACPCMP public register at sacpcmp.org.za for registration: ${consultant.sacpcmp_number}`,
            'Confirm the name on the register matches the name on this account',
            'Confirm registration is current and not expired or suspended',
            'Confirm the category (CHSO/CHSE/CHSM) matches what was declared',
          ].map((s,i) => (
            <div key={i} style={{display:'flex',gap:8,fontSize:13,color:'#92400e',marginBottom:6}}>
              <span style={{flexShrink:0}}>{i+1}.</span>
              <span>{s}</span>
            </div>
          ))}
          <a href={`https://sacpcmp.org.za/membership-register/?search=${consultant.sacpcmp_number}`}
            target="_blank" rel="noreferrer"
            style={{display:'inline-block',marginTop:8,background:'#f59e0b',color:'#fff',fontWeight:700,padding:'8px 16px',borderRadius:8,fontSize:13,textDecoration:'none'}}>
            Search SACPCMP Register ↗
          </a>
        </div>

        {/* Action buttons */}
        {!isVerified && (
          <div style={{display:'flex',gap:10}}>
            <form action={`/api/admin/consultants/${params.id}/verify`} method="POST" style={{flex:1}}>
              <input type="hidden" name="action" value="verify"/>
              <button type="submit"
                style={{width:'100%',background:C.g900,color:C.white,fontWeight:700,padding:'13px',borderRadius:10,border:'none',cursor:'pointer',fontSize:14,fontFamily:C.sans}}>
                ✓ Verify &amp; activate consultant
              </button>
            </form>
            <form action={`/api/admin/consultants/${params.id}/verify`} method="POST" style={{flex:1}}>
              <input type="hidden" name="action" value="reject"/>
              <button type="submit"
                style={{width:'100%',background:'#fee2e2',color:'#991b1b',fontWeight:700,padding:'13px',borderRadius:10,border:'1px solid #fecaca',cursor:'pointer',fontSize:14,fontFamily:C.sans}}>
                ✕ Reject application
              </button>
            </form>
          </div>
        )}

        {isVerified && (
          <div style={{display:'flex',gap:10}}>
            <div style={{flex:1,background:C.g50,border:`1px solid ${C.g100}`,borderRadius:10,padding:16,textAlign:'center',fontSize:14,fontWeight:600,color:C.g700}}>
              ✓ Consultant is verified and active
            </div>
            <form action={`/api/admin/consultants/${params.id}/verify`} method="POST">
              <input type="hidden" name="action" value="suspend"/>
              <button type="submit"
                style={{padding:'13px 20px',background:'#fee2e2',color:'#991b1b',fontWeight:600,borderRadius:10,border:'1px solid #fecaca',cursor:'pointer',fontSize:13,fontFamily:C.sans}}>
                Suspend
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
