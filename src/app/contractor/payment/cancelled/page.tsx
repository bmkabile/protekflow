// src/app/contractor/payment/cancelled/page.tsx

import Link from 'next/link'

const C = {
  g100:'#dcfce7',g500:'#22c55e',g900:'#14532d',
  white:'#ffffff', serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

export default function PaymentCancelledPage({ searchParams }: { searchParams: { file?: string } }) {
  return (
    <div style={{fontFamily:C.sans,minHeight:'100vh',background:'#1f2937',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:C.white,borderRadius:20,padding:'48px 40px',maxWidth:440,width:'100%',textAlign:'center'}}>
        <div style={{width:64,height:64,background:'#fee2e2',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:28}}>
          ✕
        </div>
        <h1 style={{fontFamily:C.serif,fontSize:24,fontWeight:700,color:C.g900,margin:'0 0 10px'}}>Payment cancelled</h1>
        <p style={{fontSize:14,color:'#6b7280',margin:'0 0 28px',lineHeight:1.6}}>
          No payment was taken. Your SHE file draft has been saved — you can complete payment anytime.
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {searchParams.file && (
            <Link href={`/contractor/files/${searchParams.file}`}
              style={{background:C.g900,color:C.white,fontWeight:700,padding:'12px',borderRadius:10,textDecoration:'none',fontSize:14}}>
              Complete payment →
            </Link>
          )}
          <Link href="/contractor/new-file"
            style={{background:'transparent',color:C.g900,fontWeight:500,padding:'11px',borderRadius:10,textDecoration:'none',fontSize:14,border:'1px solid #e5e7eb'}}>
            Start a new file
          </Link>
          <Link href="/contractor"
            style={{color:'#9ca3af',fontSize:13,textDecoration:'none'}}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
