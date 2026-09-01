type OrgStatus = { status: string; berlaku_hingga: string | null }

function today() {
  return new Date().toISOString().split('T')[0]
}

// Single source of truth for expiry: an org is expired the moment today is
// past its berlaku_hingga (no grace period).
export function isExpiredByDate(berlaku_hingga: string | null): boolean {
  return !!berlaku_hingga && today() > berlaku_hingga
}

export function isOrgActive(org: OrgStatus | null | undefined) {
  if (!org || org.status === 'suspended' || org.status === 'expired') return false
  return !isExpiredByDate(org.berlaku_hingga) && (org.status === 'active' || org.status === 'trial')
}

// Grace period has been removed — expiry is immediate. These remain exported
// for backward compatibility with existing callers (e.g. TrialInfoCard) but are
// now neutralized so the grace-period UI branch becomes dead code.
export function isInGracePeriod(_org?: { berlaku_hingga: string | null } | null | undefined) {
  return false
}

export function gracePeriodDaysLeft(_berlaku_hingga?: string | null) {
  return 0
}

// Shared expiry predicate: an org is expired when its status is 'expired' or
// 'suspended', or when today is past its berlaku_hingga. A null/undefined org
// is treated as not-expired so missing org data never fabricates a downgrade.
export function isOrgExpired(org: { status: string; berlaku_hingga: string | null } | null | undefined): boolean {
  if (!org) return false
  return org.status === 'expired' || org.status === 'suspended' || isExpiredByDate(org.berlaku_hingga)
}
