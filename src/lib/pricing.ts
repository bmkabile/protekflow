// src/lib/pricing.ts
// Single source of truth for all ProtekFlow pricing logic

export const PRICING = {
  // File prices in ZAR cents (avoids float bugs)
  FILE_STANDARD:   450000,   // R4,500
  FILE_VOLUME_A:   412500,   // R4,125  (3–5 files with same consultant)
  FILE_VOLUME_B:   362500,   // R3,625  (6–11 files)
  FILE_VOLUME_C:   312500,   // R3,125  (12+ files)

  // Consultant monthly subscription
  PRO_MONTHLY:     99900,    // R999

  // Platform fee percentages
  FEE_FREE:        25,       // 25% on Free tier
  FEE_PRO:         15,       // 15% on Pro tier

  // SLA
  SLA_HOURS:       48,
} as const

export type VolumeTier = 'standard' | 'volume_a' | 'volume_b' | 'volume_c'
export type ConsultantTier = 'free' | 'pro'

/** Returns the file price in cents for a given volume tier */
export function getFilePrice(tier: VolumeTier = 'standard'): number {
  const map: Record<VolumeTier, number> = {
    standard: PRICING.FILE_STANDARD,
    volume_a: PRICING.FILE_VOLUME_A,
    volume_b: PRICING.FILE_VOLUME_B,
    volume_c: PRICING.FILE_VOLUME_C,
  }
  return map[tier]
}

/** Splits a gross file price into platform fee and consultant amount */
export function splitRevenue(
  grossCents: number,
  consultantTier: ConsultantTier
): { platformFee: number; consultantAmount: number; feePct: number } {
  const feePct = consultantTier === 'pro' ? PRICING.FEE_PRO : PRICING.FEE_FREE
  const platformFee = Math.round(grossCents * feePct / 100)
  const consultantAmount = grossCents - platformFee
  return { platformFee, consultantAmount, feePct }
}

/** Formats ZAR cents as R4,500 */
export function formatZAR(cents: number): string {
  return 'R' + (cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

/** Pro tier break-even: monthly earnings comparison */
export function proBreakEven(filesPerMonth: number) {
  const freeEarnings = (filesPerMonth * (PRICING.FILE_STANDARD - Math.round(PRICING.FILE_STANDARD * PRICING.FEE_FREE / 100)))
  const proEarnings  = (filesPerMonth * (PRICING.FILE_STANDARD - Math.round(PRICING.FILE_STANDARD * PRICING.FEE_PRO   / 100))) - PRICING.PRO_MONTHLY
  return {
    freeEarnings,
    proEarnings,
    advantage: proEarnings - freeEarnings,
    proIsBetter: proEarnings > freeEarnings,
  }
}

/** Determines SLA deadline from when payment is confirmed */
export function getSlaDeadline(paidAt: Date): Date {
  const deadline = new Date(paidAt)
  deadline.setHours(deadline.getHours() + PRICING.SLA_HOURS)
  return deadline
}
