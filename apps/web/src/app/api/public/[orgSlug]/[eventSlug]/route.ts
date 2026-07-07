import { getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/public/:orgSlug/:eventSlug — resolve event by slugs (public)
export async function GET(_request: Request, { params }: { params: Promise<{ orgSlug: string; eventSlug: string }> }) {
  const { orgSlug, eventSlug } = await params
  const db = getAdminClient()

  // Find org by slug
  const { data: org } = await db
    .from('organizations')
    .select('id, nama, slug')
    .eq('slug', orgSlug)
    .single()

  if (!org) return NextResponse.json({ error: 'Organisasi tidak ditemukan.' }, { status: 404 })

  // Find event by slug + org
  const { data: event } = await db
    .from('events')
    .select('id, nama, subjudul, tahun, prefix, slug, is_public')
    .eq('org_id', org.id)
    .eq('slug', eventSlug)
    .single()

  if (!event) return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 })
  if (!event.is_public) return NextResponse.json({ error: 'Event ini tidak publik.' }, { status: 403 })

  return NextResponse.json({ org, event })
}
