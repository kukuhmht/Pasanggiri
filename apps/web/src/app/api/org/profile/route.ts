import { getAuthContext, getAdminClient, isOrgActive } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/org/profile — get current user's org info
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const db = getAdminClient()
  const { data: org } = await db
    .from('organizations')
    .select('id, nama, slug, status, berlaku_hingga')
    .eq('id', ctx.orgId)
    .single()

  if (!org) return NextResponse.json({ error: 'Organisasi tidak ditemukan.' }, { status: 404 })
  return NextResponse.json({ org })
}

// PATCH /api/org/profile — update org name
export async function PATCH(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrgActive(ctx.org)) return NextResponse.json({ error: 'Akun Anda telah melewati masa aktif.' }, { status: 403 })

  const { nama } = await request.json()
  if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
    return NextResponse.json({ error: 'Nama minimal 2 karakter.' }, { status: 400 })
  }

  const db = getAdminClient()
  const { error } = await db
    .from('organizations')
    .update({ nama: nama.trim() })
    .eq('id', ctx.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
