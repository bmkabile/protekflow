// src/app/api/payments/notify/route.ts
// PayFast ITN — called after contractor payment. Triggers matching.

import { NextRequest, NextResponse } from 'next/server'
import { validateITN } from '@/lib/payfast'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const isValid = await validateITN(body, request.headers)
  if (!isValid) {
    console.error('[PayFast ITN] Validation failed', body)
    return new NextResponse('Invalid ITN', { status: 400 })
  }

  const { payment_status, m_payment_id: sheFileId, pf_payment_id } = body
  const admin = createAdminClient()

  if (payment_status === 'COMPLETE') {
    const { data: file } = await admin
      .from('she_files')
      .select('price_zar, contractor_id, consultant_id')
      .eq('id', sheFileId)
      .single()

    if (!file) return new NextResponse('Not found', { status: 404 })

    const slaDeadline = new Date()
    slaDeadline.setHours(slaDeadline.getHours() + 48)

    // Mark as paid
    await admin.from('she_files').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payfast_payment_id: pf_payment_id,
      sla_deadline: slaDeadline.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', sheFileId)

    // Record transaction — fee split will be updated correctly when consultant completes the file
    await admin.from('transactions').insert({
      she_file_id:          sheFileId,
      contractor_id:        file.contractor_id,
      consultant_id:        null,
      gross_amount:         file.price_zar,
      platform_fee_pct:     0,       // updated in /complete once consultant tier is known
      platform_fee_amount:  0,
      consultant_amount:    0,
      payfast_payment_id:   pf_payment_id,
    })

    // Trigger auto-matching in the background
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    fetch(`${appUrl}/api/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheFileId }),
    }).catch(err => console.error('[ITN] Match trigger failed:', err))

    console.log(`[PayFast ITN] Payment complete: ${sheFileId}`)

  } else if (payment_status === 'CANCELLED') {
    await admin.from('she_files').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', sheFileId)
  }

  return new NextResponse('OK', { status: 200 })
}
