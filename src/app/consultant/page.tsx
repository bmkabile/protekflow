import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { formatZAR, splitRevenue, type ConsultantTier } from '@/lib/pricing'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',
  white:'#ffffff', amber:'#fef3c7', amberText:'#92400e',
  serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

interface FileRow {
  id:string; file_number:string; project_name:string; status:string
  price_zar:number; sla_deadline:string|null; completed_at:string|null
  project_type_id:number|null; is_complex:boolean|null
  contractor:{ full_name:string; company_name:string|null }|null
}

function SlaCell({ deadline }: { deadline:string|null }) {
  if (!deadline) return <span style={{fontSize:11,color:'#9ca3af'}}>—</span>
  const remaining = new Date(deadline).getTime() - Date.now()
  const hrs = Math.max(0, Math.round(remaining / (1000*60*60)))
  const color = remaining < 0 ? '#ef4444' : remaining < 8*3600000 ? '#f59e0b' : C.g600
  const label = remaining < 0 ? 'Overdue' : `${hrs}h left`
  const pct = Math.max(0, Math.min(100, (remaining/(48*3600000))*100))
  return (
    <div style={{minWidth:80}}>
      <div style={{fontSize:11,color,fontWeight:500,marginBottom:3}}>{label}</div>
      <div style={{height:3,borderRadius:2,background:C.g100,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:color}}/>
      </div>
    </div>
  )
}

