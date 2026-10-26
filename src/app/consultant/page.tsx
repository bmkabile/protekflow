import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { formatZAR, splitRevenue } from '@/lib/pricing'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',g950:'#052e16',
  white:'#ffffff', serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

interface SheFileRow {
  id:string; file_number:string; project_name:string; status:string
  price_zar:number; sla_deadline:string|null; completed_at:string|null
  contractor:{ full_name:string; company_name:string|null }|null
}

export default async function ConsultantDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const { data: consultant } = await supabase.from('consultants').select('*').eq('id', user.id).single()
  if (!consultant) redirect('/auth/login')

  const { data: rawFiles } = await supabase
    .from('she_files')
    .select('*, contractor:profiles!she_files_contractor_id_fkey(full_name,company_name)')
    .eq('consultant_id', user.id).order('created_at',{ascending:false})

  const files = (rawFiles??[]) as SheFileRow[]
  const pending = files.filter((f:SheFileRow) => ['paid','matched','in_review'].includes(f.status))
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
  const completedThisMonth = files.filter((f:SheFileRow) =>
    f.status==='completed' && f.completed_at && new Date(f.completed_at)>=thisMonth
  )
  const earningsThisMonth = completedThisMonth.reduce((sum:number,f:SheFileRow) => {
    const { consultantAmount } = splitRevenue(f.price_zar)
    return sum + consultantAmount
  }, 0)
  const isPending = consultant.verification_status === 'pending'

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
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:C.g400,fontSize:13}}>{profile?.full_name} · {consultant.sacpcmp_number}</span>
          <Link href="/" style={{color:C.g600,fontSize:12,textDecoration:'none',border:`1px solid ${C.g800}`,padding:'4px 12px',borderRadius:6}}>Sign out</Link>
        </div>
      </header>

      {/* Verification banner */}
      {isPending && (
        <div style={{background:'#fef3c7',borderBottom:'1px solid #fde68a',padding:'10px 28px',fontSize:13,color:'#92400e',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:15}}>⏳</span>
          Your SACPCMP registration is being verified. You will be notified by email once approved.
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',minHeight:'calc(100vh - 52px)'}}>
        <aside style={{background:C.g900,paddingTop:8}}>
          {[
            {href:'/consultant',          label:'Dashboard',    icon:'⊞'},
            {href:'/consultant/files',    label:'Pending files', icon:'⊟'},
            {href:'/consultant/completed',label:'Completed',    icon:'✓'},
            {href:'/consultant/earnings', label:'Earnings',     icon:'◈'},
            {href:'/consultant/settings', label:'Settings',     icon:'⊙'},
          ].map(item => (
            <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 20px',fontSize:13,color:C.g300,textDecoration:'none',borderLeft:'3px solid transparent'}}>
              <span style={{fontSize:14,opacity:0.7}}>{item.icon}</span>{item.label}
            </Link>
          ))}
        </aside>

        <main style={{padding:32}}>
          <div style={{marginBottom:28}}>
            <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:600,color:C.g900,margin:'0 0 4px'}}>
              Dashboard
            </h1>
            <p style={{fontSize:13,color:C.g600,margin:0}}>SACPCMP Reg: {consultant.sacpcmp_number}</p>
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
            {[
              {label:'Pending files',    value:pending.length.toString(),            note:pending.length>0?'Action required':'All clear'},
              {label:'Files this month', value:completedThisMonth.length.toString(), note:'Signed and delivered'},
              {label:'Earnings (month)', value:formatZAR(earningsThisMonth),         note:'After 20% platform fee'},
              {label:'Rating',           value:consultant.rating_avg>0?`${consultant.rating_avg}/5`:'—', note:`${consultant.rating_count} reviews`},
            ].map(s => (
              <div key={s.label} style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'16px 20px'}}>
                <div style={{fontSize:12,color:C.g600,marginBottom:6}}>{s.label}</div>
                <div style={{fontFamily:C.serif,fontSize:26,fontWeight:700,color:C.g900,lineHeight:1}}>{s.value}</div>
                {s.note && <div style={{fontSize:11,color:C.g500,marginTop:4}}>{s.note}</div>}
              </div>
            ))}
          </div>

          {/* Pending files */}
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:24,marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <h2 style={{fontSize:15,fontWeight:600,color:C.g900,margin:0}}>Files requiring action</h2>
              <span style={{fontSize:12,color:C.g500}}>48h SLA from payment</span>
            </div>
            {pending.length===0 ? (
              <p style={{fontSize:14,color:C.g400,textAlign:'center',padding:'24px 0'}}>No files pending — you&apos;re up to date.</p>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${C.g100}`}}>
                      {['File','Project','Contractor','Your earn','Deadline','Action'].map(h => (
                        <th key={h} style={{textAlign:'left',padding:'8px 12px',color:C.g500,fontWeight:500,fontSize:12}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((f:SheFileRow) => {
                      const { consultantAmount } = splitRevenue(f.price_zar)
                      const deadline = f.sla_deadline ? new Date(f.sla_deadline) : null
                      const overdue  = deadline && deadline < new Date()
                      return (
                        <tr key={f.id} style={{borderBottom:`1px solid ${C.g50}`}}>
                          <td style={{padding:'11px 12px',fontFamily:'monospace',fontSize:12,fontWeight:600}}>{f.file_number}</td>
                          <td style={{padding:'11px 12px',fontWeight:500,color:C.g800}}>{f.project_name}</td>
                          <td style={{padding:'11px 12px',color:C.g600,fontSize:12}}>{(f.contractor as any)?.company_name??(f.contractor as any)?.full_name}</td>
                          <td style={{padding:'11px 12px',fontWeight:700,color:C.g700}}>{formatZAR(consultantAmount)}</td>
                          <td style={{padding:'11px 12px',fontSize:12,color:overdue?'#ef4444':C.g600}}>
                            {deadline ? deadline.toLocaleString('en-ZA',{dateStyle:'short',timeStyle:'short'}) : '—'}
                          </td>
                          <td style={{padding:'11px 12px'}}>
                            <Link href={`/consultant/files/${f.id}`} style={{background:C.g900,color:C.white,fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:8,textDecoration:'none'}}>
                              Review & Sign →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
