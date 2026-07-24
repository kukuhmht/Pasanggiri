import type { MetadataRoute } from 'next'
import { getAdminClient } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasanggiri.web.id'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getAdminClient()
  const { data } = await db
    .from('events')
    .select('slug, created_at, organizations(slug)')
    .eq('is_public', true)

  const events = (data || []).flatMap((e: any) => {
    const org = Array.isArray(e.organizations) ? e.organizations[0] : e.organizations
    if (!org?.slug) return []
    const base = `${SITE}/${org.slug}/${e.slug}`
    const lastModified = new Date(e.created_at)
    return [
      { url: `${base}/daftar`, lastModified, changeFrequency: 'daily' as const, priority: 0.8 },
      { url: `${base}/live-score`, lastModified, changeFrequency: 'hourly' as const, priority: 0.7 },
      { url: `${base}/hasil`, lastModified, changeFrequency: 'daily' as const, priority: 0.9 },
    ]
  })

  return [
    { url: SITE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ...events,
  ]
}