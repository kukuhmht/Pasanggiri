'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border-l-4 border-emas bg-putih-gading p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-hijau-tua">
            Lupa Password
          </h1>
          <p className="mt-1 text-sm text-coklat">Masukkan email untuk reset password</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm font-semibold text-hijau-sedang">
                Email reset password telah dikirim ke <b>{email}</b>
              </p>
              <p className="mt-2 text-xs text-coklat">
                Cek inbox (atau folder spam). Klik link di email untuk mengatur password baru.
              </p>
            </div>
            <Link href="/login" className="inline-block text-sm font-semibold text-hijau-tua hover:underline">
              ← Kembali ke Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
              {loading ? 'Mengirim...' : 'Kirim Email Reset'}
            </button>
          </form>
        )}

        {!sent && (
          <p className="mt-6 text-center text-sm text-coklat">
            Ingat password?{' '}
            <Link href="/login" className="font-semibold text-hijau-tua hover:underline">
              Masuk
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
