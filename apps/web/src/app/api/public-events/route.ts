import { getAdminClient } from '@/lib/auth'
import { deriveEventStatus } from '@/lib/event-status'
import { isOrgExpired } from '@/lib/org-status'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').toLowerCase()
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 10

  const db = getAdminClient()
  
  // Fetch ALL public events with org info (max 500 to prevent abuse)
  const { data, error } = await db
    .from('events')
    .select('id, nama, subjudul, tahun, slug, organizations(nama, slug, status, berlaku_hingga)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const events = data || []
  const eventIds = events.map(event => event.id)
  const [gelanggangRes, penilaianRes] = await Promise.all([
    db.from('gelanggang').select('event_id, peserta_aktif_id, antrian').in('event_id', eventIds),
    db.from('penilaian').select('event_id').in('event_id', eventIds),
  ])

  if (gelanggangRes.error) return NextResponse.json({ error: gelanggangRes.error.message }, { status: 500 })
  if (penilaianRes.error) return NextResponse.json({ error: penilaianRes.error.message }, { status: 500 })

  const gelanggangByEvent = (gelanggangRes.data || []).reduce((acc, gelanggang) => {
    if (!acc[gelanggang.event_id]) acc[gelanggang.event_id] = []
    acc[gelanggang.event_id].push(gelanggang)
    return acc
  }, {} as Record<string, { peserta_aktif_id: string | null; antrian: string[] | null }[]>)
  const eventsWithPenilaian = new Set((penilaianRes.data || []).map(penilaian => penilaian.event_id))

  const dataWithStatus = events.map(event => {
    const gelanggangs = gelanggangByEvent[event.id] || []
    const hasGelanggang = gelanggangs.length > 0
    const hasPesertaAktif = gelanggangs.some(gelanggang => Boolean(gelanggang.peserta_aktif_id))
    const hasAntrian = gelanggangs.some(gelanggang => (gelanggang.antrian || []).length > 0)
    const hasPenilaian = eventsWithPenilaian.has(event.id)

    const status = deriveEventStatus({
      hasGelanggang,
      hasPesertaAktif,
      hasAntrian,
      hasPenilaian,
      orgExpired: isOrgExpired(event.organizations as any),
    })

    return { ...event, status }
  })

  // Filter in JS on all fields including org name
  const filtered = q
    ? dataWithStatus.filter(e => 
        e.nama.toLowerCase().includes(q) ||
        e.subjudul?.toLowerCase().includes(q) ||
        (e.organizations as any)?.nama?.toLowerCase().includes(q)
      )
    : dataWithStatus;

  const total = filtered.length
  const start = (page - 1) * limit
  const paginated = filtered.slice(start, start + limit)

  return NextResponse.json({ data: paginated, total })
}