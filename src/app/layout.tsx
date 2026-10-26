// src/app/layout.tsx
import type { Metadata } from 'next'
import { DM_Sans, Fraunces } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ProtekFlow — SHE Files in 48 Hours',
  description:
    'Connect with SACPCMP-registered safety consultants. Fixed fee R7,500. Professionally signed SHE file in 48 hours. Compliant with OHS Act 85/1993.',
  keywords: ['SHE file', 'OHS compliance', 'SACPCMP', 'construction safety', 'South Africa'],
  openGraph: {
    title: 'ProtekFlow — SHE Files in 48 Hours',
    description: 'Fixed fee R7,500. SACPCMP-signed. 48-hour delivery.',
    url: 'https://protekflow.co.za',
    siteName: 'ProtekFlow',
    locale: 'en_ZA',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="font-sans bg-brand-50 text-brand-900 antialiased">
        {children}
      </body>
    </html>
  )
}
