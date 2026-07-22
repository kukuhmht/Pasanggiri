import { getAuthContext, getAdminClient, isOrgActive } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/events/:id/peserta — public registration/results
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const db = getAdminClient()

  const { data, error } = await db
    .from('peserta')
    .select('*, kontingen(nama, kode)')
    .eq('event_id', eventId)
    .eq('is_deleted', false)
    .order('no_urut')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/events/:id/peserta — public self-registration + admin creation
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Check auth context for admin users, but allow public registration
  const ctx = await getAuthContext()
  if (ctx && !isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { id: eventId } = await params
  const body = await request.json()
  const { kategori, golongan, kontingen_id, anggota, actor_name, actor_phone } = body

  if (!kategori || !golongan || !kontingen_id || !anggota?.length) {
    return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 })
  }

  const db = getAdminClient()

  // Get event prefix & kontingen kode for nomor urut
  const [{ data: event }, { data: kont }] = await Promise.all([
    db.from('events').select('prefix').eq('id', eventId).single(),
    db.from('kontingen').select('kode').eq('id', kontingen_id).single(),
  ])

  if (!event || !kont) {
    return NextResponse.json({ error: 'Event atau kontingen tidak ditemukan.' }, { status: 400 })
  }

  // Kode golongan & kategori mapping
  const golKode: Record<string, string> = {
    'Usia Dini': 'UDN', 'Pra Remaja': 'PRM', 'Remaja': 'RMJ',
    'Dewasa': 'DWS', 'Pembina': 'PBN', 'Istimewa': 'IST', 'Campuran': 'CMP'
  }
  const katKode: Record<string, string> = {
    'PERORANGAN': 'PER', 'BERPASANGAN': 'BPS', 'BERKELOMPOK': 'BKL', 'MASSAL': 'MSL', 'ATT': 'ATT'
  }

  const prefix = event.prefix
  const kk = kont.kode
  const kg = golKode[golongan] || golongan.slice(0, 3).toUpperCase()
  const kt = katKode[kategori] || kategori.slice(0, 3).toUpperCase()
  const noPrefix = `${prefix}-${kk}-${kg}-${kt}-`

  // Get next sequence number
  const { data: existing } = await db
    .from('peserta')
    .select('no_urut')
    .eq('event_id', eventId)
    .like('no_urut', `${noPrefix}%`)
    .order('no_urut', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const lastNum = parseInt(existing[0].no_urut.split('-').pop() || '0')
    seq = lastNum + 1
  }

  const noUrut = `${noPrefix}${String(seq).padStart(3, '0')}`

  const { data, error } = await db
    .from('peserta')
    .insert({
      event_id: eventId,
      no_urut: noUrut,
      kategori,
      golongan,
      kontingen_id,
      anggota,
    })
    .select('*, kontingen(nama, kode)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log CREATE action if actor info provided
  if (actor_name && actor_phone && actor_phone.startsWith('62')) {
    await db.from('audit_logs').insert({
      event_id: eventId,
      entity_id: data.id,
      action: 'CREATE',
      new_data: data,
      actor_name,
      actor_phone,
    })
  }

  return NextResponse.json({ data }, { status: 201 })
}
