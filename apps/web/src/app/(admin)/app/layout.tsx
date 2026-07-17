import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from './_components/admin-sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id, organizations(*)')
    .eq('user_id', user.id)
    .single()

  const org = (membership?.organizations as unknown) as { id: string; nama: string } | null

  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim())
  const isSuperAdmin = superAdminEmails.includes(user.email || '')

  return (
    <div className="min-h-screen">
      <AdminSidebar orgNama={org?.nama || 'Pasanggiri'} isSuperAdmin={isSuperAdmin} />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-10 xl:p-12 2xl:p-16 text-base xl:text-lg 2xl:text-xl text-coklat">
          {children}
        </div>
      </main>
    </div>
  )
}