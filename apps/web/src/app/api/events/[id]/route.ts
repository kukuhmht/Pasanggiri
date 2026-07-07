import { getAuthContext, getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/events/:id — update event
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { nama, subjudul, tahun, prefix, is_public } = body

  const updates: Record<string, unknown> = {}
  if (nama !== undefined) updates.nama = nama.trim()
  if (subjudul !== undefined) updates.subjudul = subjudul.trim()
  if (tahun !== undefined) updates.tahun = parseInt(tahun)
  if (prefix !== undefined) updates.prefix = prefix.trim().toUpperCase()
  if (is_public !== undefined) updates.is_public = is_public

  const db = getAdminClient()
  const { data, error } = await db
    .from('events')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 })

  return NextResponse.json({ data })
}

// DELETE /api/events/:id — delete event
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getAdminClient()
  const { error } = await db
    .from('events')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
