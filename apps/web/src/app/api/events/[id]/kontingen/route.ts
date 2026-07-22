import { getAuthContext, getAdminClient, isOrgActive } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/events/:id/kontingen — public (used by self-registration page too)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const db = getAdminClient()

  const { data, error } = await db
    .from('kontingen')
    .select('*')
    .eq('event_id', eventId)
    .order('kode')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/events/:id/kontingen
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { id: eventId } = await params
  const body = await request.json()
  const { nama, kode } = body

  if (!nama?.trim() || !kode?.trim()) {
    return NextResponse.json({ error: 'Nama dan kode wajib diisi.' }, { status: 400 })
  }

  const db = getAdminClient()
  const { data, error } = await db
    .from('kontingen')
    .insert({ event_id: eventId, nama: nama.trim(), kode: kode.trim().toUpperCase() })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Kode kontingen sudah ada.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
