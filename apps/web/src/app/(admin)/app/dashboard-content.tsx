'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Event = { id: string; nama: string; prefix: string; tahun: number }

const FEATURES = [
  { key: 'peserta', title: 'Peserta', desc: 'Lihat semua peserta', emoji: '🥋' },
  { key: 'penilaian', title: 'Penilaian', desc: 'Input & rekap nilai', emoji: '👨🏼‍🏫' },
  { key: 'gelanggang', title: 'Gelanggang', desc: 'Antrian & live', emoji: '🏟️' },
  { key: 'rekap', title: 'Rekap & Hasil', desc: 'Peringkat & juara', emoji: '🏆' },
  { key: 'pin', title: 'PIN Juri', desc: 'Generate & kelola PIN', emoji: '🔐' },
]

export function DashboardContent({ email, orgNama }: { email: string; orgNama: string }) {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [targetPath, setTargetPath] = useState('')
  const [publicLink, setPublicLink] = useState<string | null>(null) // New state for public link

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(({ data }) => {
      setEvents(data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

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

  function handleFeatureClick(key: string) {
    const path = key !== 'peserta' ? key : ''
    if (events.length === 1) {
      router.push(`/app/events/${events[0].id}/${path}`)
      fetchAndSetPublicLink(events[0].id) // Fetch public link for the single event
    } else {
      setTargetPath(path)
      setShowModal(true)
    }
  }

  function selectEvent(eventId: string) {
    setShowModal(false)
    router.push(`/app/events/${eventId}/${targetPath}`)
    fetchAndSetPublicLink(eventId) // Fetch public link when event is selected from modal
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
          <button key={f.key} onClick={() => handleFeatureClick(f.key)}
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

      {/* Modal pilih event */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-sm rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-4">Pilih Event</h3>
            {loading ? (
              <p className="text-sm text-coklat">Memuat...</p>
            ) : events.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-coklat mb-3">Belum ada event.</p>
                <Link href="/app/events" className="rounded-lg bg-hijau-tua px-4 py-2 text-sm font-bold text-emas-terang">
                  Buat Event
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {events.map(ev => (
                  <button key={ev.id} onClick={() => selectEvent(ev.id)}
                    className="w-full rounded-lg border-2 border-gray-200 bg-white p-3 text-left transition hover:border-emas hover:bg-krem">
                    <div className="font-bold text-hijau-tua">{ev.nama}</div>
                    <div className="text-xs text-coklat">{ev.prefix} · {ev.tahun}</div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowModal(false)}
              className="mt-4 w-full rounded-lg border-2 border-gray-200 py-2 text-sm font-bold text-coklat hover:bg-gray-50">
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
