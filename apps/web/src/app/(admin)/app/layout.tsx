import { redirect } from 'next/navigation'
import { AdminSidebar } from './_components/admin-sidebar'
import { getAuthContext, isOrgActive } from '@/lib/auth'
import { TrialInfoCard } from './trial-info-card'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const { user, org } = ctx
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim())
  const isSuperAdmin = superAdminEmails.includes(user.email || '')
  const active = isOrgActive(org)

  const today = new Date().toISOString().split('T')[0]
  const sisaHari = org?.berlaku_hingga
    ? Math.max(0, Math.ceil((new Date(org.berlaku_hingga).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="min-h-screen">
      {!active ? (
        <div className="flex items-center justify-center min-h-screen bg-krem p-6">
          <div className="max-w-2xl w-full">
            <TrialInfoCard 
              status={org?.status || 'trial'} 
              sisaHari={sisaHari} 
              totalHari={7} 
              berlakuHingga={org?.berlaku_hingga || null} 
            />
          </div>
        </div>
      ) : (
        <>
          <AdminSidebar orgNama={org?.nama || 'Pasanggiri'} isSuperAdmin={isSuperAdmin} isActive={active} />
          <main className="lg:pl-64 min-h-screen">
            <div className="p-6 lg:p-10 xl:p-12 2xl:p-16 text-base xl:text-lg 2xl:text-xl text-coklat">
              {children}
            </div>
          </main>
        </>
      )}
    </div>
  )
}