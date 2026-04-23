import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { formatZAR } from '@/lib/pricing'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',g950:'#052e16',
  white:'#ffffff', serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

const STATUS: Record<string,{label:string; bg:string; color:string}> = {
  draft:           {label:'Draft',             bg:'#fef3c7',color:'#92400e'},
  payment_pending: {label:'Awaiting payment',  bg:'#fef3c7',color:'#92400e'},
  paid:            {label:'Queued',            bg:'#dbeafe',color:'#1d4ed8'},
  matched:         {label:'Matched',           bg:'#dbeafe',color:'#1d4ed8'},
  in_review:       {label:'In review',         bg:'#dbeafe',color:'#1d4ed8'},
  awaiting_sign:   {label:'Awaiting signature',bg:'#dbeafe',color:'#1d4ed8'},
  signed:          {label:'Signed',            bg:'#dcfce7',color:'#166534'},
  completed:       {label:'Completed ✓',       bg:'#dcfce7',color:'#166534'},
  cancelled:       {label:'Cancelled',         bg:'#fee2e2',color:'#991b1b'},
  overdue:         {label:'Overdue',           bg:'#fee2e2',color:'#991b1b'},
}

const NAV = [
  {href:'/contractor',           label:'Dashboard',    icon:'⊞'},
  {href:'/contractor/new-file',  label:'New SHE file', icon:'+'},
  {href:'/contractor/files',     label:'My files',     icon:'⊟'},
  {href:'/contractor/payments',  label:'Payments',     icon:'◈'},
  {href:'/contractor/settings',  label:'Settings',     icon:'⊙'},
]

export default async function ContractorDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name,company_name').eq('id', user.id).single()
  const { data: files } = await supabase.from('she_files').select('*').eq('contractor_id', user.id).order('created_at',{ascending:false})

  const completed  = files?.filter(f => f.status === 'completed') ?? []
  const active     = files?.filter(f => !['completed','cancelled'].includes(f.status)) ?? []
  const totalSpent = completed.reduce((s,f) => s + (f.price_zar??0), 0)
  const saved      = completed.length * 800000 - totalSpent

  const firstName  = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div style={{fontFamily:C.sans,minHeight:'100vh',background:C.g50}}>
      {/* Top bar */}
      <header style={{background:C.g900,padding:'0 28px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="7" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontFamily:C.serif,fontWeight:600,color:C.white,fontSize:17}}>ProtekFlow</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{color:C.g400,fontSize:13}}>{profile?.company_name ?? profile?.full_name}</span>
          <Link href="/" style={{color:C.g600,fontSize:12,textDecoration:'none',border:`1px solid ${C.g800}`,padding:'4px 12px',borderRadius:6}}>Sign out</Link>
        </div>
      </header>

      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',minHeight:'calc(100vh - 52px)'}}>
        {/* Sidebar */}
        <aside style={{background:C.g900,paddingTop:8}}>
          {NAV.map(item => (
            <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 20px',fontSize:13,color:C.g300,textDecoration:'none',borderLeft:`3px solid transparent`}}>
              <span style={{fontSize:14,opacity:0.7}}>{item.icon}</span>{item.label}
            </Link>
          ))}
        </aside>

        {/* Main */}
        <main style={{padding:32}}>
          {/* Header */}
          <div style={{marginBottom:28}}>
            <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:600,color:C.g900,margin:'0 0 4px'}}>Good day, {firstName}</h1>
            <p style={{fontSize:14,color:C.g600,margin:0}}>Your construction safety compliance dashboard</p>
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
            {[
              {label:'Total files',    value:(files?.length??0).toString()},
              {label:'Active',         value:active.length.toString(),      note:active.length>0?'Within 48h SLA':'All clear'},
              {label:'Total spent',    value:formatZAR(totalSpent),         note:`vs ${formatZAR(completed.length*800000)} market`},
              {label:'Saved',          value:formatZAR(saved>0?saved:0),   note:'vs independent consultant'},
            ].map(s => (
              <div key={s.label} style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'16px 20px'}}>
                <div style={{fontSize:12,color:C.g600,marginBottom:6}}>{s.label}</div>
                <div style={{fontFamily:C.serif,fontSize:26,fontWeight:700,color:C.g900,lineHeight:1}}>{s.value}</div>
                {s.note && <div style={{fontSize:11,color:C.g500,marginTop:4}}>{s.note}</div>}
              </div>
            ))}
          </div>

          {/* New file CTA */}
          {(!files||files.length===0) && (
            <div style={{background:C.g900,borderRadius:16,padding:40,textAlign:'center',marginBottom:24}}>
              <div style={{fontFamily:C.serif,fontSize:22,fontWeight:600,color:C.white,marginBottom:8}}>No SHE files yet</div>
              <p style={{fontSize:14,color:C.g300,marginBottom:24,maxWidth:360,margin:'0 auto 24px'}}>Submit your first project and get a professionally signed SHE file in 48 hours.</p>
              <Link href="/contractor/new-file" style={{background:C.g500,color:C.g950,fontWeight:700,padding:'12px 28px',borderRadius:10,textDecoration:'none',fontSize:14}}>Start new SHE file →</Link>
            </div>
          )}

          {/* Files table */}
          {files && files.length > 0 && (
            <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:24}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <h2 style={{fontSize:15,fontWeight:600,color:C.g900,margin:0}}>My SHE files</h2>
                <Link href="/contractor/new-file" style={{background:C.g900,color:C.white,fontSize:13,fontWeight:600,padding:'8px 16px',borderRadius:8,textDecoration:'none'}}>+ New file</Link>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${C.g100}`}}>
                      {['File No.','Project','Submitted','Status','Amount',''].map(h => (
                        <th key={h} style={{textAlign:'left',padding:'8px 12px',color:C.g500,fontWeight:500,fontSize:12}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f:any) => {
                      const st = STATUS[f.status] ?? STATUS.draft
                      return (
                        <tr key={f.id} style={{borderBottom:`1px solid ${C.g50}`}}>
                          <td style={{padding:'11px 12px',fontFamily:'monospace',fontSize:12,fontWeight:600,color:C.g800}}>{f.file_number}</td>
                          <td style={{padding:'11px 12px',color:C.g800,fontWeight:500}}>{f.project_name}</td>
                          <td style={{padding:'11px 12px',color:C.g500,fontSize:12}}>{new Date(f.created_at).toLocaleDateString('en-ZA')}</td>
                          <td style={{padding:'11px 12px'}}>
                            <span style={{...st,display:'inline-block',fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20}}>{st.label}</span>
                          </td>
                          <td style={{padding:'11px 12px',fontWeight:600,color:C.g900}}>{formatZAR(f.price_zar)}</td>
                          <td style={{padding:'11px 12px'}}>
                            {f.status==='completed'&&f.docuseal_document_url ? (
                              <a href={f.docuseal_document_url} target="_blank" rel="noreferrer" style={{color:C.g700,fontSize:12,fontWeight:600}}>Download ↓</a>
                            ):(
                              <Link href={`/contractor/files/${f.id}`} style={{color:C.g500,fontSize:12,textDecoration:'none'}}>View →</Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
