import { getAuthContext, getAdminClient, isOrgActive } from '@/lib/auth'
import { NextResponse } from 'next/server'

const KATEGORI_LIMITS: Record<string, { min: number; max: number }> = {
  'PERORANGAN': { min: 1, max: 1 },
  'BERPASANGAN': { min: 2, max: 2 },
  'BERKELOMPOK': { min: 3, max: 5 },
  'MASSAL': { min: 10, max: 25 },
  'ATT': { min: 6, max: 6 },
}
const GOLONGAN = ['Usia Dini', 'Pra Remaja', 'Remaja', 'Dewasa', 'Pembina', 'Istimewa', 'Campuran']
const GOL_KODE: Record<string, string> = {
  'Usia Dini': 'UDN', 'Pra Remaja': 'PRM', 'Remaja': 'RMJ',
  'Dewasa': 'DWS', 'Pembina': 'PBN', 'Istimewa': 'IST', 'Campuran': 'CMP'
}
const KAT_KODE: Record<string, string> = {
  'PERORANGAN': 'PER', 'BERPASANGAN': 'BPS', 'BERKELOMPOK': 'BKL', 'MASSAL': 'MSL', 'ATT': 'ATT'
}

type BulkRow = { kategori: string; golongan: string; kontingen: string; anggota: string }
type FailedRow = { row: number; data: BulkRow; reason: string }
type ValidRow = BulkRow & { rowIndex: number; kontingen_id: string; kontingen_kode: string; anggotaList: string[] }

// POST /api/events/:id/peserta/bulk — import peserta dari Excel (admin only)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { id: eventId } = await params
  const body = await request.json()
  const peserta: BulkRow[] = body.peserta

  if (!Array.isArray(peserta) || peserta.length === 0) {
    return NextResponse.json({ error: 'Data peserta kosong.' }, { status: 400 })
  }

  const db = getAdminClient()

  const { data: event } = await db.from('events').select('prefix').eq('id', eventId).single()
  if (!event) return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 })

  // Load existing kontingen for this event (case-insensitive lookup by nama)
  const { data: existingKontingen } = await db.from('kontingen').select('id, nama, kode').eq('event_id', eventId)
  const kontingenMap = new Map<string, { id: string; kode: string }>()
  ;(existingKontingen || []).forEach(k => kontingenMap.set(k.nama.trim().toLowerCase(), { id: k.id, kode: k.kode }))
  const existingKode = new Set((existingKontingen || []).map(k => k.kode))

  const success: { no_urut: string }[] = []
  const failed: FailedRow[] = []
  const validRows: ValidRow[] = []

  // 1. Validate rows + resolve/auto-create kontingen
  for (let i = 0; i < peserta.length; i++) {
    const row = peserta[i]
    const kategori = (row.kategori || '').trim().toUpperCase()
    const golongan = (row.golongan || '').trim()
    const kontingenNama = (row.kontingen || '').trim()
    const anggotaList = (row.anggota || '').split(',').map(a => a.trim()).filter(Boolean)

    if (!KATEGORI_LIMITS[kategori]) {
      failed.push({ row: i + 1, data: row, reason: `Kategori "${row.kategori}" tidak valid.` }); continue
    }
    if (!GOLONGAN.includes(golongan)) {
      failed.push({ row: i + 1, data: row, reason: `Golongan "${row.golongan}" tidak valid.` }); continue
    }
    if (!kontingenNama) {
      failed.push({ row: i + 1, data: row, reason: 'Kontingen wajib diisi.' }); continue
    }
    const limit = KATEGORI_LIMITS[kategori]
    if (anggotaList.length < limit.min || anggotaList.length > limit.max) {
      failed.push({ row: i + 1, data: row, reason: `Jumlah anggota untuk ${kategori} harus ${limit.min}-${limit.max} orang (saat ini ${anggotaList.length}).` }); continue
    }

    const key = kontingenNama.toLowerCase()
    let kont = kontingenMap.get(key)
    if (!kont) {
      const baseKode = kontingenNama.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'KONT'
      let kode = baseKode
      let suffix = 1
      while (existingKode.has(kode)) {
        kode = `${baseKode}${suffix}`
        suffix++
      }
      const { data: newKont, error: kontErr } = await db
        .from('kontingen')
        .insert({ event_id: eventId, nama: kontingenNama, kode })
        .select('id, kode')
        .single()
      if (kontErr || !newKont) {
        failed.push({ row: i + 1, data: row, reason: `Gagal membuat kontingen baru: ${kontErr?.message || 'unknown error'}` }); continue
      }
      kont = { id: newKont.id, kode: newKont.kode }
      kontingenMap.set(key, kont)
      existingKode.add(kont.kode)
    }

    validRows.push({ ...row, rowIndex: i, kontingen_id: kont.id, kontingen_kode: kont.kode, anggotaList })
  }

  // 2. Group valid rows by (kontingen_kode, golongan, kategori) to generate no_urut sequentially
  const groups = new Map<string, ValidRow[]>()
  for (const row of validRows) {
    const kategori = row.kategori.trim().toUpperCase()
    const golongan = row.golongan.trim()
    const groupKey = `${row.kontingen_kode}|${golongan}|${kategori}`
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey)!.push(row)
  }

  for (const [groupKey, rows] of groups) {
    const [kk, golongan, kategori] = groupKey.split('|')
    const kg = GOL_KODE[golongan] || golongan.slice(0, 3).toUpperCase()
    const kt = KAT_KODE[kategori] || kategori.slice(0, 3).toUpperCase()
    const noPrefix = `${event.prefix}-${kk}-${kg}-${kt}-`

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

    for (const row of rows) {
      const noUrut = `${noPrefix}${String(seq).padStart(3, '0')}`
      seq++

      const { error: insertErr } = await db.from('peserta').insert({
        event_id: eventId,
        no_urut: noUrut,
        kategori: row.kategori.trim().toUpperCase(),
        golongan: row.golongan.trim(),
        kontingen_id: row.kontingen_id,
        anggota: row.anggotaList,
      })

      if (insertErr) {
        failed.push({ row: row.rowIndex + 1, data: row, reason: `Gagal insert: ${insertErr.message}` })
      } else {
        success.push({ no_urut: noUrut })
      }
    }
  }

  return NextResponse.json({ success, failed })
}
