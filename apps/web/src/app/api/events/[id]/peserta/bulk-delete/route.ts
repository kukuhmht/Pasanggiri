import { getAuthContext, getAdminClient, isOrgActive } from '@/lib/auth'
import { NextResponse } from 'next/server'

// POST /api/events/:id/peserta/bulk-delete
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { id: eventId } = await params
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'IDs required' }, { status: 400 })

  const db = getAdminClient()
  const failed = []
  const blocked = []
  let deletedCount = 0

  for (const pid of ids) {
    // 1. Check for existing penilaian
    const { count } = await db.from('penilaian').select('*', { count: 'exact', head: true }).eq('peserta_id', pid)
    if (count && count > 0) {
      blocked.push({ id: pid, reason: `Sudah memiliki ${count} penilaian` })
      continue
    }

    const { data: oldData } = await db.from('peserta').select('*').eq('id', pid).single()
    if (!oldData) {
      failed.push({ id: pid, reason: 'Peserta tidak ditemukan' })
      continue
    }

    const { error } = await db.from('peserta').update({ is_deleted: true }).eq('id', pid)
    if (error) {
      failed.push({ id: pid, reason: error.message })
      continue
    }

    await db.from('audit_logs').insert({
      event_id: eventId,
      entity_id: pid,
      action: 'DELETE',
      old_data: oldData,
      actor_name: ctx.user.email || 'Admin',
      actor_phone: '-',
    })
    deletedCount++
  }

  return NextResponse.json({ deleted: deletedCount, blocked, failed })
}
