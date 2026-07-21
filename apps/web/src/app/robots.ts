import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasanggiri.web.id'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/login', '/register', '/forgot-password', '/reset-password', '/juri'],
    },
    sitemap: `${SITE}/sitemap.xml`,
  }
}