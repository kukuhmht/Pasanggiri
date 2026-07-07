import { getAdminClient } from '@/lib/auth'
import { nilaiAkhir } from '@pasanggiri/scoring'
import { NextResponse } from 'next/server'

// GET /api/events/:id/rekap — calculated rekap per peserta
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const db = getAdminClient()

  // Get all penilaian for event
  const { data: nilaiData, error } = await db
    .from('penilaian')
    .select('peserta_id, posisi_juri, nama_juri, total, nilai, waktu_detik')
    .eq('event_id', eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get all peserta
  const { data: pesertaData } = await db
    .from('peserta')
    .select('id, no_urut, kategori, golongan, anggota, kontingen(nama, kode)')
    .eq('event_id', eventId)

  if (!pesertaData) return NextResponse.json({ data: [] })

  // Group nilai by peserta
  const nilaiMap: Record<string, typeof nilaiData> = {}
  nilaiData?.forEach(n => {
    (nilaiMap[n.peserta_id] = nilaiMap[n.peserta_id] || []).push(n)
  })

  // Calculate rekap
  const rekap = pesertaData.map(p => {
    const scores = nilaiMap[p.id] || []
    const totals = scores.map(s => Number(s.total) || 0)
    const result = nilaiAkhir(totals)

    // Map J1-J5
    const juriMap: Record<string, number> = {}
    scores.forEach(s => {
      const num = s.posisi_juri.match(/\d+/)?.[0]
      if (num) juriMap[`j${num}`] = Number(s.total) || 0
    })

    // Orisinalitas trimmed (same logic)
    const orisScores = scores.map(s => {
      const vals = s.nilai as Record<string, number>
      return vals?.orisinalitas || 0
    })
    const orisResult = nilaiAkhir(orisScores)

    return {
      peserta_id: p.id,
      no_urut: p.no_urut,
      kategori: p.kategori,
      golongan: p.golongan,
      anggota: p.anggota,
      kontingen: p.kontingen,
      jumlah_juri: scores.length,
      waktu: scores[0]?.waktu_detik || null,
      ...juriMap,
      tertinggi: result.tertinggi,
      terendah: result.terendah,
      orisinalitas: orisResult.nilaiAkhir,
      nilai_akhir: result.nilaiAkhir,
    }
  }).filter(r => r.jumlah_juri > 0)
    .sort((a, b) => b.nilai_akhir - a.nilai_akhir)

  return NextResponse.json({ data: rekap })
}
