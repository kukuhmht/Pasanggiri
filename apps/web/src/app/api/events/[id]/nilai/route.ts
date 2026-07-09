import { getAdminClient } from '@/lib/auth'
import { computeTotal, nilaiAkhir } from '@pasanggiri/scoring'
import { triggerNilaiUpdate } from '@/lib/pusher/server'
import { NextResponse } from 'next/server'

// GET /api/events/:id/nilai — get all nilai for event (with peserta info)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const db = getAdminClient()

  const { data, error } = await db
    .from('penilaian')
    .select('*, peserta(id, no_urut, kategori, golongan, anggota, kontingen(nama))')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/events/:id/nilai — add penilaian (server-side scoring)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const body = await request.json()
  const { peserta_id, posisi_juri, nama_juri, nilai, waktu_detik, keluar_gelanggang, kategori } = body

  if (!peserta_id || !posisi_juri || !nama_juri?.trim()) {
    return NextResponse.json({ error: 'Peserta, posisi juri, dan nama juri wajib diisi.' }, { status: 400 })
  }

  // Server-side scoring — compute total with penalties
  const score = computeTotal({
    kategori: kategori || '',
    nilai: nilai || {},
    waktuDetik: waktu_detik || 0,
    keluarGelanggang: keluar_gelanggang || 0,
  })

  const db = getAdminClient()

  // Check duplicate (same juri + same peserta)
  const { data: existing } = await db
    .from('penilaian')
    .select('id')
    .eq('event_id', eventId)
    .eq('peserta_id', peserta_id)
    .eq('posisi_juri', posisi_juri)
    .single()

  if (existing) {
    return NextResponse.json({ error: `${posisi_juri} sudah menilai peserta ini.` }, { status: 409 })
  }

  const { data, error } = await db
    .from('penilaian')
    .insert({
      event_id: eventId,
      peserta_id,
      posisi_juri,
      nama_juri: nama_juri.trim(),
      nilai: nilai || {},
      waktu_detik: waktu_detik || 0,
      keluar_gelanggang: keluar_gelanggang || 0,
      total: score.total,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Juri ini sudah menilai peserta tersebut.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Trigger Pusher realtime update for rekap
  const { data: allScores } = await db.from('penilaian').select('total').eq('peserta_id', peserta_id)
  const nilai_akhir = nilaiAkhir((allScores || []).map(s => Number(s.total)))
  
  try {
    await triggerNilaiUpdate(eventId, { 
      action: 'add', 
      peserta_id, 
      penilaian: { peserta_id: data.peserta_id, posisi_juri: data.posisi_juri, total: data.total },
      nilai_akhir: nilai_akhir.nilaiAkhir 
    })
  } catch {}  // Pusher failure should not block response to Jurii

  return NextResponse.json({ data, score }, { status: 201 })
}
