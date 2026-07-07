import { createServerSupabase } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify super admin
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim())
  if (!superAdminEmails.includes(user.email || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orgId, status, berlaku_hingga } = await request.json()

  const updates: Record<string, unknown> = {}

  if (status !== undefined) {
    const validStatuses = ['trial', 'active', 'suspended', 'expired']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 })
    }
    updates.status = status
  }

  if (berlaku_hingga !== undefined) {
    updates.berlaku_hingga = berlaku_hingga || null
  }

  // Use admin client to bypass RLS
  const db = getAdminClient()
  const { error } = await db
    .from('organizations')
    .update(updates)
    .eq('id', orgId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
