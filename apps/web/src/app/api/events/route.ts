import { getAuthContext, getAdminClient } from '@/lib/auth'
import { slugify } from '@/lib/slugify'
import { NextResponse } from 'next/server'

// GET /api/events — list events for current org
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getAdminClient()
  const { data, error } = await db
    .from('events')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/events — create new event
export async function POST(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { nama, subjudul, tahun, prefix, slug } = body

  if (!nama?.trim()) return NextResponse.json({ error: 'Nama event wajib diisi.' }, { status: 400 })
  if (!prefix?.trim()) return NextResponse.json({ error: 'Prefix wajib diisi.' }, { status: 400 })

  const eventSlug = slugify(slug || nama)

  const db = getAdminClient()
  const { data, error } = await db
    .from('events')
    .insert({
      org_id: ctx.orgId,
      nama: nama.trim(),
      subjudul: subjudul?.trim() || '',
      tahun: parseInt(tahun) || new Date().getFullYear(),
      prefix: prefix.trim().toUpperCase(),
      slug: eventSlug,
      is_public: true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug event sudah digunakan.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
