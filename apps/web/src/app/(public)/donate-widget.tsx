'use client'

import { useState } from 'react'

export function DonateFloatingButton() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-emas px-5 py-3 font-bold text-hijau-tua shadow-lg transition hover:scale-105 hover:brightness-110 animate-bounce"
        style={{ animationDuration: '3s' }}
      >
        💚 Donate
      </button>

      {showModal && <DonateModal onClose={() => setShowModal(false)} />}
    </>
  )
}

export function DonateFooter() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="mt-12 border-t border-emas/20 bg-gradient-to-r from-hijau-tua to-hijau-sedang px-6 py-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-sm text-emas-terang">💚 Bantu layanan ini tetap berjalan</p>
          <p className="mb-4 text-xs text-white/80">
            pasanggiri.web.id gratis untuk semua penyelenggara. Dukungan Anda sangat berarti untuk menjaga layanan tetap berjalan.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-emas px-6 py-2.5 font-bold text-hijau-tua transition hover:brightness-110"
          >
            💚 Berdonasi Sekarang
          </button>
        </div>
      </div>

      {showModal && <DonateModal onClose={() => setShowModal(false)} />}
    </>
  )
}

export function DonateCTASection() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <section className="bg-gradient-to-br from-hijau-tua to-hijau-sedang py-16 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-4 text-5xl">💚</div>
          <h2 className="font-[family-name:var(--font-cinzel)] mb-3 text-3xl font-bold text-emas-terang">
            Dukung Layanan Ini
          </h2>
          <p className="mb-6 text-white/90">
            pasanggiri.web.id tersedia gratis untuk semua penyelenggara Pasanggiri Persinas Asad di Indonesia. Setiap donasi Anda membantu menjaga
            layanan tetap berjalan dan berkembang.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-emas px-8 py-3 text-lg font-bold text-hijau-tua shadow-lg transition hover:brightness-110"
          >
            💚 Berdonasi Sekarang
          </button>
        </div>
      </section>

      {showModal && <DonateModal onClose={() => setShowModal(false)} />}
    </>
  )
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
          <img
            src="/screenshots/QRIS kkmht.png"
            alt="QRIS Donasi"
            className="rounded-lg border-2 border-emas/30 shadow-sm"
            style={{ maxWidth: '200px', width: '100%' }}
          />
        </div>

        <div className="mb-3 rounded-lg bg-emas/5 p-3 text-xs text-coklat space-y-1">
          <p>✓ Biaya server & infrastruktur</p>
          <p>✓ Pengembangan fitur baru</p>
          <p>✓ Layanan gratis untuk event lain</p>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href="https://lynk.id/kkmht/n7nd13n58nx2"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-xs text-hijau-tua hover:underline"
          >
            Atau buka halaman donasi →
          </a>
          <button
            onClick={onClose}
            className="rounded-lg border-2 border-gray-200 px-4 py-2 text-sm font-bold text-coklat transition hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
