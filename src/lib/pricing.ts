// src/lib/pricing.ts
// Single source of truth for ProtekFlow pricing logic.
// All amounts are ZAR cents (avoids float bugs). Keep supabase platform_config in sync.
// NOTE: confirm whether R7,500 is VAT-inclusive for Legacy Landmark and adjust invoices accordingly.

export const PRICING = {
  FILE_PRICE:        750000,   // R7,500 per SHE file
  PLATFORM_FEE_PCT:  20,       // platform keeps 20%, signing professional receives 80%
  SLA_HOURS:         48,
} as const

/** File price in cents */
export function getFilePrice(): number {
  return PRICING.FILE_PRICE
}

/** Splits a gross file price into platform fee and professional amount */
export function splitRevenue(grossCents: number): {
  platformFee: number
  consultantAmount: number
  feePct: number
} {
  const feePct = PRICING.PLATFORM_FEE_PCT
  const platformFee = Math.round(grossCents * feePct / 100)
  return { platformFee, consultantAmount: grossCents - platformFee, feePct }
}

/** Formats ZAR cents as R7,500 */
export function formatZAR(cents: number): string {
  return 'R' + (cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/** SLA deadline from when payment is confirmed */
export function getSlaDeadline(paidAt: Date): Date {
  const deadline = new Date(paidAt)
  deadline.setHours(deadline.getHours() + PRICING.SLA_HOURS)
  return deadline
}
