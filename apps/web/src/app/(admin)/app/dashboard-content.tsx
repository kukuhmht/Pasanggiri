'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useEventPicker, featurePath } from './_components/use-event-picker'
import { EventPickerModal } from './_components/event-picker-modal'

const FEATURES = [
  { key: 'peserta', title: 'Peserta', desc: 'Lihat semua peserta', emoji: '🥋' },
  { key: 'penilaian', title: 'Penilaian', desc: 'Input & rekap nilai', emoji: '👨🏼‍🏫' },
  { key: 'gelanggang', title: 'Gelanggang', desc: 'Antrian & live', emoji: '🏟️' },
  { key: 'rekap', title: 'Rekap & Hasil', desc: 'Peringkat & juara', emoji: '🏆' },
  { key: 'pin', title: 'PIN Juri', desc: 'Generate & kelola PIN', emoji: '🔐' },
]

export function DashboardContent({ email, orgNama }: { email: string; orgNama: string }) {
  const { events, loading, showModal, setShowModal, pickEventAndNavigate, selectEvent } = useEventPicker()
  const [publicLink, setPublicLink] = useState<string | null>(null)

  // Function to fetch and set public link for an event
  async function fetchAndSetPublicLink(eventId: string) {
    const res = await fetch(`/api/events/${eventId}/info`)
    const { orgSlug, eventSlug } = await res.json()
    if (orgSlug && eventSlug) {
      // ponytail: hardcoded domain, use env var for production.
      setPublicLink(`${window.location.origin}/${orgSlug}/${eventSlug}/daftar`)
    } else {
      setPublicLink(null)
    }
  }

  // Effect to handle initial public link display if only one event exists
  useEffect(() => {
    if (events.length === 1 && !publicLink) {
      fetchAndSetPublicLink(events[0].id)
    }
  }, [events, publicLink])


  return (
    <div className="space-y-6">
      <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-6 shadow">
        <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-semibold text-hijau-tua">
          Selamat Datang
        </h2>
        <p className="mt-2 text-coklat">
          Anda login sebagai <b>{email}</b> — {orgNama}
        </p>
      </div>

      {publicLink && (
        <div className="rounded-xl border-l-4 border-hijau-sedang bg-putih-gading p-6 shadow">
          <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-semibold text-hijau-tua">
            Akses Publik
          </h2>
          <p className="mt-2 text-coklat">Bagikan link pendaftaran publik ini:</p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicLink}
              className="flex-grow rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm text-coklat focus:outline-none"
            />
            <button
              onClick={() => navigator.clipboard.writeText(publicLink)}
              className="rounded-lg bg-hijau-tua px-4 py-2 text-sm font-bold text-emas-terang hover:brightness-110"
            >
              Salin
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Events card — langsung ke /app/events */}
        <Link href="/app/events"
          className="group rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow transition hover:shadow-lg hover:-translate-y-0.5">
          <div className="text-2xl">📋</div>
          <h3 className="mt-2 font-[family-name:var(--font-cinzel)] text-base font-semibold text-hijau-tua">Events</h3>
          <p className="mt-1 text-sm text-coklat">Kelola event lomba</p>
        </Link>

        {/* Feature cards — pilih event dulu */}
        {FEATURES.map(f => (
          <button key={f.key} onClick={() => pickEventAndNavigate(featurePath(f.key))}
            className="group rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow transition hover:shadow-lg hover:-translate-y-0.5 text-left">
            <div className="text-2xl">{f.emoji}</div>
            <h3 className="mt-2 font-[family-name:var(--font-cinzel)] text-base font-semibold text-hijau-tua">{f.title}</h3>
            <p className="mt-1 text-sm text-coklat">{f.desc}</p>
          </button>
        ))}

        {/* Settings card — langsung ke /app/settings */}
        <Link href="/app/settings"
          className="group rounded-xl border-l-4 border-gray-300 bg-putih-gading p-5 shadow transition hover:shadow-lg hover:-translate-y-0.5">
          <div className="text-2xl">⚙️</div>
          <h3 className="mt-2 font-[family-name:var(--font-cinzel)] text-base font-semibold text-hijau-tua">Pengaturan</h3>
          <p className="mt-1 text-sm text-coklat">Profil & password</p>
        </Link>
      </div>
      
      {showModal && (
        <EventPickerModal
          events={events}
          loading={loading}
          onSelect={selectEvent}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
