// src/app/contractor/payment/success/page.tsx
// PayFast redirects here after successful payment

import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import DraftStarter from '@/components/DraftStarter'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g900:'#14532d',
  white:'#ffffff', serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

export default async function PaymentSuccessPage({
  searchParams
}: { searchParams: { file?: string } }) {
  const fileId = searchParams.file ?? null

  return (
    <div style={{fontFamily:C.sans,minHeight:'100vh',background:C.g900,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:C.white,borderRadius:20,padding:'48px 40px',maxWidth:480,width:'100%',textAlign:'center'}}>
        {/* Animated shield check */}
        <div style={{width:72,height:72,background:C.g50,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
          <svg width="40" height="40" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="8" fill={C.g500}/>
            <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 style={{fontFamily:C.serif,fontSize:26,fontWeight:700,color:C.g900,margin:'0 0 10px'}}>Payment received!</h1>
        <p style={{fontSize:15,color:C.g600,margin:'0 0 28px',lineHeight:1.6}}>
          Your SHE file is in the queue. A verified SACPCMP consultant will review and sign it within <strong style={{color:C.g900}}>48 hours</strong>.
        </p>

        {fileId && <DraftStarter fileId={fileId} />}

        {/* What happens next */}
        <div style={{background:C.g50,borderRadius:12,padding:'16px 20px',textAlign:'left',marginBottom:28}}>
          <div style={{fontSize:11,fontWeight:600,color:C.g500,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:12}}>What happens next</div>
          {[
            ['🤖','AI draft generated','Your project details are being filled into the SHE file template right now.'],
            ['🔍','Consultant matched','A verified SACPCMP professional is being assigned to your file.'],
            ['✍️','Review & e-sign','Your consultant reviews and customises the draft, then signs it with their registered SACPCMP details.'],
            ['📄','Delivered to you','You receive your signed, compliant SHE file by email and in your dashboard.'],
          ].map(([icon,title,desc]) => (
            <div key={String(title)} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
              <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.g900,marginBottom:2}}>{title}</div>
                <div style={{fontSize:12,color:C.g600,lineHeight:1.5}}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {fileId && (
            <Link href={`/contractor/files/${fileId}`}
              style={{background:C.g900,color:C.white,fontWeight:700,padding:'12px',borderRadius:10,textDecoration:'none',fontSize:14}}>
              Track my file →
            </Link>
          )}
          <Link href="/contractor"
            style={{background:'transparent',color:C.g700,fontWeight:500,padding:'11px',borderRadius:10,textDecoration:'none',fontSize:14,border:`1px solid ${C.g200}`}}>
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
