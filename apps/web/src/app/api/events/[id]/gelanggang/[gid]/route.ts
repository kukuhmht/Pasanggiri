import { getAuthContext, getAdminClient, isOrgActive } from '@/lib/auth'
import { triggerGelanggangUpdate, triggerWaktuTampilUpdate } from '@/lib/pusher/server'
import { NextResponse } from 'next/server'

// PATCH /api/events/:id/gelanggang/:gid
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; gid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { id: eventId, gid } = await params
  const body = await request.json()

  const { waktu_detik, ...updates } = body as { waktu_detik?: number }

  const db = getAdminClient()

  // If there are updates to gelanggang fields (peserta_aktif_id or antrian), apply them
  if (Object.keys(updates).length > 0) {
    const { data: gelanggang, error } = await db
      .from('gelanggang')
      .update(updates)
      .eq('id', gid)
      .select('*, peserta_aktif:peserta_aktif_id(id, no_urut, kategori, golongan, anggota, kontingen(nama, kode))')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await triggerGelanggangUpdate(eventId, {
      gelanggang_id: gelanggang.id,
      gelanggang_nama: gelanggang.nama,
      peserta_aktif: gelanggang.peserta_aktif,
      antrian: gelanggang.antrian || [],
    })
  }

  // If waktu_detik is provided, forward it to Juri via Pusher (no DB column)
  if (typeof waktu_detik === 'number') {
    // Get current aktif peserta ID (may have been updated above)
    const { data: gel } = await db.from('gelanggang').select('peserta_aktif_id').eq('id', gid).single()
    if (gel?.peserta_aktif_id) {
      await triggerWaktuTampilUpdate(eventId, {
        gelanggang_id: gid,
        peserta_id: gel.peserta_aktif_id,
        waktu_detik,
      })
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/events/:id/gelanggang/:gid
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; gid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })
  const { id: eventId, gid } = await params
  const db = getAdminClient()
  const { error } = await db.from('gelanggang').delete().eq('id', gid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await triggerGelanggangUpdate(eventId, {
    gelanggang_id: gid,
    deleted: true,
  })

  return NextResponse.json({ success: true }, { status: 200 })
}
