// src/lib/docuseal.ts
// DocuSeal e-signature integration for SHE file signing
// Docs: https://www.docuseal.co/docs/api

const DOCUSEAL_URL = process.env.DOCUSEAL_URL || 'https://api.docuseal.co'
const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY!
const SHE_TEMPLATE_ID = process.env.DOCUSEAL_SHE_TEMPLATE_ID!

interface DocuSealSubmitter {
  email: string
  name: string
  role: string       // must match role name in DocuSeal template
  values?: Record<string, string>  // pre-fill template fields
}

interface CreateSubmissionParams {
  templateId?: string
  submitters: DocuSealSubmitter[]
  sendEmail?: boolean
  completionRedirectUrl?: string
  // Pre-filled field values mapped to DocuSeal field names
  prefill?: Record<string, string>
}

interface DocuSealSubmission {
  id: number
  status: string
  url: string          // signing URL to embed or redirect to
  documents: Array<{ id: number; url: string }>
}

/** Headers used on every DocuSeal request */
function docusealHeaders() {
  return {
    'X-Auth-Token': DOCUSEAL_API_KEY,
    'Content-Type': 'application/json',
  }
}

/**
 * Creates a DocuSeal submission for a SHE file.
 * Call this when the consultant clicks "Review & Sign" — after the
 * SHE file draft has been generated and is ready for professional sign-off.
 *
 * @returns submission ID and the signing URL for the consultant
 */
export async function createSheFileSubmission(params: {
  sheFileId: string
  fileNumber: string
  projectName: string
  projectAddress: string
  consultantEmail: string
  consultantName: string
  contractorEmail: string
  contractorName: string
  completionRedirectUrl: string   // where the signer's browser lands after signing (NOT a webhook)
}): Promise<DocuSealSubmission> {
  const body = {
    template_id: SHE_TEMPLATE_ID,
    send_email: true,
    // Browser redirect after signing. The completion webhook is configured in DocuSeal settings.
    completed_redirect_url: params.completionRedirectUrl,
    submitters: [
      {
        email: params.consultantEmail,
        name: params.consultantName,
        role: 'Consultant',          // must match role in your DocuSeal template
        values: {
          'file_number':     params.fileNumber,
          'project_name':    params.projectName,
          'project_address': params.projectAddress,
          'consultant_name': params.consultantName,
          'signing_date':    new Date().toLocaleDateString('en-ZA'),
        },
        metadata: { she_file_id: params.sheFileId }
      },
      {
        email: params.contractorEmail,
        name: params.contractorName,
        role: 'Contractor',         // receives a copy; may not need to sign
        send_email: true,
      }
    ]
  }

  const res = await fetch(`${DOCUSEAL_URL}/submissions`, {
    method: 'POST',
    headers: docusealHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DocuSeal submission creation failed: ${err}`)
  }

  return res.json()
}

/**
 * Gets the current status and document URLs for a submission.
 * Poll this or use the webhook (preferred).
 */
export async function getSubmission(submissionId: string): Promise<DocuSealSubmission> {
  const res = await fetch(`${DOCUSEAL_URL}/submissions/${submissionId}`, {
    headers: docusealHeaders(),
  })
  if (!res.ok) throw new Error(`DocuSeal getSubmission failed: ${res.status}`)
  return res.json()
}

/**
 * Gets the signed document download URL.
 * Call this after status === 'completed'.
 */
export async function getSignedDocumentUrl(submissionId: string): Promise<string | null> {
  const submission = await getSubmission(submissionId)
  if (submission.status !== 'completed') return null
  return submission.documents?.[0]?.url ?? null
}

/**
 * Webhook handler — call this from /api/docuseal/webhook
 * DocuSeal POSTs here when signing is complete.
 *
 * Body shape (DocuSeal webhook):
 * { event_type: 'form.completed', data: { id, status, documents: [...] } }
 */
export function parseDocuSealWebhook(body: Record<string, unknown>): {
  submissionId: string
  isComplete: boolean
  documentUrl: string | null
} {
  const data = body.data as DocuSealSubmission
  return {
    submissionId: String(data.id),
    isComplete: data.status === 'completed',
    documentUrl: data.documents?.[0]?.url ?? null,
  }
}
