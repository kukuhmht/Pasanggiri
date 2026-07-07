import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '../logout-button'

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id, organizations(*)')
    .eq('user_id', user.id)
    .single()

  const org = (membership?.organizations as unknown) as { nama: string } | null

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-br from-hijau-tua to-hijau-sedang text-putih-gading">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/app" className="text-xs hover:underline opacity-80">← Dashboard</Link>
            <div>
              <h1 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-emas-terang">
                {org?.nama || 'Pasanggiri'}
              </h1>
            </div>
          </div>
          <LogoutButton />
        </div>
        <div className="h-1.5" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #B8860B 0 8px, #D4A843 8px 16px)'
        }} />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
