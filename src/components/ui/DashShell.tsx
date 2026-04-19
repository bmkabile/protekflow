// Shared dashboard shell — nav + sidebar
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './Logo'
import { C } from '@/lib/theme'

interface NavItem { href: string; label: string; icon: string }

interface DashShellProps {
  nav: NavItem[]
  topRight: React.ReactNode
  children: React.ReactNode
  banner?: React.ReactNode
}

export function DashShell({ nav, topRight, children, banner }: DashShellProps) {
  const path = usePathname()
  return (
    <div style={{minHeight:'100vh', background:C.g50, fontFamily:C.sans}}>
      {/* Top bar */}
      <header style={{background:C.g900, padding:'0 28px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <Logo variant="light" size="sm" />
        <div style={{display:'flex', alignItems:'center', gap:12}}>{topRight}</div>
      </header>
      {banner}
      <div style={{display:'grid', gridTemplateColumns:'200px 1fr', minHeight:'calc(100vh - 52px)'}}>
        {/* Sidebar */}
        <aside style={{background:C.g900}}>
          <nav style={{paddingTop:8}}>
            {nav.map(item => {
              const active = path === item.href
              return (
                <Link key={item.href} href={item.href} style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'10px 20px', fontSize:13,
                  color: active ? C.white : C.g300,
                  background: active ? C.g800 : 'transparent',
                  borderLeft: active ? `3px solid ${C.g500}` : '3px solid transparent',
                  textDecoration:'none', transition:'all 0.1s',
                }}>
                  <span style={{fontSize:15}}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>
        <main style={{padding:32, overflowX:'auto'}}>{children}</main>
      </div>
    </div>
  )
}
