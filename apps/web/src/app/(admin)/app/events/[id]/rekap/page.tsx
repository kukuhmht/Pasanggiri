'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getPusherClient } from '@/lib/pusher/client'

type NilaiRow = {
  id: string
  peserta_id: string
  posisi_juri: string
  nama_juri: string
  waktu_detik: number
  keluar_gelanggang: number
  nilai: Record<string, number>
  total: number
  peserta: {
    id: string; no_urut: string; kategori: string; golongan: string
    anggota: string[]; kontingen: { nama: string } | null
  }
}

const KRITERIA_KEYS = [
  'orisinalitas', 'kemantapan', 'stamina', 'kekompakan',
  'kreatifitas', 'kekayaanTeknik', 'teknikSerangBela', 'penghayatan'
]
const KRITERIA_SHORT: Record<string, string> = {
  orisinalitas: 'ORI', kemantapan: 'KMT', stamina: 'STM', kekompakan: 'KKP',
  kreatifitas: 'KRT', kekayaanTeknik: 'KKT', teknikSerangBela: 'TSB', penghayatan: 'PGH'
}
const KRITERIA_PER_KATEGORI: Record<string, string[]> = {
  'PERORANGAN': ['orisinalitas', 'kemantapan', 'stamina'],
  'BERPASANGAN': ['teknikSerangBela', 'kemantapan', 'penghayatan'],
  'BERKELOMPOK': ['orisinalitas', 'kemantapan', 'kekompakan'],
  'MASSAL': ['orisinalitas', 'kemantapan', 'kekompakan', 'kreatifitas'],
  'ATT': ['orisinalitas', 'kemantapan', 'kekayaanTeknik'],
}

const JURI_LIST = ['Juri 1', 'Juri 2', 'Juri 3', 'Juri 4', 'Juri 5']

const KRITERIA_META: Record<string, { nama: string; min: number; max: number }> = {
  orisinalitas: { nama: 'ORISINALITAS', min: 14, max: 50 },
  kemantapan: { nama: 'KEMANTAPAN', min: 20, max: 25 },
  stamina: { nama: 'STAMINA', min: 20, max: 25 },
  kekompakan: { nama: 'KEKOMPAKAN', min: 14, max: 25 },
  kreatifitas: { nama: 'KREATIFITAS', min: 20, max: 25 },
  kekayaanTeknik: { nama: 'KEKAYAAN TEKNIK', min: 20, max: 25 },
  teknikSerangBela: { nama: 'TEKNIK SERANG BELA', min: 45, max: 50 },
  penghayatan: { nama: 'PENGHAYATAN', min: 20, max: 25 },
}

const ORISINALITAS_RANGE: Record<string, { min: number; max: number }> = {
  'MASSAL': { min: 14, max: 25 },
  'ATT': { min: 35, max: 50 },
  'DEFAULT': { min: 39, max: 50 },
}

type Peserta = { id: string; no_urut: string; kategori: string; golongan: string; anggota: string[]; kontingen: { nama: string } | null }

