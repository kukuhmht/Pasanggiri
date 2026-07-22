import { redirect } from 'next/navigation'
import { getAuthContext, isOrgActive } from '@/lib/auth'
import { DashboardContent } from './dashboard-content'
import { TrialInfoCard } from './trial-info-card'

const TRIAL_TOTAL_HARI = 7

export default async function AdminDashboard() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const { user, org } = ctx
  const active = isOrgActive(org)

  const today = new Date().toISOString().split('T')[0]
  const sisaHari = org?.berlaku_hingga
    ? Math.max(0, Math.ceil((new Date(org.berlaku_hingga).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="space-y-6">
      {!org ? (
        <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-8 text-center shadow">
          <p>Organisasi belum ditemukan. Hubungi admin.</p>
        </div>
      ) : (
        <>
          <TrialInfoCard
            status={org.status}
            sisaHari={sisaHari}
            totalHari={TRIAL_TOTAL_HARI}
            berlakuHingga={org.berlaku_hingga}
          />
          {active && <DashboardContent email={user.email || ''} orgNama={org.nama} />}
        </>
      )}
    </div>
  )
}

