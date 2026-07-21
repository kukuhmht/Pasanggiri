import type { Metadata } from 'next'
import { getAdminClient } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DonateFloatingButton, DonateFooter } from '../../donate-widget'

async function resolvePublicEvent(orgSlug: string, eventSlug: string) {
  const db = getAdminClient()
  const { data: org } = await db
    .from('organizations')
    .select('id, nama, slug')
    .eq('slug', orgSlug)
    .single()
  if (!org) return null
  const { data: event } = await db
    .from('events')
    .select('id, nama, subjudul, tahun, is_public, slug')
    .eq('org_id', org.id)
    .eq('slug', eventSlug)
    .single()
  if (!event || !event.is_public) return null
  return { org, event }
}

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; eventSlug: string }> }): Promise<Metadata> {
  const { orgSlug, eventSlug } = await params
  const result = await resolvePublicEvent(orgSlug, eventSlug)
  if (!result) return { title: 'Event tidak ditemukan' }
  const { org, event } = result
  const title = `${event.nama} ${event.tahun}`
  const desc = `${event.subjudul || 'Pendaftaran, live score, dan hasil'} - ${event.nama} ${event.tahun} oleh ${org.nama}. Dikelola dengan Pasanggiri.`
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, type: 'website' },
    alternates: { canonical: `/${orgSlug}/${eventSlug}/daftar` },
  }
}

export default async function PublicEventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string; eventSlug: string }>
}) {
  const { orgSlug, eventSlug } = await params
  const result = await resolvePublicEvent(orgSlug, eventSlug)
  if (!result) notFound()
  const { org, event } = result

  const basePath = `/${orgSlug}/${eventSlug}`

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-br from-hijau-tua to-hijau-sedang text-putih-gading">
        <div className="mx-auto max-w-4xl px-6 py-5 text-center">
          <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-emas-terang">
            {event.nama}
          </h1>
          {event.subjudul && <p className="mt-1 text-sm opacity-90">{event.subjudul}</p>}
          <p className="mt-0.5 text-xs opacity-70">{org.nama} — {event.tahun}</p>
        </div>
        <div className="h-1.5" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #B8860B 0 8px, #D4A843 8px 16px)'
        }} />
      </header>

      {/* Nav tabs */}
      <nav className="border-b bg-putih-gading">
        <div className="mx-auto flex max-w-4xl gap-1 px-6 py-2">
          <Link href={`${basePath}/daftar`}
            className="rounded-lg px-4 py-2 text-sm font-bold text-coklat hover:bg-hijau-tua/5 hover:text-hijau-tua">
            📝 Pendaftaran
          </Link>
          <Link href={`${basePath}/live-score`}
            className="rounded-lg px-4 py-2 text-sm font-bold text-coklat hover:bg-hijau-tua/5 hover:text-hijau-tua">
            🔴 Live Score
          </Link>
          <Link href={`${basePath}/hasil`}
            className="rounded-lg px-4 py-2 text-sm font-bold text-coklat hover:bg-hijau-tua/5 hover:text-hijau-tua">
            🏆 Hasil
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        {children}
      </main>

      <DonateFooter />
      <DonateFloatingButton />
    </div>
  )
}
