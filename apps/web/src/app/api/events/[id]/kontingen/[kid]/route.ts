import { getAuthContext, getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/events/:id/kontingen/:kid
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; kid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kid } = await params
  const { nama, kode } = await request.json()
  const updates: Record<string, string> = {}
  if (nama) updates.nama = nama.trim()
  if (kode) updates.kode = kode.trim().toUpperCase()

  const db = getAdminClient()
  const { data, error } = await db
    .from('kontingen')
    .update(updates)
    .eq('id', kid)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/events/:id/kontingen/:kid
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; kid: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kid } = await params
  const db = getAdminClient()
  const { error } = await db.from('kontingen').delete().eq('id', kid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
