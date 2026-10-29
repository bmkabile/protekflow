// src/app/api/files/[id]/download/route.ts
// Authenticated download of the signed PDF. The storage bucket is private; this issues a
// short-lived signed link only to the file's contractor, its consultant, or an admin.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', _req.url))

  const admin: any = createAdminClient()
  const [{ data: file }, { data: profile }] = await Promise.all([
    admin.from('she_files')
      .select('id, file_number, contractor_id, consultant_id, signed_pdf_path, docuseal_document_url, status')
      .eq('id', params.id).single(),
    admin.from('profiles').select('role').eq('id', user.id).single(),
  ])
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed =
    profile?.role === 'admin' ||
    file.contractor_id === user.id ||
    file.consultant_id === user.id
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (file.signed_pdf_path) {
    const { data, error } = await admin.storage
      .from('signed-files')
      .createSignedUrl(file.signed_pdf_path, 300, { download: `${file.file_number}-signed.pdf` })
    if (error || !data?.signedUrl) return NextResponse.json({ error: 'Could not prepare download' }, { status: 500 })
    return NextResponse.redirect(data.signedUrl)
  }

  // Older files signed through DocuSeal keep their DocuSeal link
  if (file.docuseal_document_url && /^https:\/\//.test(file.docuseal_document_url))
    return NextResponse.redirect(file.docuseal_document_url)

  return NextResponse.json({ error: 'No signed document yet' }, { status: 404 })
}
