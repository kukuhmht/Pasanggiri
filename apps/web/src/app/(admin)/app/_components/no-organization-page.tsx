'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function NoOrganizationPage({ email }: { email: string }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-krem p-6">
      <div className="w-full max-w-lg rounded-2xl border border-emas/30 bg-putih-gading p-8 text-center shadow-lg">
        <div className="mb-4 text-5xl">🏛️</div>
        <h1 className="mb-2 font-[family-name:var(--font-cinzel)] text-2xl font-bold text-hijau-tua">
          Belum Terhubung ke Organisasi
        </h1>
        <p className="mb-6 text-coklat">
          Akun <span className="font-semibold">{email}</span> belum terdaftar di organisasi manapun.
          Hubungi admin organisasi Anda untuk didaftarkan.
        </p>
        <button
          onClick={handleLogout}
          className="inline-flex items-center justify-center rounded-lg border-2 border-emas bg-hijau-tua px-6 py-3 font-bold text-putih-gading transition hover:bg-hijau-tua/90"
        >
          🚪 Keluar Akun
        </button>
      </div>
    </div>
  )
}
