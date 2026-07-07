import { getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

// POST /api/events/:id/pin/validate — validate PIN juri (public endpoint)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const { pin } = await request.json()

  if (!pin || pin.trim().length < 4) {
    return NextResponse.json({ success: false, message: 'PIN tidak valid.' })
  }

  const pinValue = pin.trim()
  const db = getAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Find matching PIN (stored as plaintext)
  const { data: rows } = await db
    .from('akses_juri')
    .select('id, berlaku_hingga, status')
    .eq('event_id', eventId)
    .eq('pin_hash', pinValue)
    .eq('status', 'aktif')

  if (!rows || rows.length === 0) {
    return NextResponse.json({ success: false, message: 'PIN tidak valid atau sudah kadaluarsa.' })
  }

  const row = rows[0]

  // Check expiry
  if (row.berlaku_hingga && row.berlaku_hingga < today) {
    return NextResponse.json({ success: false, message: 'PIN sudah kadaluarsa.' })
  }

  // Valid — generate token & update terakhir_dipakai
  const token = randomUUID().replace(/-/g, '')
  const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await db
    .from('akses_juri')
    .update({ terakhir_dipakai: new Date().toISOString() })
    .eq('id', row.id)

  return NextResponse.json({ success: true, token, expiredAt, eventId })
}