export default async function ConsultantDashboard() {
  const supabase = createServerSupabaseClient()
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile }    = await supabase.from('profiles').select('full_name').eq('id',user.id).single()
  const { data: consultant } = await supabase.from('consultants').select('*').eq('id',user.id).single()
  if (!consultant) redirect('/auth/login')

  const { data: rawFiles } = await supabase
    .from('she_files')
    .select('*, contractor:profiles!she_files_contractor_id_fkey(full_name,company_name)')
    .eq('consultant_id', user.id).order('created_at',{ascending:false})

  const files = (rawFiles??[]) as FileRow[]
  const pending = files.filter(f => ['paid','matched','in_review','awaiting_sign'].includes(f.status))

  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
  const completedMonth = files.filter(f => f.status==='completed' && f.completed_at && new Date(f.completed_at)>=thisMonth)
  const earningsMonth  = completedMonth.reduce((sum,f) => sum + splitRevenue(f.price_zar, consultant.tier as ConsultantTier).consultantAmount, 0)
  const netMonth       = consultant.tier==='pro' ? earningsMonth - 99900 : earningsMonth

  const isPro    = consultant.tier === 'pro'
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
          {isPro && <span style={{background:C.g500,color:C.g950,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20}}>PRO</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{color:C.g400,fontSize:13}}>{profile?.full_name} · {consultant.sacpcmp_number}</span>
          <Link href="/" style={{color:C.g600,fontSize:12,textDecoration:'none',border:`1px solid ${C.g800}`,padding:'4px 12px',borderRadius:6}}>Sign out</Link>
        </div>
      </header>

      {isPending && (
        <div style={{background:C.amber,borderBottom:'1px solid #fde68a',padding:'10px 28px',fontSize:13,color:C.amberText,display:'flex',gap:8}}>
          <span>⏳</span> Your SACPCMP registration is being verified. You'll be notified by email once approved.
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',minHeight:'calc(100vh - 52px)'}}>
        <aside style={{background:C.g900,paddingTop:8}}>
          {[{href:'/consultant',label:'Dashboard',icon:'⊞'},{href:'/consultant/files',label:'Pending files',icon:'⊟'},{href:'/consultant/completed',label:'Completed',icon:'✓'},{href:'/consultant/earnings',label:'Earnings',icon:'◈'},{href:'/consultant/settings',label:'Settings',icon:'⊙'}].map(item => (
            <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 20px',fontSize:13,color:C.g300,textDecoration:'none',borderLeft:'3px solid transparent'}}>
              <span style={{fontSize:14,opacity:0.7}}>{item.icon}</span>{item.label}
            </Link>
          ))}
        </aside>

        <main style={{padding:28}}>
          <div style={{marginBottom:22}}>
            <h1 style={{fontFamily:C.serif,fontSize:22,fontWeight:700,color:C.g900,margin:'0 0 3px'}}>Dashboard</h1>
            <p style={{fontSize:13,color:C.g600,margin:0}}>SACPCMP Reg: {consultant.sacpcmp_number} · {isPro?'Pro tier':'Free tier'}</p>
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22}}>
            {[
              {label:'Pending action',    value:pending.length.toString(),         note:pending.length>0?'Action required':'All clear'},
              {label:'Completed (month)', value:completedMonth.length.toString(),  note:isPro?'Unlimited cap':'10 max (Free)'},
              {label:'Gross earnings',    value:formatZAR(earningsMonth),          note:`Net ${formatZAR(netMonth)} after fees`},
              {label:'Rating',            value:consultant.rating_avg>0?`${consultant.rating_avg}/5`:'—', note:`${consultant.rating_count} reviews`},
            ].map(s => (
              <div key={s.label} style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:C.g500,marginBottom:5}}>{s.label}</div>
                <div style={{fontFamily:C.serif,fontSize:24,fontWeight:700,color:C.g900,lineHeight:1}}>{s.value}</div>
                {s.note && <div style={{fontSize:11,color:C.g500,marginTop:3}}>{s.note}</div>}
              </div>
            ))}
          </div>

          {/* Pending queue */}
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 20px',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:0}}>Files requiring action</h2>
              <span style={{fontSize:12,color:C.g500}}>48h SLA from contractor payment</span>
            </div>
            {pending.length===0 ? (
              <div style={{textAlign:'center',padding:'28px 0',color:C.g400}}>
                <div style={{fontSize:28,marginBottom:8}}>✓</div>
                <div style={{fontSize:14,fontWeight:500,color:C.g600}}>You&apos;re up to date</div>
                <div style={{fontSize:13,marginTop:4}}>New assignments will appear here</div>
              </div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${C.g100}`}}>
                      {['File','Project','Contractor','Type','Earn','SLA','Action'].map(h => (
                        <th key={h} style={{textAlign:'left',padding:'7px 10px',color:C.g500,fontWeight:500,fontSize:11}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((f:FileRow) => {
                      const { consultantAmount } = splitRevenue(f.price_zar, consultant.tier as ConsultantTier)
                      return (
                        <tr key={f.id} style={{borderBottom:`1px solid ${C.g50}`}}>
                          <td style={{padding:'10px',fontFamily:'monospace',fontSize:11,fontWeight:600}}>{f.file_number}</td>
                          <td style={{padding:'10px',fontWeight:500,color:C.g900}}>
                            <div>{f.project_name}</div>
                            {f.is_complex && <span style={{fontSize:10,background:'#fef3c7',color:'#92400e',padding:'1px 7px',borderRadius:20,fontWeight:600}}>COMPLEX</span>}
                          </td>
                          <td style={{padding:'10px',color:C.g600,fontSize:11}}>{(f.contractor as any)?.company_name??(f.contractor as any)?.full_name}</td>
                          <td style={{padding:'10px',color:C.g500,fontSize:11}}>{f.project_type_id?`T0${f.project_type_id}`:'—'}</td>
                          <td style={{padding:'10px',fontWeight:700,color:C.g700}}>{formatZAR(consultantAmount)}</td>
                          <td style={{padding:'10px'}}><SlaCell deadline={f.sla_deadline}/></td>
                          <td style={{padding:'10px'}}>
                            <Link href={`/consultant/files/${f.id}`} style={{background:C.g900,color:C.white,fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:8,textDecoration:'none',whiteSpace:'nowrap'}}>
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

          {/* Earnings breakdown */}
          {completedMonth.length > 0 && (
            <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 20px',marginBottom:16}}>
              <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 14px'}}>This month&apos;s earnings</h2>
              {[
                {label:`Files completed (${completedMonth.length} × ${formatZAR(isPro?382500:337500)})`, value:formatZAR(earningsMonth), pos:true},
                {label:'Platform fee '+(isPro?'(15% — Pro)':'(25% — Free)'), value:'−'+formatZAR(completedMonth.length*(isPro?67500:112500)), pos:false},
                ...(isPro ? [{label:'Pro subscription',value:'−R999',pos:false}] : []),
                {label:'Net earnings', value:formatZAR(netMonth), bold:true},
              ].map((row,i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:i<(isPro?3:2)?`1px solid ${C.g50}`:'none'}}>
                  <span style={{fontSize:13,color:(row as any).bold?C.g900:C.g600,fontWeight:(row as any).bold?600:400}}>{row.label}</span>
                  <span style={{fontFamily:(row as any).bold?C.serif:C.sans,fontSize:(row as any).bold?20:13,fontWeight:700,color:row.pos?C.g900:row.value.startsWith('−')?'#ef4444':C.g900}}>{row.value}</span>
                </div>
              ))}
              <div style={{marginTop:10,fontSize:12,color:C.g600}}>
                Next payout: <strong style={{color:C.g900}}>{isPro?'Weekly (Friday)':'Monthly (end of month)'}</strong>
              </div>
            </div>
          )}

          {/* Pro upsell */}
          {!isPro && (
            <div style={{background:C.g900,borderRadius:14,padding:'18px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:14}}>
              <div>
                <div style={{fontFamily:C.serif,fontSize:16,fontWeight:600,color:C.white,marginBottom:3}}>Upgrade to Pro — R999/month</div>
                <div style={{fontSize:13,color:C.g300}}>Earn R3,825/file · Weekly payouts · Unlimited files. Pays for itself at 3 files/month.</div>
              </div>
              <Link href="/consultant/settings" style={{background:C.g500,color:C.g950,fontWeight:700,padding:'10px 22px',borderRadius:10,textDecoration:'none',fontSize:13,flexShrink:0}}>Go Pro →</Link>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
