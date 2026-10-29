'use client'
// src/components/DraftStarter.tsx
// Kicks off draft generation right after payment. PayFast confirms payment with a separate
// server-to-server call, so the first attempts may find the file still "payment pending";
// we simply retry. The call is idempotent, and the consultant's editor also triggers it.

import { useEffect, useState } from 'react'

export default function DraftStarter({ fileId }: { fileId: string }) {
  const [state, setState] = useState<'working' | 'ready' | 'later'>('working')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < 30 && !cancelled; i++) {
        try {
          const res = await fetch(`/api/files/${fileId}/draft`, { method: 'POST' })
          const data = await res.json().catch(() => ({}))
          if (data.status === 'ready') { if (!cancelled) setState('ready'); return }
          if (data.status === 'failed') { if (!cancelled) setState('later'); return }
        } catch { /* retry */ }
        await new Promise(r => setTimeout(r, 6000))
      }
      if (!cancelled) setState('later')
    })()
    return () => { cancelled = true }
  }, [fileId])

  const text = state === 'working' ? 'Preparing your SHE file draft...'
    : state === 'ready' ? 'Your draft is ready and waiting for professional review.'
    : 'Your payment is confirmed. The draft will be prepared when your professional opens the file.'
  return (
    <div style={{fontSize:13,color:'#15803d',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'10px 14px',marginBottom:20}}>
      {text}
    </div>
  )
}
