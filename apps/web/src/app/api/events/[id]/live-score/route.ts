import { getAdminClient } from '@/lib/auth'
import { nilaiAkhir } from '@pasanggiri/scoring'
import { NextResponse } from 'next/server'

// GET /api/events/:id/live-score
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const db = getAdminClient()

  // 1. Fetch all gelanggang for event with peserta_aktif joined
  const { data: gelanggangList, error: gelError } = await db
    .from('gelanggang')
    .select('*, peserta_aktif:peserta_aktif_id(id, no_urut, anggota, kategori, golongan, kontingen(nama, kode))')
    .eq('event_id', eventId)
    .order('nama') // Order by nama for consistent display

  if (gelError) return NextResponse.json({ error: gelError.message }, { status: 500 })
  if (!gelanggangList || gelanggangList.length === 0) return NextResponse.json({ data: [] })

  // 2. Fetch all penilaian for event, group by peserta_id
  // This is used for both peserta_aktif and antrian members if they were ever scored
  const { data: nilaiData, error: nilaiError } = await db
    .from('penilaian')
    .select('peserta_id, total')
    .eq('event_id', eventId)

  if (nilaiError) return NextResponse.json({ error: nilaiError.message }, { status: 500 })

  const nilaiMap: Record<string, number[]> = {}
  nilaiData?.forEach(n => {
    if (!nilaiMap[n.peserta_id]) nilaiMap[n.peserta_id] = []
    nilaiMap[n.peserta_id].push(Number(n.total))
  })

  // 3. Fetch peserta data for ALL antrian members (not just first 5)
  // Collect all unique peserta_id from all gelanggang's antrian arrays
  const allAntrianPesertaIds = [...new Set(gelanggangList.flatMap(g => g.antrian || []))]
  const { data: antrianPesertaData, error: antrianPesertaError } = await db
    .from('peserta')
    .select('id, no_urut, anggota, kategori, golongan, kontingen(nama, kode)')
    .in('id', allAntrianPesertaIds)

  if (antrianPesertaError) return NextResponse.json({ error: antrianPesertaError.message }, { status: 500 })
  const antrianPesertaMap = new Map(antrianPesertaData?.map(p => [p.id, p]))

  // 4. Build final response
  const result = gelanggangList.map(gel => {
    let enrichedPesertaAktif = null
    if (gel.peserta_aktif) {
      const scores = nilaiMap[gel.peserta_aktif.id] || []
      const nilaiAkhirResult = nilaiAkhir(scores)
      enrichedPesertaAktif = {
        ...gel.peserta_aktif,
        nilai_akhir: nilaiAkhirResult.nilaiAkhir,
        jumlah_juri: scores.length
      }
    }

    const enrichedAntrian = (gel.antrian || [])
      .map((pid: string) => antrianPesertaMap.get(pid))
      .filter(Boolean) // Remove any undefined/null if peserta not found

    return {
      id: gel.id,
      nama: gel.nama,
      peserta_aktif: enrichedPesertaAktif,
      antrian: enrichedAntrian,
      total_antrian: (gel.antrian || []).length
    }
  })

  return NextResponse.json({ data: result })
}
