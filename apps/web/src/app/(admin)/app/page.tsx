import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from './logout-button'
import { DashboardContent } from './dashboard-content'
import { TrialInfoCard } from './trial-info-card'

const TRIAL_TOTAL_HARI = 7

export default async function AdminDashboard() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch user's organization
  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(*)')
    .eq('user_id', user.id)
    .single()

  const org = (membership?.organizations as unknown) as { id: string; nama: string; status: string; slug: string; berlaku_hingga: string | null } | null

  // Status check — also check expiry date
  const today = new Date().toISOString().split('T')[0]
  const isExpired = org?.berlaku_hingga && org.berlaku_hingga < today
  const isActive = !isExpired && (org?.status === 'active' || org?.status === 'trial')
  const effectiveStatus = isExpired ? 'expired' : (org?.status || '')

  const sisaHari = org?.berlaku_hingga
    ? Math.max(0, Math.ceil((new Date(org.berlaku_hingga).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  // Check super admin
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim())
  const isSuperAdmin = superAdminEmails.includes(user.email || '')

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-br from-hijau-tua to-hijau-sedang text-putih-gading">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-emas-terang">
              {org?.nama || 'Pasanggiri'}
            </h1>
            <p className="text-xs opacity-80">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Link href="/sa" className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-putih-gading hover:bg-white/20">
                🛡️ SA
              </Link>
            )}
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              isExpired ? 'bg-red-500/20 text-red-200' :
              org?.status === 'active' ? 'bg-green-500/20 text-green-200' :
              org?.status === 'trial' ? 'bg-yellow-500/20 text-yellow-200' :
              'bg-red-500/20 text-red-200'
            }`}>
              {isExpired ? 'EXPIRED' : (org?.status?.toUpperCase() || 'N/A')}
            </span>
            <LogoutButton />
          </div>
        </div>
        <div className="h-1.5" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #B8860B 0 8px, #D4A843 8px 16px)'
        }} />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {!org ? (
          <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-8 text-center shadow">
            <p className="text-coklat">Organisasi belum ditemukan. Hubungi admin.</p>
          </div>
        ) : !isActive ? (
          <TrialInfoCard
            status={effectiveStatus}
            sisaHari={sisaHari}
            totalHari={TRIAL_TOTAL_HARI}
            berlakuHingga={org.berlaku_hingga}
          />
        ) : (
          <>
            <TrialInfoCard
              status={effectiveStatus}
              sisaHari={sisaHari}
              totalHari={TRIAL_TOTAL_HARI}
              berlakuHingga={org.berlaku_hingga}
            />
            <DashboardContent email={user.email || ''} orgNama={org.nama} />
          </>
        )}
      </main>
    </div>
  )
}
