// src/app/api/docuseal/webhook/route.ts
// DocuSeal has been removed from ProtekFlow.
// PDF generation and signing is handled entirely in-house via /api/files/[id]/complete
// This route is kept as a stub to avoid 404s from any lingering webhooks.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  return NextResponse.json({ received: true, note: 'DocuSeal not in use — signing handled in-house' })
}
