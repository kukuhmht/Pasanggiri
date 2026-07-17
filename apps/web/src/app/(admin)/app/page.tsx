import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

  return (
    <div className="space-y-6">
        {!org ? (
          <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-8 text-center shadow">
            <p>Organisasi belum ditemukan. Hubungi admin.</p>
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
    </div>
  )
}

