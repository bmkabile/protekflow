// src/app/contractor/files/[id]/page.tsx
// Contractor views a single SHE file — status, draft, and download

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { formatZAR } from '@/lib/pricing'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',
  white:'#ffffff', serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

const STAGES = ['Submitted','Paid','AI drafted','Matched','In review','Signed','Delivered']
const STAGE_BY_STATUS: Record<string,number> = {
  draft:0, payment_pending:1, paid:2, matched:3,
  in_review:4, awaiting_sign:4, signed:5, completed:6,
}

const STATUS_STYLE: Record<string,{label:string;bg:string;color:string}> = {
  draft:           {label:'Draft',             bg:'#fef3c7',color:'#92400e'},
  payment_pending: {label:'Awaiting payment',  bg:'#fef3c7',color:'#92400e'},
  paid:            {label:'Queued',            bg:'#dbeafe',color:'#1d4ed8'},
  matched:         {label:'Matched',           bg:'#dbeafe',color:'#1d4ed8'},
  in_review:       {label:'In review',         bg:'#dbeafe',color:'#1d4ed8'},
  awaiting_sign:   {label:'Awaiting signature',bg:'#ede9fe',color:'#5b21b6'},
  signed:          {label:'Signed',            bg:C.g100,   color:C.g800},
  completed:       {label:'Delivered ✓',       bg:C.g100,   color:C.g800},
  cancelled:       {label:'Cancelled',         bg:'#fee2e2',color:'#991b1b'},
  overdue:         {label:'Overdue!',           bg:'#fee2e2',color:'#991b1b'},
}

