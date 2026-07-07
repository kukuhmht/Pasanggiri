import { getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const db = getAdminClient()

  const { data, error } = await db
    .from('peserta')
    .select('*, kontingen(nama, kode)')
    .eq('event_id', eventId)
    .eq('is_deleted', true)
    .order('no_urut')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
