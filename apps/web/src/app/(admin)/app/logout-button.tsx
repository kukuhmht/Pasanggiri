'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-putih-gading transition hover:bg-white/20"
    >
      Keluar
    </button>
  )
}
