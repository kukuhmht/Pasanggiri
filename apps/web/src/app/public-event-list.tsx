'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPusherClient } from '@/lib/pusher/client'

interface EventItem {
  id: string
  nama: string
  subjudul: string
  tahun: number
  slug: string
  status: string
  organizations: { nama: string; slug: string }
}

export function PublicEventList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [events, setEvents] = useState<EventItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const params = new URLSearchParams({ q: search, page: page.toString() })
    const res = await fetch(`/api/public-events?${params}`)
    const json = await res.json()
    setEvents(json.data)
    setTotal(json.total)
    setLoading(false)
  }

  // Debounce search
  useEffect(() => {
    const id = setTimeout(fetchData, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page])

  // Subscribe to Pusher for real-time status updates
  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher || events.length === 0) return

    const channels = events.map(e => {
      const ch = pusher.subscribe(`event-${e.id}`)
      ch.bind('gelanggang-update', () => fetchData())
      ch.bind('nilai-update', () => fetchData())
      return ch
    })

    return () => {
      channels.forEach(ch => {
        ch.unbind_all()
        pusher.unsubscribe(ch.name)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.map(e => e.id).join(',')])

  const totalPages = Math.ceil(total / 10) || 1

  const statusColor = (status: string) => {
    if (status === 'Sedang Berlangsung') return 'bg-red-100 text-red-700 border-red-300'
    if (status === 'Akan Dilaksanakan') return 'bg-blue-100 text-blue-700 border-blue-300'
    if (status === 'Sudah Selesai') return 'bg-gray-100 text-gray-700 border-gray-300'
    return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  }

  return (
    <div className="mb-12">
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="🔍 Cari organisasi atau event..."
          className="flex-1 rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-emas focus:outline-none"
        />
      </div>

      {loading ? (
        <p className="text-center text-coklat">Memuat…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(e => (
            <Link
              key={e.id}
              href={`/${e.organizations.slug}/${e.slug}`}
              className="block rounded-xl border-l-4 border-emas bg-putih-gading p-4 shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua flex-1">
                  {e.nama} ({e.tahun})
                </h3>
              </div>
              <span className={`inline-block rounded border px-2 py-1 text-xs font-bold mb-2 ${statusColor(e.status)}`}>
                {e.status}
              </span>
              <p className="text-sm text-coklat mb-1">{e.subjudul}</p>
              <p className="text-xs text-coklat">{e.organizations.nama}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-center items-center gap-4">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          className="rounded bg-gray-100 px-3 py-1 text-sm disabled:opacity-50"
        >
          ‹ Prev
        </button>
        <span className="text-sm text-coklat">
          Halaman {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => setPage(p => p + 1)}
          className="rounded bg-gray-100 px-3 py-1 text-sm disabled:opacity-50"
        >
          Next ›
        </button>
      </div>
    </div>
  )
}
