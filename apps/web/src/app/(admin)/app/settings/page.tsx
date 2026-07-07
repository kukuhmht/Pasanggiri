'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SettingsPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [orgNama, setOrgNama] = useState('')
  const [orgId, setOrgId] = useState('')

  // Org name form
  const [newOrgNama, setNewOrgNama] = useState('')
  const [orgSaving, setOrgSaving] = useState(false)
  const [orgMessage, setOrgMessage] = useState('')

  // Password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState('')

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setEmail(user.email || '')

    const res = await fetch('/api/org/profile')
    if (res.ok) {
      const { org } = await res.json()
      setOrgNama(org.nama)
      setOrgId(org.id)
      setNewOrgNama(org.nama)
    }
  }

  async function handleUpdateOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!newOrgNama.trim()) return
    setOrgSaving(true)
    setOrgMessage('')

    const res = await fetch('/api/org/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: newOrgNama.trim() })
    })
    const result = await res.json()
    setOrgSaving(false)

    if (res.ok) {
      setOrgNama(newOrgNama.trim())
      setOrgMessage('Nama organisasi berhasil diperbarui.')
    } else {
      setOrgMessage(result.error || 'Gagal memperbarui.')
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMessage('')

    if (newPassword.length < 6) {
      setPwMessage('Password minimal 6 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('Konfirmasi password tidak cocok.')
      return
    }

    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)

    if (error) {
      setPwMessage(error.message)
    } else {
      setPwMessage('Password berhasil diubah.')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-br from-hijau-tua to-hijau-sedang text-putih-gading">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-emas-terang">Pengaturan Akun</h1>
            <p className="text-xs opacity-80">{email}</p>
          </div>
          <Link href="/app" className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-putih-gading hover:bg-white/20">
            ← Dashboard
          </Link>
        </div>
        <div className="h-1.5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #B8860B 0 8px, #D4A843 8px 16px)' }} />
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {/* Ubah Nama Organisasi */}
        <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-6 shadow">
          <h2 className="font-[family-name:var(--font-cinzel)] text-base font-bold text-hijau-tua mb-4">Nama Organisasi</h2>
          <form onSubmit={handleUpdateOrg} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Nama Organisasi</label>
              <input value={newOrgNama} onChange={e => setNewOrgNama(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:border-emas focus:outline-none"
                placeholder="Nama organisasi" required />
            </div>
            {orgMessage && (
              <p className={`text-sm font-semibold ${orgMessage.includes('berhasil') ? 'text-hijau-sedang' : 'text-merah-error'}`}>
                {orgMessage}
              </p>
            )}
            <button type="submit" disabled={orgSaving}
              className="rounded-lg bg-hijau-tua px-6 py-2.5 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
              {orgSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>

        {/* Ubah Password */}
        <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-6 shadow">
          <h2 className="font-[family-name:var(--font-cinzel)] text-base font-bold text-hijau-tua mb-4">Ubah Password</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Password Baru</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:border-emas focus:outline-none"
                placeholder="Minimal 6 karakter" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Konfirmasi Password Baru</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:border-emas focus:outline-none"
                placeholder="Ulangi password baru" required />
            </div>
            {pwMessage && (
              <p className={`text-sm font-semibold ${pwMessage.includes('berhasil') ? 'text-hijau-sedang' : 'text-merah-error'}`}>
                {pwMessage}
              </p>
            )}
            <button type="submit" disabled={pwSaving}
              className="rounded-lg bg-hijau-tua px-6 py-2.5 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
              {pwSaving ? 'Mengubah...' : 'Ubah Password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
