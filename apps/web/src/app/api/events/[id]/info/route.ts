import { getAuthContext, getAdminClient, isOrgActive } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/events/:id/info — return event + org slugs
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { id: eventId } = await params
  const db = getAdminClient()

  const { data: event } = await db
    .from('events')
    .select('slug, org_id')
    .eq('id', eventId)
    .single()

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const { data: org } = await db
    .from('organizations')
    .select('slug')
    .eq('id', event.org_id)
    .single()

  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  return NextResponse.json({ orgSlug: org.slug, eventSlug: event.slug })
}
