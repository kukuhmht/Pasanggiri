'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ nama: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Password tidak cocok.')
      return
    }
    if (form.password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }
    if (!form.nama.trim()) {
      setError('Nama organisasi wajib diisi.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // 1. Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { org_nama: form.nama.trim() }
      }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('Pendaftaran gagal. Coba lagi.')
      setLoading(false)
      return
    }

    // 2. Create organization (via API route to ensure server-side logic)
    const res = await fetch('/api/org/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: form.nama.trim() })
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Gagal membuat organisasi.')
      setLoading(false)
      return
    }

    router.push('/app')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border-l-4 border-emas bg-putih-gading p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-hijau-tua">
            Daftar
          </h1>
          <p className="mt-1 text-sm text-coklat">Buat akun penyelenggara baru</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-coklat">Nama Organisasi</label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => update('nama', e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-emas focus:outline-none"
              placeholder="Persinas ASAD Bandung"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-coklat">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-emas focus:outline-none"
              placeholder="email@contoh.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-coklat">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-emas focus:outline-none"
              placeholder="Minimal 6 karakter"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-coklat">Konfirmasi Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-emas focus:outline-none"
              placeholder="Ulangi password"
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
            {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-coklat">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-hijau-tua hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  )
}
