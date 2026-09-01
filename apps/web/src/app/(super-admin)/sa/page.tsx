import { createServerSupabase } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OrgTable } from './org-table'

export default async function SuperAdminPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check if user is super admin (by email — configurable)
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim())
  if (!superAdminEmails.includes(user.email || '')) {
    redirect('/app')
  }

  // Fetch all organizations using admin client (bypass RLS)
  const db = getAdminClient()

  // Reconcile stale records: any trial/active org past its berlaku_hingga is
  // immediately expired (same condition as the cron), so the list reflects the
  // effective status and historical records get fixed in place.
  const today = new Date().toISOString().split('T')[0]
  await db
    .from('organizations')
    .update({ status: 'expired' })
    .in('status', ['trial', 'active'])
    .lt('berlaku_hingga', today)

  const { data: orgs } = await db
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-bold">🛡️ Super Admin</h1>
            <p className="text-xs text-gray-400">Kelola semua organisasi</p>
          </div>
          <a href="/app" className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
            ← Dashboard
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Organisasi Terdaftar</h2>
          <span className="rounded-full bg-hijau-tua px-3 py-1 text-xs font-bold text-emas-terang">
            {orgs?.length || 0} total
          </span>
        </div>
        <OrgTable orgs={orgs || []} />
      </main>
    </div>
  )
}
