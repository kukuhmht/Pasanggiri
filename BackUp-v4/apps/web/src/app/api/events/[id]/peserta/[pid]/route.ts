import { getAuthContext, getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/events/:id/peserta/:pid
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pid } = await params
  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.kategori !== undefined) updates.kategori = body.kategori
  if (body.golongan !== undefined) updates.golongan = body.golongan
  if (body.kontingen_id !== undefined) updates.kontingen_id = body.kontingen_id
  if (body.anggota !== undefined) updates.anggota = body.anggota

  const db = getAdminClient()
  const { data, error } = await db
    .from('peserta')
    .update(updates)
    .eq('id', pid)
    .select('*, kontingen(nama, kode)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/events/:id/peserta/:pid
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pid } = await params
  const db = getAdminClient()
  const { error } = await db.from('peserta').delete().eq('id', pid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
