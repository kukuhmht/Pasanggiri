import { createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { isPastGracePeriod } from '@/lib/org-status'

export { isOrgActive, isInGracePeriod, gracePeriodDaysLeft } from '@/lib/org-status'

export type OrgContext = {
  id: string
  nama: string
  status: string
  slug: string
  berlaku_hingga: string | null
}

export async function getAuthContext() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(*)')
    .eq('user_id', user.id)
    .single()

  if (!membership) return null

  const org = membership.organizations as unknown as OrgContext

  if (isPastGracePeriod(org.berlaku_hingga) && (org.status === 'trial' || org.status === 'active')) {
    await getAdminClient().from('organizations').update({ status: 'expired' }).eq('id', org.id)
    org.status = 'expired'
  }

  return { user, org, orgId: membership.org_id, role: membership.role }
}

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
