const GRACE_PERIOD_DAYS = 3

type OrgStatus = { status: string; berlaku_hingga: string | null }

function today() {
  return new Date().toISOString().split('T')[0]
}

function gracePeriodEnd(berlaku_hingga: string) {
  return new Date(new Date(berlaku_hingga).getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
}

export function isPastGracePeriod(berlaku_hingga: string | null) {
  return !!berlaku_hingga && today() > gracePeriodEnd(berlaku_hingga)
}

export function isOrgActive(org: OrgStatus | null | undefined) {
  if (!org || org.status === 'suspended' || org.status === 'expired') return false
  return !isPastGracePeriod(org.berlaku_hingga) && (org.status === 'active' || org.status === 'trial')
}

export function isInGracePeriod(org: { berlaku_hingga: string | null } | null | undefined) {
  if (!org?.berlaku_hingga) return false
  return org.berlaku_hingga < today() && !isPastGracePeriod(org.berlaku_hingga)
}

export function gracePeriodDaysLeft(berlaku_hingga: string | null) {
  if (!berlaku_hingga) return 0
  const diffMs = new Date(gracePeriodEnd(berlaku_hingga)).getTime() - new Date(today()).getTime()
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
}
