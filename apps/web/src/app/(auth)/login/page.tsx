'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Email atau password salah.'
        : authError.message)
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-coklat">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-emas focus:outline-none"
          placeholder="email@contoh.com"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-coklat">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-emas focus:outline-none"
          placeholder="••••••••"
          required
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-2 text-center text-sm font-semibold text-merah-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-hijau-tua py-3 font-bold text-emas-terang transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? 'Memproses...' : 'Masuk'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border-l-4 border-emas bg-putih-gading p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-hijau-tua">
            Masuk
          </h1>
          <p className="mt-1 text-sm text-coklat">Login ke akun penyelenggara Anda</p>
        </div>

        <Suspense fallback={<div className="py-8 text-center text-sm text-coklat">Loading...</div>}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-coklat">
          Belum punya akun?{' '}
          <Link href="/register" className="font-semibold text-hijau-tua hover:underline">
            Daftar
          </Link>
        </p>
        <p className="mt-2 text-center">
          <Link href="/forgot-password" className="text-sm text-coklat hover:text-hijau-tua hover:underline">
            Lupa password?
          </Link>
        </p>
      </div>
    </div>
  )
}
