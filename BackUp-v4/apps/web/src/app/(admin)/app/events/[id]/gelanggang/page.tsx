'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Peserta = { id: string; no_urut: string; kategori: string; golongan: string; anggota: string[]; kontingen: { nama: string } | null }
type Gelanggang = {
  id: string; nama: string; antrian: string[]
  peserta_aktif: Peserta | null
}

export default function GelanggangPage() {
  const { id: eventId } = useParams()
  const [gelanggangList, setGelanggangList] = useState<Gelanggang[]>([])
  const [peserta, setPeserta] = useState<Peserta[]>([])
  const [nilaiCount, setNilaiCount] = useState<Record<string, number>>({}) // peserta_id → jumlah juri
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [gRes, pRes, nRes] = await Promise.all([
      fetch(`/api/events/${eventId}/gelanggang`),
      fetch(`/api/events/${eventId}/peserta`),
      fetch(`/api/events/${eventId}/nilai`),
    ])
    setGelanggangList((await gRes.json()).data || [])
    setPeserta((await pRes.json()).data || [])
    // Count jumlah juri per peserta
    const nilaiData = (await nRes.json()).data || []
    const counts: Record<string, number> = {}
    nilaiData.forEach((n: { peserta_id: string }) => {
      counts[n.peserta_id] = (counts[n.peserta_id] || 0) + 1
    })
    setNilaiCount(counts)
    setLoading(false)
  }

  async function createGelanggang(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await fetch(`/api/events/${eventId}/gelanggang`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: newName.trim() })
    })
    setNewName('')
    setShowAddForm(false)
    loadAll()
  }

  async function deleteGelanggang(gid: string) {
    if (!confirm('Hapus gelanggang ini?')) return
    await fetch(`/api/events/${eventId}/gelanggang/${gid}`, { method: 'DELETE' })
    loadAll()
  }

  async function updateGelanggang(gid: string, updates: { peserta_aktif_id?: string | null; antrian?: string[] }) {
    await fetch(`/api/events/${eventId}/gelanggang/${gid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    loadAll()
  }

  // Selesai tampil: clear peserta aktif, remove from antrian if needed
  async function selesaiTampil(gid: string) {
    await updateGelanggang(gid, { peserta_aktif_id: null })
  }

  // Tampilkan berikutnya: ambil pertama dari antrian → jadi aktif
  async function tampilkanBerikutnya(gid: string) {
    const gel = gelanggangList.find(g => g.id === gid)
    if (!gel || !gel.antrian?.length) return
    const [next, ...rest] = gel.antrian
    await fetch(`/api/events/${eventId}/gelanggang/${gid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peserta_aktif_id: next, antrian: rest })
    })
    loadAll()
  }

  // Remove from antrian
  async function removeFromAntrian(gid: string, idx: number) {
    const gel = gelanggangList.find(g => g.id === gid)
    if (!gel) return
    const antrian = (gel.antrian || []).filter((_, i) => i !== idx)
    await updateGelanggang(gid, { antrian })
  }

  // Add to antrian
  async function addToAntrian(gid: string, pesertaId: string) {
    const gel = gelanggangList.find(g => g.id === gid)
    if (!gel) return
    const antrian = [...(gel.antrian || []), pesertaId]
    await updateGelanggang(gid, { antrian })
  }

  // Drag reorder antrian
  async function reorderAntrian(gid: string, newAntrian: string[]) {
    await updateGelanggang(gid, { antrian: newAntrian })
  }

  function getPesertaInfo(id: string) {
    return peserta.find(p => p.id === id)
  }

  // Collect all peserta IDs that are currently in any gelanggang (antrian or aktif)
  const busyPesertaIds = new Set<string>()
  gelanggangList.forEach(g => {
    if (g.peserta_aktif?.id) busyPesertaIds.add(g.peserta_aktif.id)
    ;(g.antrian || []).forEach(pid => busyPesertaIds.add(pid))
  })

  if (loading) return <div className="py-8 text-center text-coklat">Memuat...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/app/events/${eventId}`} className="text-sm text-coklat hover:underline">← Detail Event</Link>
          <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">
            🏟️ Gelanggang & Antrian Tampil
          </h2>
        </div>
        <button onClick={() => setShowAddForm(v => !v)}
          className="rounded-lg bg-hijau-tua px-4 py-2 text-xs font-bold text-emas-terang hover:brightness-110">
          + Gelanggang
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={createGelanggang} className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            className="flex-1 rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none"
            placeholder="Nama gelanggang (misal: Gelanggang A)" autoFocus />
          <button type="submit" className="rounded-lg bg-hijau-tua px-4 py-2 text-sm font-bold text-emas-terang hover:brightness-110">
            Simpan
          </button>
          <button type="button" onClick={() => setShowAddForm(false)} className="text-sm text-coklat hover:underline">Batal</button>
        </form>
      )}

      {/* Gelanggang list */}
      {gelanggangList.length === 0 ? (
        <p className="text-center text-sm text-coklat py-8">Belum ada gelanggang.</p>
      ) : (
        <div className="space-y-6">
          {gelanggangList.map(g => (
            <GelanggangCard
              key={g.id}
              gel={g}
              peserta={peserta}
              nilaiCount={nilaiCount}
              busyPesertaIds={busyPesertaIds}
              getPesertaInfo={getPesertaInfo}
              onSelesai={() => selesaiTampil(g.id)}
              onNext={() => tampilkanBerikutnya(g.id)}
              onRemoveAntrian={(idx) => removeFromAntrian(g.id, idx)}
              onAddAntrian={(pid) => addToAntrian(g.id, pid)}
              onReorder={(newArr) => reorderAntrian(g.id, newArr)}
              onDelete={() => deleteGelanggang(g.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ==================== GELANGGANG CARD ==================== */
function GelanggangCard({ gel, peserta, nilaiCount, busyPesertaIds, getPesertaInfo, onSelesai, onNext, onRemoveAntrian, onAddAntrian, onReorder, onDelete }: {
  gel: Gelanggang
  peserta: Peserta[]
  nilaiCount: Record<string, number>
  busyPesertaIds: Set<string>
  getPesertaInfo: (id: string) => Peserta | undefined
  onSelesai: () => void
  onNext: () => void
  onRemoveAntrian: (idx: number) => void
  onAddAntrian: (pid: string) => void
  onReorder: (newArr: string[]) => void
  onDelete: () => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  type Peserta = { id: string; no_urut: string; kategori: string; golongan: string; anggota: string[]; kontingen: { nama: string } | null }

  const filteredPeserta = peserta.filter(p => {
    // Exclude peserta yang sudah dinilai >= 3 juri (selesai)
    if ((nilaiCount[p.id] || 0) >= 3) return false
    // Exclude peserta yang sudah di antrian atau aktif di gelanggang MANAPUN
    if (busyPesertaIds.has(p.id)) return false
    // Search filter
    if (!search) return true
    const q = search.toLowerCase()
    return p.no_urut.toLowerCase().includes(q) ||
      (p.anggota || []).some(a => a.toLowerCase().includes(q)) ||
      p.kontingen?.nama.toLowerCase().includes(q)
  })

  function handleDragStart(idx: number) { dragItem.current = idx }
  function handleDragEnter(idx: number) { dragOver.current = idx }
  function handleDragEnd() {
    if (dragItem.current === null || dragOver.current === null) return
    const arr = [...(gel.antrian || [])]
    const [removed] = arr.splice(dragItem.current, 1)
    arr.splice(dragOver.current, 0, removed)
    dragItem.current = null
    dragOver.current = null
    onReorder(arr)
  }

  return (
    <div className="rounded-xl border-l-4 border-emas bg-putih-gading shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className="font-[family-name:var(--font-cinzel)] text-base font-bold text-hijau-tua uppercase">
          {gel.nama}
        </h3>
        <div className="flex items-center gap-2">
          {gel.peserta_aktif && (
            <span className="rounded-full bg-hijau-tua px-3 py-1 text-[10px] font-bold text-emas-terang uppercase">
              Ada Peserta Tampil
            </span>
          )}
          <button onClick={onDelete} className="text-xs text-red-500 hover:underline">Hapus</button>
        </div>
      </div>

      {/* Peserta Aktif */}
      {gel.peserta_aktif ? (
        <div className="mx-5 mb-4 rounded-xl bg-gradient-to-br from-hijau-tua to-hijau-sedang p-4 text-putih-gading">
          <div className="text-[10px] font-bold text-emas-terang uppercase mb-1">▶ Sedang Tampil</div>
          <div className="text-lg font-bold">{(gel.peserta_aktif.anggota || []).join(', ')}</div>
          <div className="text-xs opacity-80 mt-0.5">
            {gel.peserta_aktif.no_urut} · {gel.peserta_aktif.kategori} · {gel.peserta_aktif.golongan}
          </div>
          <button onClick={onSelesai}
            className="mt-3 w-full rounded-lg bg-hijau-sedang/50 py-2.5 text-center text-sm font-bold text-white hover:bg-hijau-sedang/70 transition">
            ✔ Selesai
          </button>
        </div>
      ) : (
        <div className="mx-5 mb-4 rounded-xl border-2 border-dashed border-gray-300 p-4 text-center">
          <p className="text-sm text-gray-400">Tidak ada peserta tampil</p>
          {(gel.antrian || []).length > 0 && (
            <button onClick={onNext}
              className="mt-2 rounded-lg bg-hijau-tua px-4 py-2 text-xs font-bold text-emas-terang hover:brightness-110">
              ▶ Tampilkan Berikutnya
            </button>
          )}
        </div>
      )}

      {/* Antrian */}
      <div className="px-5 pb-4">
        <div className="text-xs font-bold text-coklat mb-2">
          Antrian Berikutnya ({(gel.antrian || []).length})
        </div>

        {(gel.antrian || []).length > 0 ? (
          <div className="space-y-1 mb-3">
            {(gel.antrian || []).map((pid, idx) => {
              const p = getPesertaInfo(pid)
              return (
                <div
                  key={`${pid}-${idx}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition border border-gray-100"
                >
                  <span className="text-gray-400 text-sm select-none">⠿</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">
                      {p ? (p.anggota || []).join(', ') : pid}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">{p?.no_urut || ''}</span>
                  <button onClick={() => onRemoveAntrian(idx)} className="text-red-400 hover:text-red-600 text-sm ml-1">🗑️</button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3">Antrian kosong.</p>
        )}

        {/* Add to antrian */}
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)}
            className="w-full rounded-lg border-2 border-dashed border-hijau-sedang py-2.5 text-center text-sm font-bold text-hijau-sedang hover:bg-hijau-tua/5 transition">
            + Tambah ke Antrian
          </button>
        ) : (
          <div className="rounded-lg border-2 border-emas bg-white p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-emas focus:outline-none"
                placeholder="Cari peserta..." autoFocus />
              <button onClick={() => { setShowAdd(false); setSearch('') }}
                className="text-xs text-coklat hover:underline">Tutup</button>
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {filteredPeserta.slice(0, 20).map(p => (
                <button key={p.id} onClick={() => { onAddAntrian(p.id); setShowAdd(false); setSearch('') }}
                  className="w-full flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-emas/10 transition">
                  <span className="font-medium">{(p.anggota || []).join(', ')}</span>
                  <span className="text-[10px] font-mono text-gray-400">{p.no_urut}</span>
                </button>
              ))}
              {filteredPeserta.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Tidak ditemukan.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
