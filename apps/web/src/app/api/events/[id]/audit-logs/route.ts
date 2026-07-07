import { getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const db = getAdminClient()

  const { data, error } = await db
    .from('audit_logs')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
