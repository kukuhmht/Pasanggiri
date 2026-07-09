import { getAuthContext, getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/events/:id/peserta/:pid
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const ctx = await getAuthContext()
  const body = await request.json()
  let { actor_name, actor_phone, ...updates } = body

  if (ctx) {
    // Admin sudah terautentikasi, tidak perlu konfirmasi identitas
    actor_name = ctx.user.email || 'Admin'
    actor_phone = '-'
  } else if (!actor_name || !actor_phone || !actor_phone.startsWith('62')) {
    return NextResponse.json({ error: 'Nama dan WhatsApp (awalan 62) wajib diisi.' }, { status: 400 })
  }

  const { id: eventId, pid } = await params
  const db = getAdminClient()

  // 1. Get current data for audit
  const { data: oldData, error: fetchError } = await db.from('peserta').select('*').eq('id', pid).single()
  if (fetchError || !oldData) return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })

  // 2. Perform update
  const { data, error } = await db
    .from('peserta')
    .update(updates)
    .eq('id', pid)
    .select('*, kontingen(nama, kode)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 3. Log audit
  await db.from('audit_logs').insert({
    event_id: eventId,
    entity_id: pid,
    action: 'UPDATE',
    old_data: oldData,
    new_data: data,
    actor_name,
    actor_phone,
  })

  return NextResponse.json({ data })
}

// DELETE /api/events/:id/peserta/:pid
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const ctx = await getAuthContext()
  let actor_name, actor_phone
  try {
    const body = await request.json()
    actor_name = body.actor_name
    actor_phone = body.actor_phone
  } catch {
    // If body empty, assume admin
  }

  if (ctx) {
    actor_name = ctx.user.email || 'Admin'
    actor_phone = '-'
  } else if (!actor_name || !actor_phone || !actor_phone.startsWith('62')) {
    return NextResponse.json({ error: 'Nama dan WhatsApp (awalan 62) wajib diisi.' }, { status: 400 })
  }

  const { id: eventId, pid } = await params
  const db = getAdminClient()

  // 1. Check for existing penilaian
  const { count, error: countError } = await db.from('penilaian').select('*', { count: 'exact', head: true }).eq('peserta_id', pid)
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if (count && count > 0) {
    return NextResponse.json({
      error: `Peserta sudah memiliki ${count} penilaian. Hapus nilai terlebih dahulu.`,
      code: 'HAS_PENILAIAN'
    }, { status: 409 })
  }

  // 2. Get current data for logging
  const { data: oldData, error: fetchError } = await db.from('peserta').select('*').eq('id', pid).single()
  if (fetchError || !oldData) return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })

  // 2. Soft delete the record
  const { error } = await db.from('peserta').update({ is_deleted: true }).eq('id', pid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 3. Create audit log
  await db.from('audit_logs').insert({
    event_id: eventId,
    entity_id: pid,
    action: 'DELETE',
    old_data: oldData,
    actor_name,
    actor_phone,
  })

  return NextResponse.json({ success: true })
}
