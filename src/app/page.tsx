import Link from 'next/link'

const C = {
  g50:'#f0fdf4',g100:'#dcfce7',g200:'#bbf7d0',g300:'#86efac',g400:'#4ade80',
  g500:'#22c55e',g600:'#16a34a',g700:'#15803d',g800:'#166534',g900:'#14532d',g950:'#052e16',
  white:'#ffffff', serif:"'Fraunces',Georgia,serif", sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

function Logo() {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <rect width="34" height="34" rx="8" fill={C.g500}/>
        <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z"
              fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{fontFamily:C.serif,fontWeight:600,color:C.white,fontSize:18,letterSpacing:'-0.3px'}}>ProtekFlow</span>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div style={{fontFamily:C.sans,color:C.g900,background:C.white,minHeight:'100vh'}}>

      {/* NAV */}
      <nav style={{background:C.g900,padding:'0 40px',height:58,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
        <Link href="/" style={{textDecoration:'none'}}><Logo /></Link>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Link href="/auth/admin-login" style={{color:C.g400,fontSize:13,padding:'6px 14px',textDecoration:'none'}}>Admin</Link>
          <Link href="/auth/login" style={{color:C.g200,fontSize:13,border:`1px solid ${C.g700}`,padding:'7px 18px',borderRadius:8,textDecoration:'none'}}>Log in</Link>
          <Link href="/auth/signup" style={{background:C.g500,color:C.g950,fontSize:13,fontWeight:700,padding:'8px 18px',borderRadius:8,textDecoration:'none'}}>Get started</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{background:C.g900,padding:'96px 40px 80px',textAlign:'center'}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.25)',color:C.g300,fontSize:12,fontWeight:500,padding:'5px 14px',borderRadius:20,marginBottom:24}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:C.g500,display:'inline-block'}}></span>
          OHS Act 85/1993 · Construction Regulations 2014
        </div>
        <h1 style={{fontFamily:C.serif,fontSize:'clamp(38px,5.5vw,64px)',fontWeight:700,color:C.white,lineHeight:1.08,margin:'0 0 20px',maxWidth:760,marginLeft:'auto',marginRight:'auto'}}>
          Construction safety compliance,<br/><em style={{color:C.g400,fontStyle:'italic'}}>done in 48 hours.</em>
        </h1>
        <p style={{color:C.g300,fontSize:17,maxWidth:500,margin:'0 auto 36px',lineHeight:1.65}}>
          Fixed fee R7,500. SACPCMP-registered consultant. DocuSeal e-signature. Site-ready SHE file.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <Link href="/auth/signup" style={{background:C.g500,color:C.g950,fontWeight:700,padding:'14px 32px',borderRadius:12,fontSize:15,textDecoration:'none',letterSpacing:'-0.2px'}}>
            Get my SHE file — R7,500
          </Link>
          <Link href="/auth/signup" style={{border:'1px solid rgba(255,255,255,0.2)',color:C.white,fontWeight:500,padding:'14px 28px',borderRadius:12,fontSize:15,textDecoration:'none'}}>
            I&apos;m a consultant →
          </Link>
        </div>
        {/* Trust strip */}
        <div style={{display:'flex',gap:32,justifyContent:'center',marginTop:48,flexWrap:'wrap'}}>
          {[['48h','Delivery guarantee'],['R7,500','Fixed. No surprises'],['SACPCMP','Verified consultants'],['OHS Act','Built around Act 85/1993']].map(([val,label]) => (
            <div key={label} style={{textAlign:'center'}}>
              <div style={{fontFamily:C.serif,fontSize:22,fontWeight:700,color:C.g400}}>{val}</div>
              <div style={{fontSize:12,color:C.g500,marginTop:2}}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{background:C.white,padding:'72px 40px'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <h2 style={{fontFamily:C.serif,fontSize:36,fontWeight:600,color:C.g900,margin:'0 0 8px'}}>From project to signed file</h2>
            <p style={{color:C.g700,fontSize:15,margin:0}}>Three steps. No back-and-forth. No chasing.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:2}}>
            {[
              {n:'01',title:'Submit',body:'Complete a 5-minute project intake. We generate your SHE file draft automatically.'},
              {n:'02',title:'Expert review',body:'A verified SACPCMP consultant reviews, customises, and e-signs via DocuSeal.'},
              {n:'03',title:'Download',body:'Receive your compliant, signed SHE file. Ready for inspectors, clients, and tenders.'},
            ].map((s,i) => (
              <div key={s.n} style={{padding:'36px 32px',borderRight: i<2 ? `1px solid ${C.g100}` : 'none',position:'relative'}}>
                <div style={{fontFamily:C.serif,fontSize:48,fontWeight:700,color:C.g100,lineHeight:1,marginBottom:12}}>{s.n}</div>
                <h3 style={{fontSize:18,fontWeight:600,color:C.g900,margin:'0 0 8px'}}>{s.title}</h3>
                <p style={{fontSize:14,color:C.g700,lineHeight:1.65,margin:0}}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING — teaser only */}
      <section style={{background:C.g50,padding:'72px 40px'}}>
        <div style={{maxWidth:860,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <h2 style={{fontFamily:C.serif,fontSize:36,fontWeight:600,color:C.g900,margin:'0 0 8px'}}>Simple, transparent pricing</h2>
            <p style={{color:C.g700,fontSize:15,margin:0}}>One fixed fee. A SACPCMP-registered professional reviews and signs your file.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:24}}>
            {/* Contractor card */}
            <div style={{background:C.g900,borderRadius:20,padding:36,color:C.white}}>
              <div style={{fontSize:12,fontWeight:600,color:C.g400,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:16}}>For contractors</div>
              <div style={{fontFamily:C.serif,fontSize:52,fontWeight:700,color:C.white,lineHeight:1,marginBottom:4}}>R7,500</div>
              <div style={{color:C.g300,fontSize:14,marginBottom:28}}>per SHE file · all-inclusive</div>
              <div style={{borderTop:`1px solid ${C.g800}`,paddingTop:20,display:'flex',flexDirection:'column',gap:10}}>
                {['AI-drafted SHE file','SACPCMP e-signature','48-hour delivery','Fixed price, no hidden extras'].map(f => (
                  <div key={f} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,color:C.g200}}>
                    <span style={{color:C.g500,fontWeight:700,fontSize:16}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link href="/auth/signup" style={{display:'block',textAlign:'center',background:C.g500,color:C.g950,fontWeight:700,padding:'13px 0',borderRadius:10,marginTop:28,textDecoration:'none',fontSize:14}}>
                Submit a project
              </Link>
            </div>
            {/* Consultant card */}
            <div style={{background:C.white,border:`1px solid ${C.g100}`,borderRadius:20,padding:36}}>
              <div style={{fontSize:12,fontWeight:600,color:C.g600,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:16}}>For consultants</div>
              <div style={{fontFamily:C.serif,fontSize:52,fontWeight:700,color:C.g900,lineHeight:1,marginBottom:4}}>R6,000</div>
              <div style={{color:C.g600,fontSize:14,marginBottom:28}}>per signed file (80% of the fee)</div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {['Leads sent to you','No marketing needed','Paid per signed file','Digital sign-off tools'].map(f => (
                  <div key={f} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,color:C.g800}}>
                    <span style={{color:C.g500,fontWeight:700,fontSize:16}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link href="/auth/signup" style={{display:'block',textAlign:'center',background:C.g900,color:C.white,fontWeight:700,padding:'13px 0',borderRadius:10,marginTop:28,textDecoration:'none',fontSize:14}}>
                Join as consultant
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLIANCE STRIP */}
      <section style={{background:C.g800,padding:'36px 40px'}}>
        <div style={{maxWidth:860,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
          <div>
            <div style={{fontFamily:C.serif,fontSize:18,fontWeight:600,color:C.white,marginBottom:4}}>Built for South African compliance</div>
            <div style={{fontSize:13,color:C.g300}}>OHS Act 85/1993 · Construction Regulations 2014 · SACPCMP registration required</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Link href="/auth/signup" style={{background:C.g500,color:C.g950,fontWeight:700,padding:'11px 24px',borderRadius:10,textDecoration:'none',fontSize:14}}>Start now</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{background:C.g950,padding:'40px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <svg width="24" height="24" viewBox="0 0 34 34" fill="none">
              <rect width="34" height="34" rx="8" fill={C.g500}/>
              <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z" fill="none" stroke={C.g900} strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M13.5 17l2.5 2.5 5-5" stroke={C.g900} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{fontFamily:C.serif,fontWeight:600,color:C.white,fontSize:15}}>ProtekFlow</span>
          </div>
          <div style={{fontSize:12,color:C.g500}}>A division of Legacy Landmark (Pty) Ltd · East London, Eastern Cape</div>
        </div>
        <div style={{display:'flex',gap:20}}>
          {['Privacy','Terms','Contact'].map(l => (
            <Link key={l} href="#" style={{fontSize:12,color:C.g600,textDecoration:'none'}}>{l}</Link>
          ))}
        </div>
      </footer>

    </div>
  )
}
