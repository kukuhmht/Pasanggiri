import { createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export type OrgContext = {
  id: string
  nama: string
  status: string
  slug: string
  berlaku_hingga: string | null
}

/**
 * Get current user's org membership. Returns null if not authenticated or no org.
 */
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

  return { user, org, orgId: membership.org_id, role: membership.role }
}

/**
 * Check if org is active (not expired and status is trial/active).
 */
export function isOrgActive(org: { status: string; berlaku_hingga: string | null } | null | undefined): boolean {
  if (!org) return false
  const today = new Date().toISOString().split('T')[0]
  const isExpired = !!(org.berlaku_hingga && org.berlaku_hingga < today)
  return !isExpired && (org.status === 'active' || org.status === 'trial')
}

/**
 * Supabase admin client (bypasses RLS). Server-side only.
 */
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
