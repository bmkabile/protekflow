// src/lib/docuseal.ts
// DocuSeal e-signature integration
// Docs: https://www.docuseal.co/docs/api

const BASE_URL    = process.env.DOCUSEAL_URL ?? 'https://api.docuseal.co'
const API_KEY     = process.env.DOCUSEAL_API_KEY!
const TEMPLATE_ID = process.env.DOCUSEAL_SHE_TEMPLATE_ID!
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function headers() {
  return { 'X-Auth-Token': API_KEY, 'Content-Type': 'application/json' }
}

export interface DocuSealSubmission {
  id: number
  status: 'pending' | 'completed'
  url: string                            // signing URL for the consultant
  documents?: Array<{ id: number; url: string }>
  submitters?: Array<{
    id: number
    email: string
    role: string
    status: string
    embed_src: string                    // embed URL for iframe signing
  }>
}

/**
 * Creates a DocuSeal submission for a SHE file.
 * Returns the submission ID and the consultant's signing URL.
 *
 * TEMPLATE SETUP in DocuSeal:
 * 1. Upload your SHE file PDF/DOCX to DocuSeal → Templates
 * 2. Add two roles: "Consultant" (signer) and "Contractor" (CC / copy only)
 * 3. Place a signature field assigned to the "Consultant" role
 * 4. Place a date field assigned to the "Consultant" role
 * 5. Add text fields for: file_number, project_name, project_address,
 *    consultant_name, signing_date — assign all to "Consultant" role
 * 6. Copy the template ID from the URL and put it in DOCUSEAL_SHE_TEMPLATE_ID
 */
export async function createSheSubmission(params: {
  sheFileId:        string
  fileNumber:       string
  projectName:      string
  projectAddress:   string
  projectValue:     number | null
  consultantEmail:  string
  consultantName:   string
  contractorEmail:  string
  contractorName:   string
}): Promise<DocuSealSubmission> {
  if (!API_KEY || !TEMPLATE_ID) {
    throw new Error('DOCUSEAL_API_KEY or DOCUSEAL_SHE_TEMPLATE_ID not set in environment')
  }

  const body = {
    template_id: Number(TEMPLATE_ID),
    send_email:  true,
    // Webhook: DocuSeal POSTs here when all parties have signed
    completed_redirect_url: `${APP_URL}/api/docuseal/webhook`,
    submitters: [
      {
        email: params.consultantEmail,
        name:  params.consultantName,
        role:  'Consultant',
        send_email: true,
        // Pre-fill fields so the consultant doesn't have to type them
        values: {
          file_number:     params.fileNumber,
          project_name:    params.projectName,
          project_address: params.projectAddress,
          consultant_name: params.consultantName,
          project_value:   params.projectValue
            ? `R${params.projectValue.toLocaleString('en-ZA')}`
            : '',
          signing_date:    new Date().toLocaleDateString('en-ZA'),
        },
        // metadata passes through to the webhook so we can identify the file
        metadata: { she_file_id: params.sheFileId },
      },
      {
        email: params.contractorEmail,
        name:  params.contractorName,
        role:  'Contractor',
        send_email: true,        // contractor gets a copy when signing is complete
      },
    ],
  }

  const res = await fetch(`${BASE_URL}/submissions`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DocuSeal createSubmission failed (${res.status}): ${err}`)
  }

  const data = await res.json()

  // DocuSeal returns an array — first element is the submission
  const submission = Array.isArray(data) ? data[0] : data
  return submission
}

/**
 * Gets the signing URL for a specific submitter (the consultant).
 * Use this to redirect the consultant directly to sign without email.
 */
export function getConsultantSigningUrl(submission: DocuSealSubmission): string | null {
  const consultant = submission.submitters?.find(s => s.role === 'Consultant')
  return consultant?.embed_src ?? submission.url ?? null
}

/**
 * Fetches current status of a submission.
 * Poll this or rely on the webhook (preferred).
 */
export async function getSubmission(submissionId: string | number): Promise<DocuSealSubmission> {
  const res = await fetch(`${BASE_URL}/submissions/${submissionId}`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`DocuSeal getSubmission failed: ${res.status}`)
  return res.json()
}

/**
 * Returns the download URL for the completed signed document.
 * Only available when submission.status === 'completed'.
 */
export async function getSignedDocumentUrl(submissionId: string | number): Promise<string | null> {
  try {
    const submission = await getSubmission(submissionId)
    if (submission.status !== 'completed') return null
    return submission.documents?.[0]?.url ?? null
  } catch {
    return null
  }
}

/**
 * Parses a DocuSeal webhook payload.
 * DocuSeal sends POST to /api/docuseal/webhook when signing is complete.
 *
 * Webhook body shape:
 * { event_type: 'submission.completed', data: { id, status, documents: [...], submitters: [...] } }
 */
export function parseWebhook(body: Record<string, unknown>): {
  eventType:    string
  submissionId: string
  isComplete:   boolean
  documentUrl:  string | null
  sheFileId:    string | null
} {
  const eventType    = String(body.event_type ?? '')
  const data         = (body.data ?? body) as DocuSealSubmission
  const isComplete   = data.status === 'completed' || eventType === 'submission.completed'
  const documentUrl  = data.documents?.[0]?.url ?? null

  // Extract our she_file_id from the consultant submitter's metadata
  const consultantSubmitter = data.submitters?.find(s => s.role === 'Consultant')
  const metadata     = (consultantSubmitter as any)?.metadata
  const sheFileId    = metadata?.she_file_id ?? null

  return {
    eventType,
    submissionId: String(data.id),
    isComplete,
    documentUrl,
    sheFileId,
  }
}
