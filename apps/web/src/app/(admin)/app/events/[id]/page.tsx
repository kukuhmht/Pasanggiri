'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import * as xlsx from 'xlsx'

type Kontingen = { id: string; nama: string; kode: string }
type Peserta = { id: string; no_urut: string; kategori: string; golongan: string; anggota: string[]; kontingen: { nama: string; kode: string } | null }

const KATEGORI = ['PERORANGAN', 'BERPASANGAN', 'BERKELOMPOK', 'MASSAL', 'ATT']
const GOLONGAN = ['Usia Dini', 'Pra Remaja', 'Remaja', 'Dewasa', 'Pembina', 'Istimewa', 'Campuran']

export default function EventDetailPage() {
  const params = useParams()
  const eventId = params.id as string

  const [tab, setTab] = useState<'kontingen' | 'peserta'>('kontingen')
  const [kontingen, setKontingen] = useState<Kontingen[]>([])
  const [peserta, setPeserta] = useState<Peserta[]>([])
  const [nilaiPesertaIds, setNilaiPesertaIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [uploadModal, setUploadModal] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [kRes, pRes, nRes] = await Promise.all([
      fetch(`/api/events/${eventId}/kontingen`),
      fetch(`/api/events/${eventId}/peserta`),
      fetch(`/api/events/${eventId}/nilai`),
    ])
    const kData = await kRes.json()
    const pData = await pRes.json()
    const nData = await nRes.json()
    setKontingen(kData.data || [])
    setPeserta(pData.data || [])
    setNilaiPesertaIds(new Set((nData.data || []).map((n: { peserta_id: string }) => n.peserta_id)))
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/events" className="text-sm text-coklat hover:underline">← Events</Link>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/events/${eventId}/gelanggang`}
          className="rounded-lg bg-hijau-sedang px-4 py-2 text-sm font-bold text-white hover:brightness-110">
          🏟️ Gelanggang
        </Link>
        <Link href={`/app/events/${eventId}/penilaian`}
          className="rounded-lg bg-hijau-sedang px-4 py-2 text-sm font-bold text-white hover:brightness-110">
          👨🏼‍🏫 Penilaian
        </Link>
        <Link href={`/app/events/${eventId}/rekap`}
          className="rounded-lg bg-hijau-sedang px-4 py-2 text-sm font-bold text-white hover:brightness-110">
          🏆 Rekap Nilai
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('kontingen')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === 'kontingen' ? 'bg-hijau-tua text-emas-terang' : 'bg-gray-100 text-coklat hover:bg-gray-200'}`}
        >
          Kontingen ({kontingen.length})
        </button>
        <button
          onClick={() => setTab('peserta')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === 'peserta' ? 'bg-hijau-tua text-emas-terang' : 'bg-gray-100 text-coklat hover:bg-gray-200'}`}
        >
          Peserta ({peserta.length})
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-coklat">Memuat data...</div>
      ) : tab === 'kontingen' ? (
        <KontingenTab eventId={eventId} kontingen={kontingen} onRefresh={loadAll} />
      ) : (
        <PesertaTab eventId={eventId} peserta={peserta} kontingen={kontingen} nilaiPesertaIds={nilaiPesertaIds} onRefresh={loadAll} />
      )}
    </div>
  )
}

