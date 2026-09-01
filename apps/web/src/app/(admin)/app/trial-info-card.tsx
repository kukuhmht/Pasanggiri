'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isInGracePeriod, gracePeriodDaysLeft } from '@/lib/org-status'

export function TrialInfoCard({
  status,
  sisaHari,
  totalHari,
  berlakuHingga,
}: {
  status: string
  sisaHari: number
  totalHari: number
  berlakuHingga: string | null
}) {
  const [showModal, setShowModal] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const formatTanggal = (tgl: string | null) => {
    if (!tgl) return '-'
    return new Date(tgl).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  async function trackAnalytics(type: string) {
    fetch('/api/analytics', { method: 'POST', body: JSON.stringify({ type }) }).catch(() => {})
  }

  async function handleLogout() {
    await trackAnalytics('logout')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (status === 'trial' && !isInGracePeriod({ berlaku_hingga: berlakuHingga })) {
    const progress = totalHari > 0 ? ((totalHari - sisaHari) / totalHari) * 100 : 0

    return (
      <>
        <div className="mb-6 rounded-xl border-l-4 border-emas bg-gradient-to-r from-yellow-50 to-emas/10 p-5 shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">⏳</span>
                <h3 className="font-[family-name:var(--font-cinzel)] text-sm font-bold uppercase tracking-wide text-hijau-tua">
                  Masa Trial
                </h3>
              </div>
              <p className="mb-3 text-sm text-coklat">
                Akun Anda dalam masa trial. Sisa <b>{sisaHari} hari</b> sebelum akun tersuspend.
              </p>

              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between text-xs text-coklat">
                  <span>{totalHari - sisaHari} / {totalHari} hari berlalu</span>
                  <span>{sisaHari} hari tersisa</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-emas transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
              </div>

              <p className="text-xs text-gray-600">
                Berakhir: <b>{formatTanggal(berlakuHingga)}</b>
              </p>
            </div>

            <button onClick={() => { trackAnalytics('donate_click'); setShowModal(true) }}
              className="flex-shrink-0 rounded-lg bg-hijau-tua px-4 py-2.5 text-sm font-bold text-emas-terang transition hover:brightness-110">
              💚 Dukung Kami
            </button>
          </div>
        </div>

        {showModal && <DonateModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  if (status === 'active') {
    return (
      <>
        <div className="mb-6 rounded-xl border-l-4 border-hijau-sedang bg-gradient-to-r from-green-50 to-hijau-tua/5 p-5 shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">💚</span>
                <h3 className="font-[family-name:var(--font-cinzel)] text-sm font-bold uppercase tracking-wide text-hijau-tua">
                  Terima Kasih Atas Dukungan Anda
                </h3>
              </div>
              <p className="mb-1 text-sm text-coklat">
                Akun Anda aktif hingga <b>{formatTanggal(berlakuHingga)}</b>.
              </p>
              <p className="text-xs text-gray-600">
                Dukungan Anda membantu layanan ini tetap berjalan dengan baik untuk semua pengguna.
              </p>
            </div>

            <button onClick={() => { trackAnalytics('donate_click'); setShowModal(true) }}
              className="flex-shrink-0 rounded-lg bg-hijau-tua px-4 py-2.5 text-sm font-bold text-emas-terang transition hover:brightness-110">
              💚 Donate Lagi
            </button>
          </div>
        </div>

        {showModal && <DonateModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  if (isInGracePeriod({ berlaku_hingga: berlakuHingga })) {
    const daysLeft = gracePeriodDaysLeft(berlakuHingga)
    return (
      <>
        <div className="mb-6 rounded-xl border-l-4 border-yellow-500 bg-gradient-to-r from-yellow-50 to-yellow-100/50 p-5 shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">⏰</span>
                <h3 className="font-[family-name:var(--font-cinzel)] text-sm font-bold uppercase tracking-wide text-yellow-800">
                  Masa Berlaku Habis
                </h3>
              </div>
              <p className="mb-3 text-sm text-yellow-900">
                Akun Anda telah melewati masa berlaku pada <b>{formatTanggal(berlakuHingga)}</b>. Anda masih dapat menggunakan layanan selama <b>{daysLeft} hari</b> lagi (grace period).
              </p>
              <p className="text-xs text-yellow-800">
                Setelah grace period berakhir, akun akan tersuspend. Silakan perpanjang secepatnya.
              </p>
            </div>

            <button onClick={() => { trackAnalytics('donate_click'); setShowModal(true) }}
              className="flex-shrink-0 rounded-lg bg-hijau-tua px-4 py-2.5 text-sm font-bold text-emas-terang transition hover:brightness-110">
              💚 Perpanjang
            </button>
          </div>
        </div>

        {showModal && <DonateModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  if (status === 'suspended' || status === 'expired') {
    const supportWA = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || 'https://wasap.at/dkyu8m'
    return (
      <>
        <div className="rounded-xl border-l-4 border-merah-error bg-gradient-to-r from-red-50 to-red-100/50 p-8 text-center shadow">
          <div className="mb-3 text-4xl">⚠️</div>
          <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">Masa Berlaku Habis</h2>
          <p className="mt-3 text-sm text-coklat max-w-lg mx-auto">
            Akun Anda telah melewati masa trial/berlaku aktif sejak tanggal <b>{formatTanggal(berlakuHingga)}</b>. Untuk terus menggunakan layanan ini, silakan lakukan donasi atau jika menginginkan tetap gratis, silakan <a href={supportWA} target="_blank" rel="noopener noreferrer" onClick={() => trackAnalytics('wa_click')} className="text-hijau-tua font-semibold underline hover:text-hijau-sedang">WhatsApp kami</a>.
          </p>

          <div className="mt-5 mb-6 text-left max-w-sm mx-auto bg-white/70 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-bold text-coklat mb-2">Dukungan Anda membantu:</p>
            <div className="space-y-1.5 text-xs text-coklat">
              <p>✓ Biaya server & infrastruktur</p>
              <p>✓ Pengembangan fitur baru</p>
              <p>✓ Layanan gratis untuk event lain</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => { trackAnalytics('donate_click'); setShowModal(true) }}
              className="inline-flex items-center justify-center rounded-lg bg-hijau-tua px-6 py-3 font-bold text-emas-terang transition hover:brightness-110">
              💚 Donate Sekarang
            </button>
            <button onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center justify-center rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-bold text-coklat transition hover:bg-gray-50">
              🚪 Keluar Akun
            </button>
          </div>
        </div>

        {showModal && <DonateModal onClose={() => setShowModal(false)} />}
        {showLogoutConfirm && <LogoutConfirmModal onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} />}
      </>
    )
  }

  return null
}

function DonateModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl bg-putih-gading p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-center">
          <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua">💚 Dukung Pasanggiri</h3>
          <p className="mt-1 text-xs text-coklat">Scan QRIS untuk berdonasi</p>
        </div>

        <div className="mb-3 flex justify-center">
          <img src="/screenshots/QRIS kkmht.png" alt="QRIS Donasi" className="rounded-lg border-2 border-emas/30 shadow-sm" style={{ maxWidth: '200px', width: '100%' }} />
        </div>

        <div className="mb-3 rounded-lg bg-emas/5 p-3 text-xs text-coklat space-y-1">
          <p>✓ Biaya server & infrastruktur</p>
          <p>✓ Pengembangan fitur baru</p>
          <p>✓ Layanan gratis untuk event lain</p>
        </div>

        <div className="flex flex-col gap-2">
          <a href="https://lynk.id/kkmht/n7nd13n58nx2" target="_blank" rel="noopener noreferrer" className="text-center text-xs text-hijau-tua hover:underline">
            Atau buka halaman donasi →
          </a>
          <a href="https://wasap.at/dkyu8m" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-green-700">
            ✅ Sudah Donasi? Konfirmasi via WhatsApp
          </a>
          <button onClick={onClose} className="rounded-lg border-2 border-gray-200 px-4 py-2 text-sm font-bold text-coklat transition hover:bg-gray-50">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

function LogoutConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-2 text-center">Konfirmasi Keluar</h3>
        <p className="text-sm text-coklat mb-6 text-center">Apakah Anda yakin ingin keluar dari akun?</p>

        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-merah-error px-4 py-2.5 font-bold text-white transition hover:brightness-110">Ya, Keluar</button>
          <button onClick={onCancel} className="flex-1 rounded-lg border-2 border-gray-200 px-4 py-2.5 font-bold text-coklat transition hover:bg-gray-50">Batal</button>
        </div>
      </div>
    </div>
  )
}
