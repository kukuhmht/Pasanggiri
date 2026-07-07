'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Supabase sets session from the URL hash after email link click
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    // Also check if already in session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => { router.push('/app') }, 2000)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border-l-4 border-emas bg-putih-gading p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-hijau-tua">
            Password Baru
          </h1>
          <p className="mt-1 text-sm text-coklat">Buat password baru untuk akun Anda</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm font-semibold text-hijau-sedang">
                Password berhasil diubah! Mengalihkan ke dashboard...
              </p>
            </div>
          </div>
        ) : !sessionReady ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-coklat">Memverifikasi link reset...</p>
            <p className="text-xs text-gray-400">Jika halaman ini tidak berubah, link mungkin sudah kadaluarsa.</p>
            <Link href="/forgot-password" className="inline-block text-sm font-semibold text-hijau-tua hover:underline">
              Kirim ulang email reset
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Password Baru</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-emas focus:outline-none"
                placeholder="Minimal 6 karakter"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Konfirmasi Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-emas focus:outline-none"
                placeholder="Ulangi password baru"
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
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