/* ==================== KONTINGEN TAB ==================== */
function KontingenTab({ eventId, kontingen, onRefresh }: { eventId: string; kontingen: Kontingen[]; onRefresh: () => void }) {
  const [nama, setNama] = useState('')
  const [kode, setKode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const res = await fetch(`/api/events/${eventId}/kontingen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, kode })
    })
    if (!res.ok) { const r = await res.json(); setError(r.error); setSaving(false); return }
    setNama(''); setKode(''); setSaving(false)
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus kontingen ini?')) return
    await fetch(`/api/events/${eventId}/kontingen/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input value={nama} onChange={e => setNama(e.target.value)}
          className="flex-1 min-w-[140px] rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none"
          placeholder="Nama kontingen" required />
        <input value={kode} onChange={e => setKode(e.target.value)}
          className="w-24 rounded-lg border-2 border-gray-200 px-3 py-2 uppercase focus:border-emas focus:outline-none"
          placeholder="Kode" maxLength={5} required />
        <button type="submit" disabled={saving}
          className="rounded-lg bg-hijau-tua px-4 py-2 text-sm font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
          {saving ? '...' : '+ Tambah'}
        </button>
      </form>
      {error && <p className="text-sm font-semibold text-merah-error">{error}</p>}

      {kontingen.length === 0 ? (
        <p className="py-4 text-center text-sm text-coklat">Belum ada kontingen.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
              <th className="px-4 py-2">Nama</th><th className="px-4 py-2">Kode</th><th className="px-4 py-2 w-16">Aksi</th>
            </tr></thead>
            <tbody>
              {kontingen.map(k => (
                <tr key={k.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{k.nama}</td>
                  <td className="px-4 py-2 font-mono text-xs">{k.kode}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => handleDelete(k.id)} className="text-red-600 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ==================== PESERTA TAB ==================== */
function PesertaTab({ eventId, peserta, kontingen, nilaiPesertaIds, onRefresh }: {
  eventId: string; peserta: Peserta[]; kontingen: Kontingen[]; nilaiPesertaIds: Set<string>; onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kategori: '', golongan: '', kontingen_id: '', anggota: [''] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadModal, setUploadModal] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Edit state
  const [editPeserta, setEditPeserta] = useState<Peserta | null>(null)
  const [editForm, setEditForm] = useState({ kategori: '', golongan: '', kontingen_id: '', anggota: [''] })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Filters
  const [filterKontingen, setFilterKontingen] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [filterGolongan, setFilterGolongan] = useState('')

  function updateAnggota(idx: number, val: string) {
    setForm(f => ({ ...f, anggota: f.anggota.map((a, i) => i === idx ? val : a) }))
  }
  function addAnggota() { setForm(f => ({ ...f, anggota: [...f.anggota, ''] })) }
  function removeAnggota(idx: number) { setForm(f => ({ ...f, anggota: f.anggota.filter((_, i) => i !== idx) })) }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const anggota = form.anggota.map(a => a.trim()).filter(Boolean)
    if (!anggota.length) { setError('Minimal 1 nama peserta.'); return }
    setSaving(true)
    const res = await fetch(`/api/events/${eventId}/peserta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, anggota })
    })
    if (!res.ok) { const r = await res.json(); setError(r.error); setSaving(false); return }
    setShowForm(false)
    setForm({ kategori: '', golongan: '', kontingen_id: '', anggota: [''] })
    setSaving(false)
    onRefresh()
  }

  function openEdit(p: Peserta) {
    setEditPeserta(p)
    setEditForm({
      kategori: p.kategori, golongan: p.golongan,
      kontingen_id: (p as unknown as { kontingen_id?: string }).kontingen_id || '',
      anggota: [...(p.anggota || [])],
    })
    setEditError('')
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editPeserta) return
    setEditError('')
    const anggota = editForm.anggota.map(a => a.trim()).filter(Boolean)
    if (!anggota.length) { setEditError('Minimal 1 nama peserta.'); return }
    setEditSaving(true)
    const res = await fetch(`/api/events/${eventId}/peserta/${editPeserta.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, anggota })
    })
    setEditSaving(false)
    if (!res.ok) { const r = await res.json(); setEditError(r.error || 'Gagal update.'); return }
    setEditPeserta(null)
    onRefresh()
  }

  async function handleDelete(id: string, noUrut: string) {
    if (!confirm(`Hapus peserta ${noUrut}?`)) return
    await fetch(`/api/events/${eventId}/peserta/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    onRefresh()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const allSelectable = filteredPeserta.filter(p => !nilaiPesertaIds.has(p.id))
    if (selectedIds.size === allSelectable.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allSelectable.map(p => p.id)))
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    await fetch(`/api/events/${eventId}/peserta/bulk-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) })
    })
    setBulkDeleting(false)
    setBulkDeleteConfirm(false)
    setSelectedIds(new Set())
    onRefresh()
  }

  const filteredPeserta = peserta.filter(p =>
    (!filterKontingen || p.kontingen?.kode === filterKontingen) &&
    (!filterKategori || p.kategori === filterKategori) &&
    (!filterGolongan || p.golongan === filterGolongan)
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowForm(v => !v)}
          className="rounded-lg bg-hijau-tua px-4 py-2 text-sm font-bold text-emas-terang hover:brightness-110">
          {showForm ? 'Batal' : '+ Tambah Peserta'}
        </button>
        <button onClick={() => window.location.href = `/api/events/${eventId}/peserta/template`}
          className="rounded-lg bg-emas/30 px-4 py-2 text-sm font-bold text-hijau-tua hover:brightness-110">
          📥 Template
        </button>
        <button onClick={() => setUploadModal(true)}
          className="rounded-lg bg-hijau-sedang px-4 py-2 text-sm font-bold text-white hover:brightness-110">
          📤 Upload Excel
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}
              className="rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none" required>
              <option value="">Kategori</option>
              {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select value={form.golongan} onChange={e => setForm(f => ({ ...f, golongan: e.target.value }))}
              className="rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none" required>
              <option value="">Golongan</option>
              {GOLONGAN.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={form.kontingen_id} onChange={e => setForm(f => ({ ...f, kontingen_id: e.target.value }))}
              className="rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none" required>
              <option value="">Kontingen</option>
              {kontingen.map(k => <option key={k.id} value={k.id}>{k.nama} ({k.kode})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-coklat">Anggota</label>
            {form.anggota.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input value={a} onChange={e => updateAnggota(i, e.target.value)}
                  className="flex-1 rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none"
                  placeholder={`Nama peserta ${i + 1}`} />
                {form.anggota.length > 1 && (
                  <button type="button" onClick={() => removeAnggota(i)} className="px-2 text-red-500 font-bold">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addAnggota} className="text-sm font-bold text-hijau-sedang hover:underline">+ Tambah anggota</button>
          </div>
          {error && <p className="text-sm font-semibold text-merah-error">{error}</p>}
          <button type="submit" disabled={saving}
            className="rounded-lg bg-hijau-tua px-6 py-2 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Daftar Peserta'}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterKontingen} onChange={e => setFilterKontingen(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none">
          <option value="">Semua Kontingen</option>
          {kontingen.map(k => <option key={k.id} value={k.kode}>{k.nama}</option>)}
        </select>
        <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none">
          <option value="">Semua Kategori</option>
          {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={filterGolongan} onChange={e => setFilterGolongan(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none">
          <option value="">Semua Golongan</option>
          {GOLONGAN.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Menampilkan {filteredPeserta.length} dari {peserta.length} peserta</p>
        {filteredPeserta.length > 0 && (() => {
          const selectable = filteredPeserta.filter(p => !nilaiPesertaIds.has(p.id))
          return (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-coklat cursor-pointer">
              <input type="checkbox" checked={selectedIds.size === selectable.length && selectable.length > 0} onChange={toggleSelectAll} className="accent-hijau-tua" />
              Pilih Semua
            </label>
          )
        })()}
      </div>

      {filteredPeserta.length === 0 ? (
        <p className="py-4 text-center text-sm text-coklat">Tidak ada peserta sesuai filter.</p>
      ) : (
        <div className="space-y-2">
          {filteredPeserta.map(p => {
            const hasNilai = nilaiPesertaIds.has(p.id)
            const isSelected = selectedIds.has(p.id)
            return (
              <div key={p.id} className={`flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm border ${hasNilai ? 'border-yellow-300 bg-yellow-50/30' : isSelected ? 'border-emas ring-1 ring-emas' : 'border-gray-100'}`}>
                <input type="checkbox" checked={isSelected} disabled={hasNilai} onChange={() => toggleSelect(p.id)} className="accent-hijau-tua flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed" title={hasNilai ? 'Sudah dinilai, tidak bisa dihapus' : ''} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-hijau-tua">{p.no_urut}</span>
                    <span className="rounded bg-hijau-tua/10 px-1.5 py-0.5 text-[10px] font-bold text-hijau-tua">{p.kategori}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{p.golongan}</span>
                    {hasNilai && (
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700" title="Hapus nilai terlebih dahulu">🔒 SUDAH DINILAI</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-800 truncate">
                    {(p.anggota || []).join(', ')}
                  </div>
                  <div className="text-[10px] text-gray-400">{p.kontingen?.nama || '-'}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(p)}
                    className="rounded bg-emas/20 px-2 py-1 text-[10px] font-bold text-emas hover:bg-emas/30">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p.id, p.no_urut)} disabled={hasNilai}
                    className="rounded bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50"
                    title={hasNilai ? 'Hapus nilai terlebih dahulu' : 'Hapus'}>
                    Hapus
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-hijau-tua px-5 py-3 shadow-lg">
          <span className="text-sm font-bold text-emas-terang">{selectedIds.size} dipilih</span>
          <button onClick={() => setBulkDeleteConfirm(true)}
            className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:brightness-110">
            Hapus Terpilih
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs font-bold text-white/70 hover:text-white">
            Batal
          </button>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-2">Hapus {selectedIds.size} Peserta?</h3>
            <p className="text-sm text-coklat mb-4">
              Tindakan ini akan menghapus (soft-delete) {selectedIds.size} peserta terpilih. Peserta bisa direstore kembali dari tab "Terhapus".
            </p>
            <div className="flex gap-2">
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex-1 rounded-lg bg-red-600 py-2.5 font-bold text-white hover:brightness-110 disabled:opacity-60">
                {bulkDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
              <button onClick={() => setBulkDeleteConfirm(false)}
                className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-coklat hover:bg-gray-50">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPeserta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditPeserta(null)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-1">Edit Peserta</h3>
            <p className="text-xs text-coklat mb-4">{editPeserta.no_urut}</p>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-coklat">Kategori</label>
                <select value={editForm.kategori} onChange={e => setEditForm(f => ({ ...f, kategori: e.target.value }))}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none" required>
                  {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-coklat">Golongan</label>
                <select value={editForm.golongan} onChange={e => setEditForm(f => ({ ...f, golongan: e.target.value }))}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none" required>
                  {GOLONGAN.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-coklat">Kontingen</label>
                <select value={editForm.kontingen_id} onChange={e => setEditForm(f => ({ ...f, kontingen_id: e.target.value }))}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none" required>
                  {kontingen.map(k => <option key={k.id} value={k.id}>{k.nama} ({k.kode})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-coklat">Anggota</label>
                <div className="space-y-2">
                  {editForm.anggota.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={a} onChange={e => setEditForm(f => ({ ...f, anggota: f.anggota.map((x, j) => j === i ? e.target.value : x) }))}
                        className="flex-1 rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none"
                        placeholder={`Nama ${i + 1}`} />
                      {editForm.anggota.length > 1 && (
                        <button type="button" onClick={() => setEditForm(f => ({ ...f, anggota: f.anggota.filter((_, j) => j !== i) }))}
                          className="text-red-500 font-bold px-2">×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, anggota: [...f.anggota, ''] }))}
                    className="text-sm font-bold text-hijau-sedang hover:underline">+ Tambah anggota</button>
                </div>
              </div>

              {editError && <p className="text-sm font-semibold text-merah-error">{editError}</p>}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={editSaving}
                  className="flex-1 rounded-lg bg-hijau-tua py-2.5 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
                  {editSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button type="button" onClick={() => setEditPeserta(null)}
                  className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-coklat hover:bg-gray-50">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Excel Modal */}
      {uploadModal && (
        <UploadModal eventId={eventId} onClose={() => setUploadModal(false)} onDone={() => { setUploadModal(false); onRefresh() }} />
      )}
    </div>
  )
}

/* ==================== UPLOAD EXCEL MODAL ==================== */
const KATEGORI_LIMITS: Record<string, { min: number; max: number }> = {
  'PERORANGAN': { min: 1, max: 1 },
  'BERPASANGAN': { min: 2, max: 2 },
  'BERKELOMPOK': { min: 3, max: 5 },
  'MASSAL': { min: 8, max: 25 },
  'ATT': { min: 6, max: 6 },
}

type ParsedRow = { kategori: string; golongan: string; kontingen: string; anggota: string; valid: boolean; reason?: string }

function UploadModal({ eventId, onClose, onDone }: { eventId: string; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: { row: number; reason: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function validateRow(r: { kategori: string; golongan: string; kontingen: string; anggota: string }): ParsedRow {
    const kategori = (r.kategori || '').trim().toUpperCase()
    const golongan = (r.golongan || '').trim()
    const kontingen = (r.kontingen || '').trim()
    const anggota = (r.anggota || '').trim()
    const anggotaList = anggota.split(',').map(a => a.trim()).filter(Boolean)

    if (!KATEGORI_LIMITS[kategori]) return { kategori, golongan, kontingen, anggota, valid: false, reason: `Kategori "${r.kategori}" tidak valid.` }
    if (!GOLONGAN.includes(golongan)) return { kategori, golongan, kontingen, anggota, valid: false, reason: `Golongan "${r.golongan}" tidak valid.` }
    if (!kontingen) return { kategori, golongan, kontingen, anggota, valid: false, reason: 'Kontingen wajib diisi.' }
    const limit = KATEGORI_LIMITS[kategori]
    if (anggotaList.length < limit.min || anggotaList.length > limit.max) {
      return { kategori, golongan, kontingen, anggota, valid: false, reason: `Jumlah anggota harus ${limit.min}-${limit.max} orang (saat ini ${anggotaList.length}).` }
    }
    return { kategori, golongan, kontingen, anggota, valid: true }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const wb = xlsx.read(data, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = xlsx.utils.sheet_to_json<any>(sheet, { header: ['kategori', 'golongan', 'kontingen', 'anggota'], range: 1 })
      const parsed = json.filter(r => r.kategori || r.golongan || r.kontingen || r.anggota).map(validateRow)
      setRows(parsed)
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.valid)
    if (validRows.length === 0) return
    setImporting(true)
    const res = await fetch(`/api/events/${eventId}/peserta/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peserta: validRows.map(({ kategori, golongan, kontingen, anggota }) => ({ kategori, golongan, kontingen, anggota })) })
    })
    const data = await res.json()
    setImporting(false)
    setResult({ success: data.success?.length || 0, failed: data.failed || [] })
  }

  const validCount = rows.filter(r => r.valid).length
  const invalidCount = rows.length - validCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-1">Upload Peserta via Excel</h3>
        <p className="text-xs text-coklat mb-4">Gunakan template yang sudah disediakan. Kontingen baru akan dibuat otomatis.</p>

        {!result && (
          <>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFile}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none" />

            {rows.length > 0 && (
              <div className="mt-4">
                <div className="flex gap-3 mb-2 text-xs font-bold">
                  <span className="text-green-600">✓ {validCount} valid</span>
                  {invalidCount > 0 && <span className="text-red-600">✗ {invalidCount} gagal</span>}
                </div>
                <div className="max-h-[300px] overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left">
                        <th className="px-2 py-1.5">#</th>
                        <th className="px-2 py-1.5">Kategori</th>
                        <th className="px-2 py-1.5">Golongan</th>
                        <th className="px-2 py-1.5">Kontingen</th>
                        <th className="px-2 py-1.5">Anggota</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={r.valid ? 'bg-green-50' : 'bg-red-50'}>
                          <td className="px-2 py-1.5">{i + 1}</td>
                          <td className="px-2 py-1.5">{r.kategori}</td>
                          <td className="px-2 py-1.5">{r.golongan}</td>
                          <td className="px-2 py-1.5">{r.kontingen}</td>
                          <td className="px-2 py-1.5 max-w-[120px] truncate">{r.anggota}</td>
                          <td className="px-2 py-1.5">
                            {r.valid ? <span className="text-green-600">✓</span> : <span className="text-red-600" title={r.reason}>✗ {r.reason}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button onClick={handleImport} disabled={validCount === 0 || importing}
                className="flex-1 rounded-lg bg-hijau-tua py-2.5 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
                {importing ? 'Mengimpor...' : `Import ${validCount} Peserta Valid`}
              </button>
              <button onClick={onClose} className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-coklat hover:bg-gray-50">
                Batal
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">
              ✓ {result.success} peserta berhasil diimport.
            </div>
            {result.failed.length > 0 && (
              <div className="rounded-lg bg-red-50 p-3 text-sm">
                <p className="font-semibold text-red-700 mb-1">✗ {result.failed.length} baris gagal:</p>
                <ul className="text-xs text-red-600 space-y-0.5">
                  {result.failed.map((f, i) => <li key={i}>Baris {f.row}: {f.reason}</li>)}
                </ul>
              </div>
            )}
            <button onClick={onDone} className="w-full rounded-lg bg-hijau-tua py-2.5 font-bold text-emas-terang hover:brightness-110">
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
