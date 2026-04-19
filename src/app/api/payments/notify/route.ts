// src/app/api/payments/notify/route.ts
// PayFast Instant Transaction Notification (ITN) webhook
// PayFast POSTs here when a contractor payment completes or fails

import { NextRequest, NextResponse } from 'next/server'
import { validateITN } from '@/lib/payfast'
import { createAdminClient } from '@/lib/supabase-server'
import { splitRevenue } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  // 1. Validate the ITN is genuinely from PayFast
  const isValid = await validateITN(body, request.headers)
  if (!isValid) {
    console.error('[PayFast ITN] Validation failed', body)
    return new NextResponse('Invalid ITN', { status: 400 })
  }

  const { payment_status, m_payment_id: sheFileId, pf_payment_id } = body

  const supabase = createAdminClient()

  if (payment_status === 'COMPLETE') {
    // 2. Fetch the file to get price and consultant tier
    const { data: file } = await supabase
      .from('she_files')
      .select('*, consultants(tier)')
      .eq('id', sheFileId)
      .single()

    if (!file) {
      console.error('[PayFast ITN] SHE file not found:', sheFileId)
      return new NextResponse('Not found', { status: 404 })
    }

    const consultantTier = (file as any).consultants?.tier ?? 'free'
    const { platformFee, consultantAmount, feePct } = splitRevenue(
      file.price_zar,
      consultantTier
    )

    // 3. Update SHE file status → paid, set 48h SLA deadline
    const slaDeadline = new Date()
    slaDeadline.setHours(slaDeadline.getHours() + 48)

    await supabase.from('she_files').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payfast_payment_id: pf_payment_id,
      sla_deadline: slaDeadline.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', sheFileId)

    // 4. Record the transaction
    await supabase.from('transactions').insert({
      she_file_id:          sheFileId,
      contractor_id:        file.contractor_id,
      consultant_id:        file.consultant_id,
      gross_amount:         file.price_zar,
      platform_fee_pct:     feePct,
      platform_fee_amount:  platformFee,
      consultant_amount:    consultantAmount,
      payfast_payment_id:   pf_payment_id,
    })

    console.log(`[PayFast ITN] Payment complete for ${sheFileId}, R${file.price_zar / 100}`)
  } else if (payment_status === 'CANCELLED') {
    await supabase.from('she_files').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', sheFileId)
  }

  // PayFast expects a 200 OK — anything else triggers a retry
  return new NextResponse('OK', { status: 200 })
}
