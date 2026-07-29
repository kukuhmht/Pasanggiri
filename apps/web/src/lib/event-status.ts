import { SupabaseClient } from '@supabase/supabase-js'

export async function getEventStatus(db: SupabaseClient, eventId: string): Promise<string> {
  const [gelanggangRes, penilaianRes] = await Promise.all([
    db.from('gelanggang').select('peserta_aktif_id, antrian').eq('event_id', eventId),
    db.from('penilaian').select('id').eq('event_id', eventId).limit(1),
  ])

  if (gelanggangRes.error) throw gelanggangRes.error
  if (penilaianRes.error) throw penilaianRes.error

  const gelanggangs = gelanggangRes.data || []
  const hasGelanggang = gelanggangs.length > 0
  const hasPesertaAktif = gelanggangs.some(g => Boolean(g.peserta_aktif_id))
  const hasAntrian = gelanggangs.some(g => (g.antrian || []).length > 0)
  const hasPenilaian = (penilaianRes.data || []).length > 0

  if (hasPesertaAktif) return 'Sedang Berlangsung'
  if (hasGelanggang && hasAntrian) return 'Akan Dilaksanakan'
  if (hasGelanggang && hasPenilaian) return 'Sudah Selesai'
  return 'Belum Dilaksanakan'
}
