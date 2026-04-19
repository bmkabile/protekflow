// Refined ProtekFlow logo — SVG shield mark
import Link from 'next/link'

interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  href?: string
}

export function Logo({ variant = 'light', size = 'md', href = '/' }: LogoProps) {
  const dim = size === 'sm' ? 28 : size === 'lg' ? 40 : 34
  const fs  = size === 'sm' ? 16 : size === 'lg' ? 22 : 18
  const nameColor = variant === 'light' ? '#ffffff' : '#14532d'

  const mark = (
    <div style={{display:'flex', alignItems:'center', gap: size === 'sm' ? 8 : 10}}>
      {/* SVG shield mark */}
      <svg width={dim} height={dim} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="34" height="34" rx="8" fill="#22c55e"/>
        {/* Shield path */}
        <path d="M17 6L8 10v7c0 4.97 3.84 9.63 9 10.75C22.16 26.63 26 21.97 26 17v-7L17 6z"
              fill="#14532d" opacity="0.15"/>
        <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z"
              fill="none" stroke="#14532d" strokeWidth="1.5" strokeLinejoin="round"/>
        {/* Tick inside shield */}
        <path d="M13.5 17l2.5 2.5 5-5" stroke="#14532d" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{fontFamily:"'Fraunces',Georgia,serif", fontWeight:600, color:nameColor, fontSize:fs, letterSpacing:'-0.3px'}}>
        ProtekFlow
      </span>
    </div>
  )

  return href ? <Link href={href} style={{textDecoration:'none'}}>{mark}</Link> : mark
}

// Compact icon-only mark for sidebar / favicon
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="34" height="34" rx="8" fill="#22c55e"/>
      <path d="M17 7.5L9 11v6c0 4.42 3.41 8.57 8 9.57 4.59-1 8-5.15 8-9.57v-6L17 7.5z"
            fill="none" stroke="#14532d" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M13.5 17l2.5 2.5 5-5" stroke="#14532d" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
