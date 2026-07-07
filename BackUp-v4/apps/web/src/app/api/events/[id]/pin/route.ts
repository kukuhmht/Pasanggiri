import { getAuthContext, getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

function hashPin(pin: string) {
  return createHash('sha256').update(pin.trim()).digest('hex')
}

function generatePin6(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// GET /api/events/:id/pin — list all PIN juri for this event (admin sees PIN)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: eventId } = await params
  const db = getAdminClient()

  const { data, error } = await db
    .from('akses_juri')
    .select('id, pin_hash, keterangan, status, berlaku_hingga, terakhir_dipakai, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/events/:id/pin — generate new PIN (stored as hash + plaintext in keterangan prefix)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: eventId } = await params
  const { keterangan, berlaku_hingga } = await request.json()

  const pin = generatePin6()
  const db = getAdminClient()

  // Store PIN hash for validation + plain PIN in separate approach:
  // We store the plain PIN as the pin_hash itself (base64-like reversible)
  // Actually simpler: store plain PIN directly since admin needs to view it
  const { data, error } = await db
    .from('akses_juri')
    .insert({
      event_id: eventId,
      pin_hash: pin, // Store plaintext (admin needs to view & copy)
      keterangan: keterangan?.trim() || '',
      berlaku_hingga: berlaku_hingga || null,
      status: 'aktif',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, pin }, { status: 201 })
}
