// src/lib/payfast.ts
// PayFast payment integration for contractor file payments
// Docs: https://developers.payfast.co.za/docs

import crypto from 'crypto'
import { promises as dns } from 'dns'

const MERCHANT_ID  = process.env.PAYFAST_MERCHANT_ID!
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY!
const PASSPHRASE   = process.env.PAYFAST_PASSPHRASE!
const IS_SANDBOX   = process.env.PAYFAST_ENV !== 'production'

const PAYFAST_URL = IS_SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

interface PayFastParams {
  sheFileId: string
  fileNumber: string
  contractorEmail: string
  contractorName: string
  amountCents: number     // ZAR cents
}

/**
 * Builds the PayFast payment data object and generates the MD5 signature.
 * The returned object can be used to POST to PayFast or render a payment form.
 */
export function buildPayFastPayment(params: PayFastParams) {
  const amountRand = (params.amountCents / 100).toFixed(2)

  const data: Record<string, string> = {
    merchant_id:       MERCHANT_ID,
    merchant_key:      MERCHANT_KEY,
    return_url:        `${APP_URL}/contractor/payment/success?file=${params.sheFileId}`,
    cancel_url:        `${APP_URL}/contractor/payment/cancelled?file=${params.sheFileId}`,
    notify_url:        `${APP_URL}/api/payments/notify`,   // ITN webhook
    name_first:        params.contractorName.split(' ')[0] ?? params.contractorName,
    name_last:         params.contractorName.split(' ').slice(1).join(' ') || '-',
    email_address:     params.contractorEmail,
    m_payment_id:      params.sheFileId,      // our internal ID
    amount:            amountRand,
    item_name:         `ProtekFlow SHE File ${params.fileNumber}`,
    item_description:  'SACPCMP-signed SHE file — OHS Act 85/1993',
    custom_str1:       params.sheFileId,
  }

  const signature = generateSignature(data)
  return { ...data, signature, payfast_url: PAYFAST_URL }
}

/** Generates the MD5 signature PayFast requires */
function generateSignature(data: Record<string, string>): string {
  // Build query string in the exact order PayFast expects
  const queryString = Object.entries(data)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&')

  const stringToSign = PASSPHRASE
    ? `${queryString}&passphrase=${encodeURIComponent(PASSPHRASE.trim()).replace(/%20/g, '+')}`
    : queryString

  return crypto.createHash('md5').update(stringToSign).digest('hex')
}

// --- ITN (Instant Transaction Notification) validation -----------------------
// Follows PayFast's four required checks: source IP, signature, (amount - done in
// the route, against our own price) and a server-to-server confirmation.

const PAYFAST_HOSTS = [
  'www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za',
]
let ipCache: { ips: Set<string>; at: number } | null = null

/** Resolves PayFast's current server IPs (cached 1h) instead of a hard-coded list that goes stale. */
async function getPayFastIPs(): Promise<Set<string>> {
  if (ipCache && Date.now() - ipCache.at < 60 * 60 * 1000) return ipCache.ips
  const lists = await Promise.all(PAYFAST_HOSTS.map(h => dns.resolve4(h).catch(() => [] as string[])))
  const ips = new Set(lists.flat())
  if (ips.size > 0) ipCache = { ips, at: Date.now() }
  return ips
}

/** PHP-style urlencode (what PayFast signs with): space -> +, and !'()*~ percent-encoded. */
function phpUrlEncode(v: string): string {
  return encodeURIComponent(v)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

/** Builds the ITN parameter string in received order, up to (not including) the signature field. */
function itnParamString(body: Record<string, string>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(body)) {
    if (k === 'signature') break
    parts.push(`${k}=${phpUrlEncode(v)}`)   // blank values are kept for ITNs
  }
  return parts.join('&')
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

/**
 * Validates a PayFast ITN webhook. Call in /api/payments/notify BEFORE touching the database.
 * Returns true only if the ITN is genuine. The caller must still check the amount against our price.
 */
export async function validateITN(
  body: Record<string, string>,
  requestHeaders: Headers
): Promise<boolean> {
  // 1. Merchant must be us
  if (body.merchant_id !== MERCHANT_ID) {
    console.warn('[PayFast ITN] Rejected: merchant_id mismatch')
    return false
  }

  // 2. Source IP must be a PayFast server (resolved from their hostnames).
  //    If DNS resolution fails entirely we log and rely on checks 3 and 4, which remain strict.
  const requestIP = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
  const pfIPs = await getPayFastIPs()
  if (pfIPs.size === 0) {
    console.error('[PayFast ITN] Could not resolve PayFast IPs; skipping IP check')
  } else if (!requestIP || !pfIPs.has(requestIP)) {
    console.warn('[PayFast ITN] Rejected: IP not a PayFast server:', requestIP)
    return false
  }

  // 3. Signature
  const paramString = itnParamString(body)
  const toSign = PASSPHRASE
    ? `${paramString}&passphrase=${phpUrlEncode(PASSPHRASE.trim())}`
    : paramString
  const expectedSig = crypto.createHash('md5').update(toSign).digest('hex')
  if (!body.signature || !timingSafeEqualStr(body.signature, expectedSig)) {
    console.warn('[PayFast ITN] Rejected: signature mismatch')
    return false
  }

  // 4. Server-to-server confirmation with PayFast
  const pfHost = IS_SANDBOX ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'
  try {
    const res = await fetch(`https://${pfHost}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: paramString,
      signal: AbortSignal.timeout(10_000),
    })
    const text = (await res.text()).trim()
    if (text !== 'VALID') {
      console.warn('[PayFast ITN] Rejected: PayFast validation response:', text)
      return false
    }
  } catch (err) {
    console.error('[PayFast ITN] Validation request failed:', err)
    return false
  }

  return true
}
