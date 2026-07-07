'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

type RekapRow = {
  peserta_id: string; no_urut: string; kategori: string; golongan: string
  anggota: string[]; kontingen: { nama: string } | null
  jumlah_juri: number; nilai_akhir: number
}

export default function HasilPage() {
  const { orgSlug, eventSlug } = useParams()
  const [eventId, setEventId] = useState('')
  const [rekap, setRekap] = useState<RekapRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterKategori, setFilterKategori] = useState('')
  const [filterGolongan, setFilterGolongan] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const res = await fetch(`/api/public/${orgSlug}/${eventSlug}`)
    if (!res.ok) { setLoading(false); return }
    const { event } = await res.json()
    setEventId(event.id)
    const rRes = await fetch(`/api/events/${event.id}/rekap`)
    const { data } = await rRes.json()
    setRekap(data || [])
    setLoading(false)
  }

  if (loading) return <div className="py-12 text-center text-coklat">Memuat hasil...</div>
  if (!eventId) return <div className="py-12 text-center text-merah-error">Event tidak ditemukan.</div>

  // Group by kategori+golongan
  const filtered = rekap.filter(r =>
    (!filterKategori || r.kategori === filterKategori) &&
    (!filterGolongan || r.golongan === filterGolongan)
  )

  const groups: Record<string, RekapRow[]> = {}
  filtered.forEach(r => {
    const key = `${r.kategori}||${r.golongan}`
    ;(groups[key] = groups[key] || []).push(r)
  })

  // Juara umum: medali per kontingen
  const medali: Record<string, { emas: number; perak: number; perunggu: number }> = {}
  Object.values(groups).forEach(arr => {
    arr.sort((a, b) => b.nilai_akhir - a.nilai_akhir)
    arr.slice(0, 3).forEach((r, i) => {
      const m = medali[r.kontingen?.nama || '?'] = medali[r.kontingen?.nama || '?'] || { emas: 0, perak: 0, perunggu: 0 }
      if (i === 0) m.emas++; else if (i === 1) m.perak++; else m.perunggu++
    })
  })
  const juara = Object.entries(medali)
    .map(([kontingen, m]) => ({ kontingen, ...m, poin: m.emas * 3 + m.perak * 2 + m.perunggu }))
    .sort((a, b) => b.poin - a.poin || b.emas - a.emas || b.perak - a.perak)

  const medalIcons = ['🥇', '🥈', '🥉']
  const medalLabels = ['EMAS', 'SILVER', 'PERUNGGU']

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">Semua Kategori</option>
          {['PERORANGAN', 'BERPASANGAN', 'BERKELOMPOK', 'MASSAL', 'ATT'].map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={filterGolongan} onChange={e => setFilterGolongan(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">Semua Golongan</option>
          {['Usia Dini', 'Pra Remaja', 'Remaja', 'Dewasa', 'Pembina', 'Istimewa', 'Campuran'].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Juara Umum */}
      {juara.length > 0 && (
        <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-6 shadow">
          <h2 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-4">👑 Juara Umum (Kontingen)</h2>
          <div className="space-y-2">
            {juara.map((j, i) => (
              <div key={j.kontingen} className={`flex items-center gap-3 rounded-lg p-3 ${
                i === 0 ? 'bg-gradient-to-r from-yellow-50 to-transparent border-l-4 border-yellow-400' :
                i === 1 ? 'bg-gradient-to-r from-gray-50 to-transparent border-l-4 border-gray-300' :
                i === 2 ? 'bg-gradient-to-r from-orange-50 to-transparent border-l-4 border-orange-400' :
                'border-l-4 border-gray-200'
              }`}>
                <span className="text-2xl">{medalIcons[i] || '🏅'}</span>
                <div className="flex-1">
                  <div className="font-[family-name:var(--font-cinzel)] font-bold text-hijau-tua">{j.kontingen}</div>
                  <div className="text-xs text-coklat">🥇{j.emas} 🥈{j.perak} 🥉{j.perunggu}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-coklat">POIN</div>
                  <div className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">{j.poin}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] italic text-coklat">
            Poin: Emas ×3 · Silver ×2 · Perunggu ×1
          </p>
        </div>
      )}

      {/* Per-group results */}
      {Object.keys(groups).length === 0 ? (
        <div className="rounded-xl bg-putih-gading p-8 text-center shadow">
          <p className="text-coklat">Belum ada hasil penilaian.</p>
        </div>
      ) : (
        Object.keys(groups).sort().map(key => {
          const [kat, gol] = key.split('||')
          const arr = groups[key].sort((a, b) => b.nilai_akhir - a.nilai_akhir)
          return (
            <div key={key} className="space-y-3">
              {/* Group header */}
              <div className="rounded-lg bg-gradient-to-br from-hijau-tua to-hijau-sedang border-2 border-emas p-3 flex flex-wrap gap-2 justify-center">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-putih-gading">
                  Kategori <b className="text-emas-terang">{kat}</b>
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-putih-gading">
                  Golongan <b className="text-emas-terang">{gol}</b>
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-putih-gading">
                  Peserta <b className="text-emas-terang">{arr.length}</b>
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {arr.map((r, i) => {
                  const rank = i + 1
                  const isTop3 = rank <= 3
                  return (
                    <div key={r.peserta_id} className={`flex items-center gap-3 rounded-xl bg-putih-gading p-4 shadow ${
                      rank === 1 ? 'border-l-4 border-yellow-400 bg-gradient-to-r from-yellow-50/50' :
                      rank === 2 ? 'border-l-4 border-gray-300' :
                      rank === 3 ? 'border-l-4 border-orange-400 bg-gradient-to-r from-orange-50/30' :
                      'border-l-4 border-gray-200'
                    }`}>
                      {/* Rank */}
                      <div className="min-w-[48px] text-center">
                        {isTop3 ? (
                          <>
                            <div className="text-2xl">{medalIcons[i]}</div>
                            <div className="text-[9px] font-bold text-coklat">{medalLabels[i]}</div>
                          </>
                        ) : (
                          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 font-[family-name:var(--font-cinzel)] text-sm font-bold text-hijau-tua">
                            {rank}
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-hijau-tua text-sm truncate">
                          {(r.anggota || []).join(', ')}
                        </div>
                        <div className="text-xs text-coklat truncate">
                          {r.no_urut} · {r.kontingen?.nama || '-'}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {r.jumlah_juri}/5 Juri menilai
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-coklat">NILAI AKHIR</div>
                        <div className={`font-[family-name:var(--font-cinzel)] text-2xl font-bold ${
                          rank === 1 ? 'text-emas' : rank === 2 ? 'text-gray-600' : rank === 3 ? 'text-orange-700' : 'text-hijau-tua'
                        }`}>
                          {r.nilai_akhir}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
