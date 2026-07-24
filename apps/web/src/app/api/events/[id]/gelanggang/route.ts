import { getAuthContext, getAdminClient, isOrgActive } from '@/lib/auth'
import { triggerGelanggangUpdate } from '@/lib/pusher/server'
import { NextResponse } from 'next/server'

// GET /api/events/:id/gelanggang
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { id: eventId } = await params
  const db = getAdminClient()

  const { data, error } = await db
    .from('gelanggang')
    .select('*, peserta_aktif:peserta_aktif_id(id, no_urut, kategori, golongan, anggota, kontingen(nama, kode))')
    .eq('event_id', eventId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/events/:id/gelanggang — create gelanggang
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { id: eventId } = await params
  const { nama } = await request.json()

  if (!nama?.trim()) return NextResponse.json({ error: 'Nama gelanggang wajib diisi.' }, { status: 400 })

  const db = getAdminClient()
  const { data, error } = await db
    .from('gelanggang')
    .insert({ event_id: eventId, nama: nama.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await triggerGelanggangUpdate(eventId, {
    gelanggang_id: data.id,
    gelanggang_nama: data.nama,
    peserta_aktif: null,
    antrian: [],
  })

  return NextResponse.json({ data }, { status: 201 })
}
