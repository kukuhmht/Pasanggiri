import { getAuthContext, getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type } = await request.json()
  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  const db = getAdminClient()
  await db.from('analytics_events').insert({
    org_id: ctx.orgId,
    user_id: ctx.user.id,
    event_type: type,
    event_context: 'expired_account_banner',
  })

  return NextResponse.json({ success: true })
}
