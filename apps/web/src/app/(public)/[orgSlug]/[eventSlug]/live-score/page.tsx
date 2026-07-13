'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getPusherClient } from '@/lib/pusher/client'
import { Spinner } from '@/components/spinner'

type PesertaAktif = {
  id: string
  no_urut: string
  anggota: string[]
  kontingen: { nama: string; kode: string } | null
  kategori: string
  golongan: string
  nilai_akhir: number
  jumlah_juri: number
}

type PesertaRingkas = {
  id: string
  no_urut: string
  anggota: string[]
  kontingen: { nama: string; kode: string } | null
  kategori: string
  golongan: string
}

type GelanggangLive = {
  id: string
  nama: string
  peserta_aktif: PesertaAktif | null
  antrian: PesertaRingkas[]
  total_antrian: number
}

export default function LiveScorePage() {
  const { orgSlug, eventSlug } = useParams()
  const [eventId, setEventId] = useState('')
  const [gelanggangList, setGelanggangList] = useState<GelanggangLive[]>([])
  const [waktuMap, setWaktuMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activeGelId, setActiveGelId] = useState('')
  const [expandedAntrian, setExpandedAntrian] = useState<Record<string, boolean>>({})

  // Load event + initial live score data
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/public/${orgSlug}/${eventSlug}`)
      if (!res.ok) { setLoading(false); return }
      const { event } = await res.json()
      setEventId(event.id)
      const lsRes = await fetch(`/api/events/${event.id}/live-score`)
      const { data } = await lsRes.json()
      setGelanggangList(data || [])
      setLoading(false)
    }
    load()
  }, [orgSlug, eventSlug])

  // Subscribe to Pusher
  useEffect(() => {
    if (!eventId) return
    const pusher = getPusherClient()
    if (!pusher) return

    const channel = pusher.subscribe(`event-${eventId}`)

    channel.bind('gelanggang-update', () => {
      fetch(`/api/events/${eventId}/live-score`)
        .then(r => r.json())
        .then(({ data }) => setGelanggangList(data || []))
    })

    channel.bind('waktu-tampil-update', (data: { peserta_id: string; waktu_detik: number }) => {
      setWaktuMap(prev => ({ ...prev, [data.peserta_id]: data.waktu_detik }))
    })

    channel.bind('nilai-update', (data: { peserta_id: string; nilai_akhir: number }) => {
      setGelanggangList(prev => prev.map(g => {
        if (g.peserta_aktif?.id === data.peserta_id) {
          return {
            ...g,
            peserta_aktif: {
              ...g.peserta_aktif,
              nilai_akhir: data.nilai_akhir,
              jumlah_juri: (g.peserta_aktif.jumlah_juri || 0) + 1,
            }
          }
        }
        return g
      }))
    })

    return () => { channel.unbind_all(); pusher.unsubscribe(`event-${eventId}`) }
  }, [eventId])

  // Auto-select first gelanggang
  useEffect(() => {
    if (gelanggangList.length > 0 && !activeGelId) {
      setActiveGelId(gelanggangList[0].id)
    }
  }, [gelanggangList, activeGelId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-coklat">
        <Spinner className="h-5 w-5" />
        Memuat live score...
      </div>
    )
  }

  if (gelanggangList.length === 0) {
    return (
      <div className="rounded-xl bg-putih-gading p-12 text-center shadow">
        <div className="text-4xl mb-3">🏟️</div>
        <p className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua">Event belum dimulai</p>
        <p className="text-sm text-coklat mt-1">Live score akan muncul saat gelanggang diaktifkan oleh admin.</p>
      </div>
    )
  }

  const activeGel = gelanggangList.find(g => g.id === activeGelId) || gelanggangList[0]

  return (
    <div className="space-y-6">
      {/* Gelanggang Tabs */}
      {gelanggangList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {gelanggangList.map(g => (
            <button
              key={g.id}
              onClick={() => setActiveGelId(g.id)}
              className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition whitespace-nowrap ${
                activeGel?.id === g.id
                  ? 'bg-hijau-tua text-emas-terang shadow-md'
                  : 'bg-white text-coklat hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {g.peserta_aktif && (
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
              {g.nama}
            </button>
          ))}
        </div>
      )}

      {/* Single Gelanggang Header */}
      {gelanggangList.length === 1 && (
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua">🏟️ {activeGel.nama}</span>
          {activeGel.peserta_aktif && (
            <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold text-white animate-pulse">
              LIVE
            </span>
          )}
        </div>
      )}

      {/* Peserta Tampil Card */}
      <div className="rounded-2xl overflow-hidden shadow-lg">
        {activeGel.peserta_aktif ? (
          <PesertaTampilCard
            peserta={activeGel.peserta_aktif}
            waktuDetik={waktuMap[activeGel.peserta_aktif.id]}
          />
        ) : (
          <div className="bg-gradient-to-br from-hijau-tua to-hijau-sedang p-8 text-center">
            <p className="text-emas-terang text-sm font-bold opacity-80">Menunggu peserta tampil...</p>
          </div>
        )}
      </div>

      {/* Antrian Berikutnya */}
      <AntrianSection
        antrian={activeGel.antrian}
        totalAntrian={activeGel.total_antrian}
        expanded={!!expandedAntrian[activeGel.id]}
        onToggle={() => setExpandedAntrian(prev => ({ ...prev, [activeGel.id]: !prev[activeGel.id] }))}
      />
    </div>
  )
}

/* ==================== PESERTA TAMPIL CARD ==================== */
function PesertaTampilCard({ peserta, waktuDetik }: { peserta: PesertaAktif; waktuDetik?: number }) {
  const formatWaktu = (d?: number) => {
    if (d === undefined || d === null) return null
    const m = Math.floor(d / 60)
    const s = d % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const waktuFormatted = formatWaktu(waktuDetik)

  const getNilaiColor = (n: number) => {
    if (n >= 230) return 'text-green-500'
    if (n >= 210) return 'text-emas-terang'
    return 'text-white'
  }

  return (
    <div className="bg-gradient-to-br from-hijau-tua to-hijau-sedang p-6 text-putih-gading">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-emas-terang text-[10px] font-bold uppercase tracking-wider">▶ Sedang Tampil</span>
        </div>
        {waktuFormatted ? (
          <div className="flex items-center gap-2">
            <span className="text-emas-terang text-[10px] font-bold uppercase tracking-wider">Waktu</span>
            <span className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xl font-bold text-emas-terang">
              {waktuFormatted}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-white/40 italic">Waktu belum dikirim</span>
        )}
      </div>

      {/* Peserta Info */}
      <div className="mb-4">
        <div className="text-xl font-bold text-white leading-tight">
          {(peserta.anggota || []).join(', ')}
        </div>
        <div className="mt-1 text-sm text-white/80">
          <span className="font-mono">{peserta.no_urut}</span>
          <span className="mx-1.5">·</span>
          {peserta.kontingen?.nama || '-'}
          <span className="mx-1.5">·</span>
          {peserta.kategori}
          <span className="mx-1.5">·</span>
          {peserta.golongan}
        </div>
      </div>

      {/* Nilai Section */}
      <div className="flex items-end justify-between rounded-xl bg-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] font-bold text-emas-terang uppercase tracking-wider">Nilai Akhir</div>
          <div className={`font-[family-name:var(--font-cinzel)] text-4xl font-bold mt-0.5 ${getNilaiColor(peserta.nilai_akhir)}`}>
            {peserta.nilai_akhir || 0}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Juri Menilai</div>
          <div className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-white">
            {peserta.jumlah_juri}
            <span className="text-sm text-white/50">/5</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==================== ANTRIAN SECTION ==================== */
function AntrianSection({ antrian, totalAntrian, expanded, onToggle }: {
  antrian: PesertaRingkas[]
  totalAntrian: number
  expanded: boolean
  onToggle: () => void
}) {
  const visibleItems = expanded ? antrian : antrian.slice(0, 5)
  const hiddenCount = totalAntrian - 5

  return (
    <div className="rounded-2xl border-l-4 border-emas bg-putih-gading shadow">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-[family-name:var(--font-cinzel)] text-sm font-bold text-hijau-tua uppercase">
            Peserta Berikutnya
          </h3>
          <span className="rounded-full bg-hijau-tua/10 px-2.5 py-0.5 text-[10px] font-bold text-hijau-tua">
            {totalAntrian}
          </span>
        </div>

        {totalAntrian === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4">Antrian kosong</p>
        ) : (
          <div className="space-y-2">
            {visibleItems.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm border border-gray-100"
              >
                {/* Urutan */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-hijau-tua/5 font-[family-name:var(--font-cinzel)] text-xs font-bold text-hijau-tua">
                  {idx + 1}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-hijau-tua truncate">
                    {(p.anggota || []).join(', ')}
                  </div>
                  <div className="text-[11px] text-coklat truncate mt-0.5">
                    {p.no_urut} · {p.kontingen?.nama || '-'} · {p.kategori} · {p.golongan}
                  </div>
                </div>
                {/* Badge */}
                <span className="flex-shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500">
                  Menunggu
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Lihat Selengkapnya */}
        {totalAntrian > 5 && (
          <button
            onClick={onToggle}
            className="mt-3 w-full rounded-lg border-2 border-dashed border-hijau-sedang/30 py-2.5 text-center text-sm font-bold text-hijau-sedang hover:bg-hijau-tua/5 transition"
          >
            {expanded ? 'Tampilkan Lebih Sedikit' : `Lihat Selengkapnya (${hiddenCount} lagi)`}
          </button>
        )}
      </div>
    </div>
  )
}
