import { getAuthContext, getAdminClient } from '@/lib/auth'
import { triggerGelanggangUpdate } from '@/lib/pusher/server'
import { NextResponse } from 'next/server'

// PATCH /api/events/:id/gelanggang/:gid — update gelanggang (set aktif, antrian, nama)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; gid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: eventId, gid } = await params
  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.nama !== undefined) updates.nama = body.nama.trim()
  if (body.peserta_aktif_id !== undefined) updates.peserta_aktif_id = body.peserta_aktif_id || null
  if (body.antrian !== undefined) updates.antrian = body.antrian

  const db = getAdminClient()
  const { data, error } = await db
    .from('gelanggang')
    .update(updates)
    .eq('id', gid)
    .select('*, peserta_aktif:peserta_aktif_id(id, no_urut, kategori, golongan, anggota, kontingen(nama, kode))')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger Pusher realtime update when peserta_aktif changes
  if (body.peserta_aktif_id !== undefined) {
    triggerGelanggangUpdate(eventId, {
      gelanggang_id: gid,
      gelanggang_nama: data.nama,
      peserta_aktif: data.peserta_aktif,
    }).catch(() => {}) // fire & forget
  }

  return NextResponse.json({ data })
}

// DELETE /api/events/:id/gelanggang/:gid
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; gid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gid } = await params
  const db = getAdminClient()
  const { error } = await db.from('gelanggang').delete().eq('id', gid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
