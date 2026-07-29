import { getAdminClient, getAuthContext } from '@/lib/auth'
import { getEventStatus } from '@/lib/event-status'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const ctx = await getAuthContext()
  let { actor_name, actor_phone } = await request.json()

  if (ctx) {
    actor_name = ctx.user.email || 'Admin'
    actor_phone = '-'
  } else if (!actor_name || !actor_phone || !actor_phone.startsWith('62')) {
    return NextResponse.json({ error: 'Nama dan WhatsApp (awalan 62) wajib diisi.' }, { status: 400 })
  }

  const { id: eventId, pid } = await params
  const db = getAdminClient()

  if (!ctx && await getEventStatus(db, eventId) === 'Sudah Selesai') {
    return NextResponse.json({ error: 'Perubahan peserta telah ditutup. Event sudah selesai.' }, { status: 403 })
  }

  const { data: oldData, error: fetchError } = await db.from('peserta').select('*').eq('id', pid).single()
  if (fetchError || !oldData) return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })

  const { data, error } = await db
    .from('peserta')
    .update({ is_deleted: false })
    .eq('id', pid)
    .select('*, kontingen(nama, kode)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('audit_logs').insert({
    event_id: eventId,
    entity_id: pid,
    action: 'RESTORE',
    old_data: oldData,
    new_data: data,
    actor_name,
    actor_phone,
  })

  return NextResponse.json({ data })
}
