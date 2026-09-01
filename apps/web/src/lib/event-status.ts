import { SupabaseClient } from '@supabase/supabase-js'
import { isOrgExpired } from '@/lib/org-status'

// Single source of truth for public event status derivation. Pure function:
// maps a set of boolean facts to a status string. The org-expiry downgrade is
// applied ONLY on the "Sedang Berlangsung" branch and never changes any other
// derived status.
export function deriveEventStatus(input: {
  hasGelanggang: boolean
  hasPesertaAktif: boolean
  hasAntrian: boolean
  hasPenilaian: boolean
  orgExpired: boolean
}): string {
  const { hasGelanggang, hasPesertaAktif, hasAntrian, hasPenilaian, orgExpired } = input

  if (hasPesertaAktif) return orgExpired ? 'Sudah Selesai' : 'Sedang Berlangsung'
  if (hasGelanggang && hasAntrian) return 'Akan Dilaksanakan'
  if (hasGelanggang && hasPenilaian) return 'Sudah Selesai'
  return 'Belum Dilaksanakan'
}

export async function getEventStatus(db: SupabaseClient, eventId: string): Promise<string> {
  const [gelanggangRes, penilaianRes, eventRes] = await Promise.all([
    db.from('gelanggang').select('peserta_aktif_id, antrian').eq('event_id', eventId),
    db.from('penilaian').select('id').eq('event_id', eventId).limit(1),
    db.from('events').select('org_id, organizations(status, berlaku_hingga)').eq('id', eventId).single(),
  ])

  if (gelanggangRes.error) throw gelanggangRes.error
  if (penilaianRes.error) throw penilaianRes.error
  if (eventRes.error) throw eventRes.error

  const gelanggangs = gelanggangRes.data || []
  const hasGelanggang = gelanggangs.length > 0
  const hasPesertaAktif = gelanggangs.some(g => Boolean(g.peserta_aktif_id))
  const hasAntrian = gelanggangs.some(g => (g.antrian || []).length > 0)
  const hasPenilaian = (penilaianRes.data || []).length > 0

  const orgExpired = isOrgExpired(eventRes.data?.organizations as any)

  return deriveEventStatus({ hasGelanggang, hasPesertaAktif, hasAntrian, hasPenilaian, orgExpired })
}
