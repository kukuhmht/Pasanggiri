import { getAuthContext, getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/events/:id/pin/:pinId — revoke/activate PIN
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; pinId: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pinId } = await params
  const { status } = await request.json()

  if (!['aktif', 'nonaktif'].includes(status)) {
    return NextResponse.json({ error: 'Status harus aktif/nonaktif.' }, { status: 400 })
  }

  const db = getAdminClient()
  const { error } = await db
    .from('akses_juri')
    .update({ status })
    .eq('id', pinId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE /api/events/:id/pin/:pinId
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; pinId: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pinId } = await params
  const db = getAdminClient()
  const { error } = await db.from('akses_juri').delete().eq('id', pinId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
