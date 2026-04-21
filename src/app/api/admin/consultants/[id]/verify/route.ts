import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/admin-login', request.url))
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.redirect(new URL('/', request.url))

  const formData = await request.formData()
  const action   = formData.get('action') as string
  const statusMap: Record<string,string> = { verify:'verified', reject:'rejected', suspend:'suspended' }
  const newStatus = statusMap[action]
  if (!newStatus) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('consultants')
    .update({ verification_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  return NextResponse.redirect(new URL(`/admin/consultants/${params.id}`, request.url))
}
