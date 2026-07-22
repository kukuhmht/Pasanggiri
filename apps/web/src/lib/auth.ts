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

  // Auto-update status if expired and past grace period
  const today = new Date().toISOString().split('T')[0]
  const isExpired = !!(org.berlaku_hingga && org.berlaku_hingga < today)
  
  const gracePeriodEnd = org.berlaku_hingga 
    ? new Date(new Date(org.berlaku_hingga).getTime() + 3 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]
    : null
  const isPastGracePeriod = !!(gracePeriodEnd && today > gracePeriodEnd)

  if (isPastGracePeriod && org.status !== 'expired') {
    await supabase.from('organizations').update({ status: 'expired' }).eq('id', org.id)
    org.status = 'expired' // Update in-memory object for this request
  }

  return { user, org, orgId: membership.org_id, role: membership.role }
}

/**
 * Check if org is active (not expired and status is trial/active), considering grace period.
 */
export function isOrgActive(
  org: { status: string; berlaku_hingga: string | null } | null | undefined
): boolean {
  if (!org) return false
  
  // Suspended/expired status always blocks
  if (org.status === 'suspended' || org.status === 'expired') return false
  
  // Calculate grace period
  const today = new Date().toISOString().split('T')[0]
  const gracePeriodEnd = org.berlaku_hingga 
    ? new Date(new Date(org.berlaku_hingga).getTime() + 3 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]
    : null
  
  // Block only if past grace period
  const isPastGracePeriod = !!(gracePeriodEnd && today > gracePeriodEnd)
  
  return !isPastGracePeriod && (org.status === 'active' || org.status === 'trial')
}

/**
 * Check if org is in grace period (expired but still within 3 days).
 */
export function isInGracePeriod(
  org: { berlaku_hingga: string | null } | null | undefined
): boolean {
  if (!org?.berlaku_hingga) return false
  
  const today = new Date().toISOString().split('T')[0]
  const isExpired = org.berlaku_hingga < today
  
  const gracePeriodEnd = new Date(new Date(org.berlaku_hingga).getTime() + 3 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  const isPastGracePeriod = today > gracePeriodEnd
  
  return isExpired && !isPastGracePeriod
}

/**
 * Calculate days remaining until grace period ends.
 */
export function gracePeriodDaysLeft(berlaku_hingga: string | null): number {
  if (!berlaku_hingga) return 0
  
  const today = new Date().toISOString().split('T')[0]
  const gracePeriodEnd = new Date(new Date(berlaku_hingga).getTime() + 3 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  
  const diffMs = new Date(gracePeriodEnd).getTime() - new Date(today).getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
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
