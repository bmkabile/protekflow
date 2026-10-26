// src/app/api/payments/notify/route.ts
// PayFast Instant Transaction Notification (ITN) webhook.
// Hardened: validated source/signature, amount checked against our price,
// idempotent (repeat ITNs are harmless), and a late CANCELLED can never undo a paid file.

import { NextRequest, NextResponse } from 'next/server'
import { validateITN } from '@/lib/payfast'
import { createAdminClient } from '@/lib/supabase-server'
import { splitRevenue, getSlaDeadline } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  let body: Record<string, string>
  try {
    const formData = await request.formData()
    body = Object.fromEntries(
      Array.from(formData.entries()).map(([k, v]) => [k, String(v)])
    )
  } catch {
    return new NextResponse('Bad request', { status: 400 })
  }

  // 1. Genuine PayFast ITN?
  if (!(await validateITN(body, request.headers))) {
    console.error('[PayFast ITN] Validation failed for payment', body.m_payment_id)
    return new NextResponse('Invalid ITN', { status: 400 })
  }

  const { payment_status, m_payment_id: sheFileId, pf_payment_id, amount_gross } = body
  const supabase: any = createAdminClient()

  const { data: file } = await supabase
    .from('she_files')
    .select('id, status, price_zar, contractor_id, consultant_id')
    .eq('id', sheFileId)
    .single()

  if (!file) {
    console.error('[PayFast ITN] SHE file not found:', sheFileId)
    return new NextResponse('Not found', { status: 404 })
  }

  if (payment_status === 'COMPLETE') {
    // 2. Amount paid must match our price (cents -> rand, tolerate rounding)
    const paid = parseFloat(amount_gross)
    if (!Number.isFinite(paid) || Math.abs(paid - file.price_zar / 100) > 0.009) {
      console.error(`[PayFast ITN] Amount mismatch for ${sheFileId}: paid ${amount_gross}, expected ${file.price_zar / 100}`)
      return new NextResponse('Amount mismatch', { status: 400 })
    }

    // 3. Atomic claim: only a file still awaiting payment can become paid.
    //    A repeat ITN finds no row to update and exits cleanly.
    const now = new Date()
    const { data: claimed } = await supabase
      .from('she_files')
      .update({
        status: 'paid',
        paid_at: now.toISOString(),
        payfast_payment_id: pf_payment_id,
        sla_deadline: getSlaDeadline(now).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', sheFileId)
      .eq('status', 'payment_pending')
      .select('id')

    if (!claimed || claimed.length === 0) {
      console.log(`[PayFast ITN] ${sheFileId} already processed (status ${file.status}); ignoring repeat`)
      return new NextResponse('OK', { status: 200 })
    }

    // 4. Record the transaction (unique on payfast_payment_id and she_file_id)
    const { platformFee, consultantAmount, feePct } = splitRevenue(file.price_zar)
    const { error: txError } = await supabase.from('transactions').insert({
      she_file_id:         sheFileId,
      contractor_id:       file.contractor_id,
      consultant_id:       file.consultant_id,
      gross_amount:        file.price_zar,
      platform_fee_pct:    feePct,
      platform_fee_amount: platformFee,
      consultant_amount:   consultantAmount,
      payfast_payment_id:  pf_payment_id,
    })
    if (txError && txError.code !== '23505') {
      // File is marked paid; the ledger row is missing. Surface loudly so it gets reconciled.
      console.error('[PayFast ITN] LEDGER INSERT FAILED for paid file', sheFileId, txError)
    }

    console.log(`[PayFast ITN] Payment complete for ${sheFileId}, R${file.price_zar / 100}`)
  } else if (payment_status === 'CANCELLED') {
    // Only an unpaid file can be cancelled
    await supabase.from('she_files').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', sheFileId).eq('status', 'payment_pending')
  }

  // PayFast expects 200 OK; anything else triggers a retry
  return new NextResponse('OK', { status: 200 })
}