export default async function ContractorFilePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: file } = await admin
    .from('she_files')
    .select(`*, project_type:project_types(code,label),
      consultant:profiles!she_files_consultant_id_fkey(full_name),
      consultant_detail:consultants!she_files_consultant_id_fkey(sacpcmp_number,rating_avg,tier)`)
    .eq('id', params.id)
    .eq('contractor_id', user.id)
    .single()

  if (!file) redirect('/contractor')

  const stage = STAGE_BY_STATUS[file.status] ?? 0
  const st    = STATUS_STYLE[file.status] ?? STATUS_STYLE.draft

  const slaRemaining = file.sla_deadline
    ? new Date(file.sla_deadline).getTime() - Date.now()
    : null
  const slaHrs = slaRemaining !== null ? Math.max(0, Math.round(slaRemaining / (1000*60*60))) : null
  const slaPct = slaRemaining !== null ? Math.max(0, Math.min(100, (slaRemaining/(48*3600000))*100)) : null
  const slaColor = slaPct !== null
    ? slaPct < 20 ? '#ef4444' : slaPct < 50 ? '#f59e0b' : C.g600
    : C.g600

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
        <Link href="/contractor" style={{color:C.g400,fontSize:13,textDecoration:'none'}}>← Dashboard</Link>
      </header>

      <div style={{maxWidth:820,margin:'0 auto',padding:'28px 20px'}}>

        {/* Header row */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontFamily:'monospace',fontSize:12,color:C.g500,marginBottom:4}}>{file.file_number}</div>
            <h1 style={{fontFamily:C.serif,fontSize:22,fontWeight:700,color:C.g900,margin:'0 0 4px'}}>{file.project_name}</h1>
            <div style={{fontSize:13,color:C.g600}}>{file.project_address}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{...st,display:'inline-block',fontSize:12,fontWeight:600,padding:'5px 14px',borderRadius:20}}>{st.label}</span>
            {file.status==='completed' && file.docuseal_document_url && (
              <a href={file.docuseal_document_url} target="_blank" rel="noreferrer"
                style={{background:C.g500,color:C.g950,fontWeight:700,padding:'8px 18px',borderRadius:9,fontSize:13,textDecoration:'none'}}>
                Download signed PDF ↓
              </a>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'20px 24px',marginBottom:16}}>
          <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 16px'}}>File progress</h2>
          <div style={{display:'flex',alignItems:'flex-start',marginBottom:14}}>
            {STAGES.map((s,i) => (
              <div key={s} style={{display:'flex',alignItems:'flex-start',flex:1}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <div style={{width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,
                    background:stage>i?C.g500:stage===i?C.g900:'transparent',
                    color:stage>i?C.g900:C.white,
                    border:stage>i?'none':stage===i?'none':`1px solid ${C.g200}`,
                    boxShadow:stage===i?`0 0 0 3px ${C.g200}`:'none'}}>
                    {stage>i?'✓':i+1}
                  </div>
                  <div style={{fontSize:10,color:stage===i?C.g900:stage>i?C.g600:C.g400,textAlign:'center',lineHeight:1.2}}>{s}</div>
                </div>
                {i<STAGES.length-1 && <div style={{flex:1,height:1,background:stage>i?C.g400:C.g100,margin:'10px 2px 0'}}/>}
              </div>
            ))}
          </div>
          {slaHrs !== null && !['completed','cancelled'].includes(file.status) && (
            <div style={{marginTop:8}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:12,color:C.g600}}>48-hour SLA</span>
                <span style={{fontSize:12,fontWeight:600,color:slaColor}}>
                  {slaRemaining! < 0 ? 'Overdue' : `${slaHrs}h remaining`}
                </span>
              </div>
              <div style={{height:6,borderRadius:3,background:C.g100,overflow:'hidden'}}>
                <div style={{width:`${slaPct}%`,height:'100%',borderRadius:3,background:slaColor,transition:'width 0.3s'}}/>
              </div>
            </div>
          )}
          {file.status==='completed' && (
            <div style={{background:C.g50,borderRadius:8,padding:'10px 14px',marginTop:12,fontSize:13,color:C.g700,display:'flex',gap:8}}>
              <span style={{color:C.g500}}>✓</span>
              Your SHE file was completed on {new Date(file.completed_at!).toLocaleDateString('en-ZA',{dateStyle:'long'})}.
              {file.docuseal_document_url && ' Download your signed PDF above.'}
            </div>
          )}
          {file.status==='in_review' && (
            <div style={{background:C.g50,borderRadius:8,padding:'10px 14px',marginTop:12,fontSize:13,color:C.g700}}>
              Your consultant is reviewing and customising the AI-generated draft. You&apos;ll receive an email when the signed PDF is ready.
            </div>
          )}
          {file.status==='payment_pending' && (
            <div style={{background:'#fef3c7',borderRadius:8,padding:'10px 14px',marginTop:12,fontSize:13,color:'#92400e',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span>Payment not yet received. Complete payment to start the 48-hour SLA.</span>
              <Link href={`/contractor/files/${file.id}/pay`}
                style={{background:'#f59e0b',color:'#fff',fontWeight:700,padding:'7px 16px',borderRadius:8,fontSize:12,textDecoration:'none',flexShrink:0,marginLeft:12}}>
                Pay now →
              </Link>
            </div>
          )}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          {/* Project details */}
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 20px'}}>
            <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 14px'}}>Project details</h2>
            {[
              ['Project type',   (file as any).project_type?.label ?? '—'],
              ['Project value',  file.project_value ? `R${Number(file.project_value).toLocaleString('en-ZA')}` : '—'],
              ['Client',         file.client_name ?? '—'],
              ['Site agent',     file.site_agent ?? '—'],
              ['Start date',     file.project_start_date ? new Date(file.project_start_date).toLocaleDateString('en-ZA') : '—'],
              ['End date',       file.project_end_date   ? new Date(file.project_end_date).toLocaleDateString('en-ZA')   : '—'],
              ['Amount paid',    formatZAR(file.price_zar)],
            ].map(([k,v]) => (
              <div key={String(k)} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${C.g50}`,fontSize:13}}>
                <span style={{color:C.g500}}>{k}</span>
                <span style={{color:C.g900,fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Consultant info */}
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 20px'}}>
            <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 14px'}}>
              {file.consultant_id ? 'Your consultant' : 'Consultant matching'}
            </h2>
            {file.consultant_id ? (
              <>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:C.g100,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.serif,fontSize:16,fontWeight:700,color:C.g800}}>
                    {((file as any).consultant?.full_name?.[0] ?? 'C')}
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:C.g900}}>{(file as any).consultant?.full_name}</div>
                    <div style={{fontSize:12,color:C.g600}}>SACPCMP Reg: {(file as any).consultant_detail?.sacpcmp_number}</div>
                  </div>
                </div>
                {[
                  ['Status',  'Verified'],
                  ['Rating', (file as any).consultant_detail?.rating_avg > 0 ? `${(file as any).consultant_detail.rating_avg}/5` : 'New consultant'],
                  ['Matched', file.matched_at ? new Date(file.matched_at).toLocaleDateString('en-ZA') : '—'],
                ].map(([k,v]) => (
                  <div key={String(k)} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${C.g50}`,fontSize:13}}>
                    <span style={{color:C.g500}}>{k}</span>
                    <span style={{color:C.g900,fontWeight:500}}>{v}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{textAlign:'center',padding:'24px 0',color:C.g400}}>
                <div style={{fontSize:28,marginBottom:8}}>🔍</div>
                <div style={{fontSize:13,fontWeight:500,color:C.g600,marginBottom:4}}>Matching in progress</div>
                <div style={{fontSize:12}}>We&apos;re finding the best available SACPCMP consultant for your project type.</div>
              </div>
            )}
          </div>
        </div>

        {/* AI-generated draft preview */}
        {(file as any).generated_draft && (
          <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:14,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div>
                <h2 style={{fontSize:14,fontWeight:600,color:C.g900,margin:'0 0 2px'}}>AI-generated draft</h2>
                <p style={{fontSize:12,color:C.g500,margin:0}}>Your project details have been filled in. The consultant will complete the remaining sections.</p>
              </div>
              <span style={{background:C.g100,color:C.g800,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20}}>Draft only</span>
            </div>
            <div style={{background:C.g50,borderRadius:10,padding:'14px 16px',maxHeight:300,overflow:'auto',fontFamily:'monospace',fontSize:11,lineHeight:1.8,color:C.g800,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
              {(file as any).generated_draft.slice(0,2000)}{(file as any).generated_draft.length > 2000 ? '\n\n… [truncated — full document available after consultant review and signature]' : ''}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
