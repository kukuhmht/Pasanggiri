import { redirect } from 'next/navigation'

// Redirect root slug to /daftar
export default async function PublicEventRoot({ params }: { params: Promise<{ orgSlug: string; eventSlug: string }> }) {
  const { orgSlug, eventSlug } = await params
  redirect(`/${orgSlug}/${eventSlug}/daftar`)
}
