// src/lib/payfast.ts
// PayFast payment integration for contractor file payments
// Docs: https://developers.payfast.co.za/docs

import crypto from 'crypto'

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

/**
 * Validates a PayFast ITN (Instant Transaction Notification) webhook.
 * Call this in /api/payments/notify BEFORE updating your database.
 *
 * Returns true if the ITN is genuine, false if it should be rejected.
 */
export async function validateITN(
  body: Record<string, string>,
  requestHeaders: Headers
): Promise<boolean> {
  // 1. Verify the IP is a PayFast IP
  const payfastIPs = [
    '197.97.145.144', '197.97.145.145', '197.97.145.146', '197.97.145.147',
    // Sandbox
    '197.97.145.148', '197.97.145.149',
  ]
  const requestIP = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (requestIP && !payfastIPs.includes(requestIP) && !IS_SANDBOX) {
    console.warn('[PayFast ITN] Rejected: IP not in whitelist:', requestIP)
    return false
  }

  // 2. Verify signature
  const { signature: receivedSig, ...dataWithoutSig } = body
  const expectedSig = generateSignature(dataWithoutSig)
  if (receivedSig !== expectedSig) {
    console.warn('[PayFast ITN] Rejected: signature mismatch')
    return false
  }

  // 3. Verify with PayFast server (pfValidate)
  const pfHost = IS_SANDBOX ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'
  const pfData = Object.entries(body)
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim())}`)
    .join('&')

  const pfResponse = await fetch(`https://${pfHost}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: pfData,
  })
  const pfValidation = await pfResponse.text()

  if (pfValidation !== 'VALID') {
    console.warn('[PayFast ITN] Rejected: PayFast validation response:', pfValidation)
    return false
  }

  return true
}
