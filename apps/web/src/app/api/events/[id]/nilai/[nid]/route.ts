import { getAuthContext, getAdminClient } from '@/lib/auth'
import { computeTotal } from '@pasanggiri/scoring'
import { NextResponse } from 'next/server'

// PATCH /api/events/:id/nilai/:nid — edit nilai
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; nid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nid } = await params
  const body = await request.json()
  const { nilai, waktu_detik, keluar_gelanggang, kategori } = body

  // Recompute total server-side
  const score = computeTotal({
    kategori: kategori || '',
    nilai: nilai || {},
    waktuDetik: waktu_detik || 0,
    keluarGelanggang: keluar_gelanggang || 0,
  })

  const db = getAdminClient()
  const { data, error } = await db
    .from('penilaian')
    .update({
      nilai: nilai || {},
      waktu_detik: waktu_detik || 0,
      keluar_gelanggang: keluar_gelanggang || 0,
      total: score.total,
    })
    .eq('id', nid)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/events/:id/nilai/:nid
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; nid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nid } = await params
  const db = getAdminClient()
  const { error } = await db.from('penilaian').delete().eq('id', nid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
