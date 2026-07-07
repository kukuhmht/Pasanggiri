import { createServerSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  // Juga coba dari session (untuk kasus setelah signUp langsung)
  let userId = user?.id
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession()
    userId = session?.user?.id
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { nama } = await request.json()
  if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
    return NextResponse.json({ error: 'Nama organisasi minimal 2 karakter.' }, { status: 400 })
  }

  // Generate slug from nama
  const slug = nama.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)

  // Use service role client for DB operations (bypass RLS for initial setup)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if slug already exists
  const { data: existing } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  const finalSlug = existing ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug

  // Default trial: 7 days from now
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)
  const berlakuHingga = trialEnd.toISOString().split('T')[0]

  // Create organization
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({
      nama: nama.trim(),
      slug: finalSlug,
      owner_user_id: userId,
      status: 'trial',
      berlaku_hingga: berlakuHingga,
    })
    .select()
    .single()

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  // Create membership (owner)
  await supabaseAdmin
    .from('memberships')
    .insert({
      org_id: org.id,
      user_id: userId,
      role: 'owner',
    })

  return NextResponse.json({ org })
}
