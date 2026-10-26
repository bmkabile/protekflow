import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { formatZAR } from '@/lib/pricing'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',g950:'#052e16',
  white:'#ffffff', serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/admin-login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const admin = createAdminClient()
  const [filesRes, contractorsRes, consultantsRes, txRes] = await Promise.all([
    admin.from('she_files').select('id,status,price_zar,created_at',{count:'exact'}),
    admin.from('contractors').select('id',{count:'exact'}),
    admin.from('consultants').select('id,tier,verification_status',{count:'exact'}),
    admin.from('transactions').select('platform_fee_amount,created_at'),
  ])

  const files       = filesRes.data ?? []
  const totalFiles  = filesRes.count ?? 0
  const consultants = consultantsRes.data ?? []
  const txns        = txRes.data ?? []
  const pendingVerify = consultants.filter((c:any) => c.verification_status==='pending').length
  const totalRevenue  = txns.reduce((s:number,t:any) => s+(t.platform_fee_amount??0),0)

  const { data: recentFiles } = await admin
    .from('v_file_summary').select('*').order('created_at',{ascending:false}).limit(8)

  const { data: pendingConsultants } = await admin
    .from('consultants')
    .select('id,sacpcmp_number,verification_status,created_at,profiles(full_name)')
    .eq('verification_status','pending').order('created_at',{ascending:true}).limit(4)

  const statCards = [
    {label:'SHE files total',  value:totalFiles.toString()},
    {label:'Platform revenue', value:formatZAR(totalRevenue)},
    {label:'Contractors',      value:(contractorsRes.count??0).toString()},
    {label:'Consultants',      value:consultants.length.toString(), note:`${pendingVerify} pending verification`},
  ]

  const statusColor: Record<string,{bg:string;color:string}> = {
    completed:{bg:'#dcfce7',color:'#166534'}, cancelled:{bg:'#fee2e2',color:'#991b1b'},
  }
  const getStatus = (s:string) => statusColor[s] ?? {bg:'#dbeafe',color:'#1d4ed8'}

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
          <span style={{background:'#ef4444',color:C.white,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,marginLeft:4,letterSpacing:'0.5px'}}>ADMIN</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{color:C.g400,fontSize:13}}>Legacy Landmark</span>
          <Link href="/" style={{color:C.g600,fontSize:12,textDecoration:'none',border:`1px solid ${C.g800}`,padding:'4px 12px',borderRadius:6}}>Sign out</Link>
        </div>
      </header>

      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',minHeight:'calc(100vh - 52px)'}}>
        <aside style={{background:C.g900,paddingTop:8}}>
          {[
            {href:'/admin',              label:'Overview',    icon:'⊞'},
            {href:'/admin/files',        label:'All files',   icon:'⊟'},
            {href:'/admin/contractors',  label:'Contractors', icon:'⊿'},
            {href:'/admin/consultants',  label:'Consultants', icon:'◉'},
            {href:'/admin/revenue',      label:'Revenue',     icon:'◈'},
            {href:'/admin/settings',     label:'Settings',    icon:'⊙'},
          ].map(item => (
            <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 20px',fontSize:13,color:C.g300,textDecoration:'none',borderLeft:'3px solid transparent'}}>
              <span style={{fontSize:14,opacity:0.7}}>{item.icon}</span>{item.label}
            </Link>
          ))}
        </aside>

        <main style={{padding:32}}>
          <div style={{marginBottom:28}}>
            <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:600,color:C.g900,margin:'0 0 4px'}}>Platform overview</h1>
            <p style={{fontSize:13,color:C.g600,margin:0}}>East London pilot · {new Date().toLocaleDateString('en-ZA',{month:'long',year:'numeric'})}</p>
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
            {statCards.map(s => (
              <div key={s.label} style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'16px 20px'}}>
                <div style={{fontSize:12,color:C.g600,marginBottom:6}}>{s.label}</div>
                <div style={{fontFamily:C.serif,fontSize:26,fontWeight:700,color:C.g900,lineHeight:1}}>{s.value}</div>
                {s.note && <div style={{fontSize:11,color:C.g500,marginTop:4}}>{s.note}</div>}
              </div>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
            {/* Pending verifications */}
            <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:24}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
                <h2 style={{fontSize:15,fontWeight:600,color:C.g900,margin:0}}>Pending verifications</h2>
                {pendingVerify>0 && (
                  <span style={{background:'#fef3c7',color:'#92400e',fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20}}>{pendingVerify}</span>
                )}
              </div>
              {!pendingConsultants?.length ? (
                <p style={{fontSize:13,color:C.g400,textAlign:'center',padding:'16px 0'}}>No pending verifications.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {(pendingConsultants as any[]).map((c:any) => (
                    <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:C.g50,borderRadius:10,padding:'12px 16px'}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:C.g900}}>{c.profiles?.full_name}</div>
                        <div style={{fontFamily:'monospace',fontSize:11,color:C.g500}}>{c.sacpcmp_number}</div>
                      </div>
                      <Link href={`/admin/consultants/${c.id}`} style={{background:C.g900,color:C.white,fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:8,textDecoration:'none'}}>Verify →</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Revenue */}
            <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:24}}>
              <h2 style={{fontSize:15,fontWeight:600,color:C.g900,margin:'0 0 18px'}}>Revenue breakdown</h2>
              {[
                {label:'Platform fees (20%)', value:formatZAR(totalRevenue)},
                {label:'Total platform revenue', value:formatZAR(totalRevenue), bold:true},
              ].map((row,i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom: i<1?`1px solid ${C.g50}`:'none'}}>
                  <span style={{fontSize:13,color:row.bold?C.g900:C.g600,fontWeight:row.bold?600:400}}>{row.label}</span>
                  <span style={{fontFamily:C.serif,fontSize:15,color:C.g900,fontWeight:row.bold?700:400}}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent files */}
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:24}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <h2 style={{fontSize:15,fontWeight:600,color:C.g900,margin:0}}>Recent file activity</h2>
              <Link href="/admin/files" style={{fontSize:12,color:C.g600,textDecoration:'none'}}>View all →</Link>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.g100}`}}>
                    {['File','Contractor','Consultant','Amount','Fee','Status'].map(h => (
                      <th key={h} style={{textAlign:'left',padding:'8px 12px',color:C.g500,fontWeight:500,fontSize:12}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(recentFiles??[]).map((f:any) => {
                    const st = getStatus(f.status)
                    return (
                      <tr key={f.id} style={{borderBottom:`1px solid ${C.g50}`}}>
                        <td style={{padding:'11px 12px',fontFamily:'monospace',fontSize:12,fontWeight:600}}>{f.file_number}</td>
                        <td style={{padding:'11px 12px',color:C.g800,fontSize:12}}>{f.contractor_name}</td>
                        <td style={{padding:'11px 12px',color:C.g600,fontSize:12}}>{f.consultant_name??'—'}</td>
                        <td style={{padding:'11px 12px',fontWeight:600}}>{formatZAR(f.price_zar)}</td>
                        <td style={{padding:'11px 12px',color:C.g600,fontSize:12}}>20%</td>
                        <td style={{padding:'11px 12px'}}>
                          <span style={{...st,display:'inline-block',fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20}}>{f.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