export default function RekapPage() {
  const { id: eventId } = useParams()
  const [rows, setRows] = useState<NilaiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterKategori, setFilterKategori] = useState('')
  const [filterGolongan, setFilterGolongan] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [showTambah, setShowTambah] = useState(false)
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({})
  const rowsRef = useRef<NilaiRow[]>([])

  useEffect(() => { rowsRef.current = rows }, [rows])

  useEffect(() => { loadData() }, [])

  // Subscribe to Pusher for real-time nilai updates
  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher || !eventId) return

    const channel = pusher.subscribe(`event-${eventId}`)
    channel.bind('nilai-update', () => {
      // Auto-reload data when any juri submits a score
      loadData()
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`event-${eventId}`)
    }
  }, [eventId])

  async function loadData() {
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}/nilai`)
    const { data } = await res.json()
    setRows(data || [])
    setLoading(false)
  }

  const filtered = rows.filter(r =>
    (!filterKategori || r.peserta?.kategori === filterKategori) &&
    (!filterGolongan || r.peserta?.golongan === filterGolongan)
  )

  // Group by peserta for display
  const grouped: Record<string, NilaiRow[]> = {}
  filtered.forEach(r => {
    const key = r.peserta?.no_urut || r.peserta_id
    ;(grouped[key] = grouped[key] || []).push(r)
  })

  function detikToMMSS(d: number) {
    return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`
  }

  function mmssToDetik(val: string): number {
    const parts = val.replace(/[^0-9:]/g, '').split(':')
    if (parts.length === 2) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0)
    return parseInt(val) || 0
  }

  // Save cell change (debounced)
  function updateCell(rowId: string, field: string, value: number | string) {
    // Update local state immediately
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      if (field === 'waktu_detik') return { ...r, waktu_detik: value as number }
      if (field === 'keluar_gelanggang') return { ...r, keluar_gelanggang: value as number }
      return { ...r, nilai: { ...r.nilai, [field]: value as number } }
    }))

    // Debounce API call
    if (debounceRef.current[rowId]) clearTimeout(debounceRef.current[rowId])
    debounceRef.current[rowId] = setTimeout(() => saveRow(rowId), 600)
  }

  async function saveRow(rowId: string) {
    // Use ref to get latest local state (avoid stale closure from debounce timeout)
    const current = rowsRef.current.find(r => r.id === rowId)
    if (!current) return
    setSaving(rowId)

    await fetch(`/api/events/${eventId}/nilai/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nilai: current.nilai,
        waktu_detik: current.waktu_detik,
        keluar_gelanggang: current.keluar_gelanggang,
        kategori: current.peserta?.kategori || '',
      })
    })
    // Reload to get updated total from server
    const res = await fetch(`/api/events/${eventId}/nilai`)
    const { data } = await res.json()
    setRows(data || [])
    setSaving(null)
  }

  async function deleteNilai(rowId: string) {
    if (!confirm('Hapus penilaian ini?')) return
    await fetch(`/api/events/${eventId}/nilai/${rowId}`, { method: 'DELETE' })
    setRows(prev => prev.filter(r => r.id !== rowId))
  }

  // Determine which kriteria columns to show
  const activeKriteria = filterKategori
    ? KRITERIA_PER_KATEGORI[filterKategori] || KRITERIA_KEYS
    : KRITERIA_KEYS

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/app/events/${eventId}`} className="text-sm text-coklat hover:underline">← Detail Event</Link>
        <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">Rekap Nilai</h2>
        <button onClick={() => setShowTambah(true)} className="ml-auto rounded-lg bg-hijau-tua px-4 py-2 text-xs font-bold text-emas-terang hover:brightness-110">
          + Tambah Nilai
        </button>
        <button onClick={loadData} className="rounded bg-gray-100 px-3 py-1 text-xs font-bold hover:bg-gray-200">↻</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)}
          className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none">
          <option value="">Semua</option>
          {['PERORANGAN', 'BERPASANGAN', 'BERKELOMPOK', 'MASSAL', 'ATT'].map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={filterGolongan} onChange={e => setFilterGolongan(e.target.value)}
          className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none">
          <option value="">Semua</option>
          {['Usia Dini', 'Pra Remaja', 'Remaja', 'Dewasa', 'Pembina', 'Istimewa', 'Campuran'].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Info */}
      <div className="rounded-lg bg-putih-gading border border-emas/30 px-4 py-2 text-xs text-coklat">
        Mode Admin: klik sel kriteria untuk mengedit langsung (seperti spreadsheet). Tersimpan otomatis saat berpindah sel.
      </div>

      {loading ? (
        <div className="py-8 text-center text-coklat">Memuat rekap...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-center text-sm text-coklat py-8">Belum ada data penilaian.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow">
          <table className="w-full text-xs whitespace-nowrap border-collapse">
            <thead>
              <tr className="bg-hijau-tua text-[10px] font-bold uppercase text-putih-gading">
                <th className="px-2 py-2 text-left sticky left-0 bg-hijau-tua z-10">No. Urut</th>
                <th className="px-2 py-2 text-left">Nama</th>
                <th className="px-2 py-2">Kontingen</th>
                <th className="px-2 py-2">Kat</th>
                <th className="px-2 py-2">Gol</th>
                <th className="px-2 py-2">Juri</th>
                <th className="px-2 py-2">Nama Juri</th>
                <th className="px-2 py-2">Waktu</th>
                <th className="px-2 py-2">KG</th>
                {activeKriteria.map(k => (
                  <th key={k} className="px-2 py-2">{KRITERIA_SHORT[k]}</th>
                ))}
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">Tertinggi</th>
                <th className="px-2 py-2">Terendah</th>
                <th className="px-2 py-2">Orisinalitas</th>
                <th className="px-2 py-2">Σ Juri</th>
                <th className="px-2 py-2 font-extrabold">Nilai Akhir</th>
                <th className="px-2 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped)
                .map(([noUrut, juriRows]) => {
                  // Calculate summary for this peserta group (trimmed mean)
                  const totals = juriRows.map(r => Number(r.total) || 0)
                  const jumlahJuri = totals.length
                  const sum = totals.reduce((a, b) => a + b, 0)
                  const tertinggi = jumlahJuri > 0 ? Math.max(...totals) : null
                  const terendah = jumlahJuri > 0 ? Math.min(...totals) : null
                  const nilaiAkhir = jumlahJuri >= 3 ? sum - tertinggi! - terendah! : sum

                  // Orisinalitas trimmed mean
                  const orisScores = juriRows.map(r => Number(r.nilai?.orisinalitas) || 0)
                  let orisResult = orisScores.reduce((a, b) => a + b, 0)
                  if (jumlahJuri >= 3) {
                    const maxIdx = totals.indexOf(Math.max(...totals))
                    const minIdx = totals.indexOf(Math.min(...totals))
                    orisResult = orisScores.reduce((sum, v, i) => (i === maxIdx || i === minIdx) ? sum : sum + v, 0)
                  }

                  return { noUrut, juriRows, totals, jumlahJuri, sum, tertinggi, terendah, nilaiAkhir, orisResult }
                })
                // Sort: Nilai Akhir tertinggi, tiebreaker Orisinalitas tertinggi
                .sort((a, b) => b.nilaiAkhir - a.nilaiAkhir || b.orisResult - a.orisResult)
                .map(({ noUrut, juriRows, jumlahJuri, tertinggi, terendah, nilaiAkhir, orisResult }) =>
                  juriRows.map((row, idx) => {
                  const isLast = idx === juriRows.length - 1
                  return (
                    <tr key={row.id} className={`border-b hover:bg-emas/5 ${saving === row.id ? 'bg-green-50' : ''}`}>
                      <td className={`px-2 py-1.5 font-mono font-bold text-hijau-tua sticky left-0 bg-white z-10`}>
                        {idx === 0 ? noUrut : ''}
                      </td>
                      <td className="px-2 py-1.5 max-w-[120px] truncate">
                        {idx === 0 ? (row.peserta?.anggota || []).join(', ') : ''}
                      </td>
                      <td className="px-2 py-1.5 text-center">{row.peserta?.kontingen?.nama || '-'}</td>
                      <td className="px-2 py-1.5 text-center">{row.peserta?.kategori}</td>
                      <td className="px-2 py-1.5 text-center">{row.peserta?.golongan}</td>
                      <td className="px-2 py-1.5 text-center font-medium">{row.posisi_juri}</td>
                      <td className="px-2 py-1.5 max-w-[100px] truncate">{row.nama_juri}</td>

                      {/* Waktu — editable */}
                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={detikToMMSS(row.waktu_detik)}
                          onSave={(val) => updateCell(row.id, 'waktu_detik', mmssToDetik(val))}
                          className="w-[52px] text-center text-hijau-tua font-bold"
                        />
                      </td>

                      {/* KG — editable */}
                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={String(row.keluar_gelanggang || 0)}
                          onSave={(val) => updateCell(row.id, 'keluar_gelanggang', parseInt(val) || 0)}
                          className="w-[32px] text-center"
                        />
                      </td>

                      {/* Kriteria — editable */}
                      {activeKriteria.map(key => (
                        <td key={key} className="px-1 py-0.5">
                          <EditableCell
                            value={String(row.nilai?.[key] ?? '')}
                            onSave={(val) => updateCell(row.id, key, parseFloat(val) || 0)}
                            className="w-[38px] text-center font-bold"
                          />
                        </td>
                      ))}

                      {/* Total per juri */}
                      <td className="px-2 py-1.5 text-center font-bold">{row.total}</td>

                      {/* Summary columns — only on last row of group */}
                      {isLast ? (
                        <>
                          <td className="px-2 py-1.5 text-center text-red-600 font-bold">{tertinggi ?? '-'}</td>
                          <td className="px-2 py-1.5 text-center text-blue-600 font-bold">{terendah ?? '-'}</td>
                          <td className="px-2 py-1.5 text-center font-bold">{orisResult}</td>
                          <td className="px-2 py-1.5 text-center font-bold">{jumlahJuri}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className="inline-block rounded bg-hijau-tua px-2 py-1 text-sm font-extrabold text-emas-terang">
                              {nilaiAkhir}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td></td><td></td><td></td><td></td><td></td>
                        </>
                      )}

                      {/* Aksi: hapus */}
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => deleteNilai(row.id)} className="text-red-500 hover:text-red-700" title="Hapus nilai">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showTambah && <TambahNilaiModal eventId={eventId as string} onClose={() => { setShowTambah(false); loadData() }} />}
    </div>
  )
}

/* ==================== TAMBAH NILAI MODAL ==================== */
function TambahNilaiModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [pesertaList, setPesertaList] = useState<Peserta[]>([])
  const [search, setSearch] = useState('')
  const [selectedPeserta, setSelectedPeserta] = useState<Peserta | null>(null)
  const [juri, setJuri] = useState('')
  const [namaJuri, setNamaJuri] = useState('')
  const [nilai, setNilai] = useState<Record<string, number>>({})
  const [waktuMenit, setWaktuMenit] = useState('')
  const [waktuDetik, setWaktuDetik] = useState('')
  const [keluarGelanggang, setKeluarGelanggang] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPeserta() }, [])

  async function loadPeserta() {
    const res = await fetch(`/api/events/${eventId}/peserta`)
    const { data } = await res.json()
    setPesertaList(data || [])
    setLoading(false)
  }

  const filteredPeserta = pesertaList.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.no_urut.toLowerCase().includes(q) ||
      (p.anggota || []).some(a => a.toLowerCase().includes(q)) ||
      p.kontingen?.nama.toLowerCase().includes(q)
  })

  function selectPeserta(p: Peserta) {
    setSelectedPeserta(p)
    setSearch('')
    setNilai({})
    setWaktuMenit('')
    setWaktuDetik('')
    setKeluarGelanggang(0)
    setMessage('')
  }

  const kriteriaKeys = selectedPeserta ? (KRITERIA_PER_KATEGORI[selectedPeserta.kategori] || []) : []

  function getRange(key: string, kategori: string) {
    if (key === 'orisinalitas') return ORISINALITAS_RANGE[kategori] || ORISINALITAS_RANGE.DEFAULT
    return KRITERIA_META[key] || { min: 0, max: 100 }
  }

  const waktuTotal = (parseInt(waktuMenit) || 0) * 60 + (parseInt(waktuDetik) || 0)

  async function handleSubmit() {
    if (!selectedPeserta) return setMessage('Pilih peserta terlebih dahulu.')
    if (!juri) return setMessage('Pilih posisi juri.')
    if (!namaJuri.trim()) return setMessage('Nama juri wajib diisi.')
    if (waktuTotal <= 0) return setMessage('Isi waktu tampil.')

    setSaving(true)
    setMessage('')
    const res = await fetch(`/api/events/${eventId}/nilai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peserta_id: selectedPeserta.id,
        posisi_juri: juri,
        nama_juri: namaJuri.trim(),
        nilai,
        waktu_detik: waktuTotal,
        keluar_gelanggang: keluarGelanggang,
        kategori: selectedPeserta.kategori,
      })
    })
    const result = await res.json()
    setSaving(false)

    if (!res.ok) return setMessage(result.error || 'Gagal menyimpan.')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-putih-gading shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-putih-gading border-b-2 border-emas px-6 py-4 flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua">Tambah Nilai Manual</h3>
          <button onClick={onClose} className="text-2xl text-coklat hover:text-hijau-tua">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {!selectedPeserta ? (
            <div className="space-y-3">
              <label className="text-sm font-bold text-coklat">Cari & Pilih Peserta</label>
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none"
                placeholder="Cari no. urut, nama peserta, atau kontingen..." autoFocus />
              
              {loading ? (
                <p className="text-sm text-center text-coklat py-4">Memuat peserta...</p>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-1 rounded-lg border-2 border-gray-200 p-2">
                  {filteredPeserta.slice(0, 30).map(p => (
                    <button key={p.id} onClick={() => selectPeserta(p)}
                      className="w-full flex items-start justify-between rounded px-3 py-2 text-left text-sm hover:bg-emas/10 transition border border-transparent hover:border-emas">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-hijau-tua">{(p.anggota || []).join(', ')}</div>
                        <div className="text-xs text-gray-500">{p.kategori} · {p.golongan} · {p.kontingen?.nama || '-'}</div>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 ml-2 flex-shrink-0">{p.no_urut}</span>
                    </button>
                  ))}
                  {filteredPeserta.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Tidak ditemukan.</p>}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-hijau-tua/5 border-2 border-emas p-3 text-sm space-y-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs font-bold text-hijau-sedang uppercase">Peserta Terpilih</div>
                    <div className="font-bold text-hijau-tua mt-1">{(selectedPeserta.anggota || []).join(', ')}</div>
                    <div className="text-xs text-coklat mt-0.5">
                      {selectedPeserta.no_urut} · {selectedPeserta.kategori} · {selectedPeserta.golongan} · {selectedPeserta.kontingen?.nama || '-'}
                    </div>
                  </div>
                  <button onClick={() => setSelectedPeserta(null)} className="text-xs text-coklat hover:underline ml-2 flex-shrink-0">
                    Ganti
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-coklat">Posisi Juri</label>
                  <select value={juri} onChange={e => setJuri(e.target.value)}
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none">
                    <option value="">Pilih...</option>
                    {JURI_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-coklat">Nama Juri</label>
                  <input value={namaJuri} onChange={e => setNamaJuri(e.target.value)}
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none"
                    placeholder="Nama lengkap" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-coklat">Input Nilai Kriteria</label>
                {kriteriaKeys.map(key => {
                  const meta = KRITERIA_META[key]
                  const range = getRange(key, selectedPeserta.kategori)
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm">
                        <label className="font-semibold text-coklat">{meta.nama}</label>
                        <span className="text-xs text-gray-400">{range.min}–{range.max}</span>
                      </div>
                      <input type="number" inputMode="numeric"
                        min={range.min} max={range.max}
                        value={nilai[key] ?? ''} onChange={e => setNilai(n => ({ ...n, [key]: parseFloat(e.target.value) || 0 }))}
                        className={`mt-1 w-full rounded-lg border-2 px-3 py-2 focus:outline-none ${
                          nilai[key] !== undefined && (nilai[key] < range.min || nilai[key] > range.max)
                            ? 'border-merah-error bg-red-50' : 'border-gray-200 focus:border-emas'
                        }`} />
                    </div>
                  )
                })}
              </div>

              <div>
                <label className="text-sm font-semibold text-coklat">Waktu Tampil (mm:ss)</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" inputMode="numeric" min="0" max="59" placeholder="mm"
                    value={waktuMenit} onChange={e => setWaktuMenit(e.target.value)}
                    className="w-20 rounded-lg border-2 border-gray-200 px-3 py-2 text-center focus:border-emas focus:outline-none" />
                  <span className="text-xl font-bold text-coklat">:</span>
                  <input type="number" inputMode="numeric" min="0" max="59" placeholder="ss"
                    value={waktuDetik} onChange={e => setWaktuDetik(e.target.value)}
                    className="w-20 rounded-lg border-2 border-gray-200 px-3 py-2 text-center focus:border-emas focus:outline-none" />
                </div>
              </div>

              {selectedPeserta.kategori === 'BERPASANGAN' && (
                <div>
                  <label className="text-sm font-semibold text-coklat">Keluar Gelanggang (kali)</label>
                  <input type="number" inputMode="numeric" min="0" value={keluarGelanggang}
                    onChange={e => setKeluarGelanggang(parseInt(e.target.value) || 0)}
                    className="mt-1 w-24 rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none" />
                  {keluarGelanggang > 0 && (
                    <p className="mt-1 text-xs font-bold text-merah-error">{keluarGelanggang}× keluar → −{keluarGelanggang * 5} poin</p>
                  )}
                </div>
              )}

              {message && (
                <p className={`text-sm font-semibold ${message.includes('tersimpan') ? 'text-hijau-sedang' : 'text-merah-error'}`}>
                  {message}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={handleSubmit} disabled={saving}
                  className="flex-1 rounded-lg bg-hijau-tua py-3 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Simpan Penilaian'}
                </button>
                <button onClick={onClose} className="rounded-lg border-2 border-gray-200 px-6 py-3 font-bold text-coklat hover:bg-gray-50">
                  Batal
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ==================== EDITABLE CELL COMPONENT ==================== */
function EditableCell({ value, onSave, className = '' }: { value: string; onSave: (val: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [localVal, setLocalVal] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocalVal(value) }, [value])

  function startEdit() {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    setEditing(false)
    if (localVal !== value) {
      onSave(localVal)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { commitEdit(); (e.target as HTMLInputElement).blur() }
    if (e.key === 'Escape') { setLocalVal(value); setEditing(false) }
    if (e.key === 'Tab') { commitEdit() }
  }

  if (!editing) {
    return (
      <div
        onClick={startEdit}
        className={`cursor-pointer rounded border border-transparent px-1 py-1 hover:border-emas hover:bg-emas/5 transition ${className}`}
      >
        {value || <span className="text-gray-300">-</span>}
      </div>
    )
  }

  return (
    <input
      ref={inputRef}
      value={localVal}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={handleKey}
      autoFocus
      className={`rounded border-2 border-emas bg-white px-1 py-0.5 outline-none ${className}`}
    />
  )
}
