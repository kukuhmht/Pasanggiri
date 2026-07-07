import { createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

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

  const org = membership.organizations as unknown as {
    id: string; nama: string; status: string; slug: string; berlaku_hingga: string | null
  }

  return { user, org, orgId: membership.org_id, role: membership.role }
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
