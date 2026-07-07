'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const KATEGORI = [
  { nama: 'PERORANGAN', min: 1, max: 1 },
  { nama: 'BERPASANGAN', min: 2, max: 2 },
  { nama: 'BERKELOMPOK', min: 3, max: 5 },
  { nama: 'MASSAL', min: 8, max: 25 },
  { nama: 'ATT', min: 6, max: 6 },
]
const GOLONGAN = ['Usia Dini', 'Pra Remaja', 'Remaja', 'Dewasa', 'Pembina', 'Istimewa', 'Campuran']

type Kontingen = { id: string; nama: string; kode: string }
type Peserta = { id: string; no_urut: string; kategori: string; golongan: string; anggota: string[]; kontingen: { nama: string; kode: string } | null; kontingen_id: string }

export default function DaftarPage() {
  const { orgSlug, eventSlug } = useParams()
  const [eventId, setEventId] = useState('')
  const [kontingen, setKontingen] = useState<Kontingen[]>([])
  const [pesertaList, setPesertaList] = useState<Peserta[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'form' | 'list'>('form')

  // Form state
  const [form, setForm] = useState({ kategori: '', golongan: '', kontingen_id: '', anggota: [''] })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Edit state
  const [editPeserta, setEditPeserta] = useState<Peserta | null>(null)
  const [editForm, setEditForm] = useState({ kategori: '', golongan: '', kontingen_id: '', anggota: [''] })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Filters for list
  const [filterKontingen, setFilterKontingen] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [filterGolongan, setFilterGolongan] = useState('')

  useEffect(() => { resolveEvent() }, [])

  async function resolveEvent() {
    const res = await fetch(`/api/public/${orgSlug}/${eventSlug}`)
    if (!res.ok) { setLoading(false); return }
    const { event } = await res.json()
    setEventId(event.id)
    await loadData(event.id)
    setLoading(false)
  }

  async function loadData(eid?: string) {
    const id = eid || eventId
    const [kRes, pRes] = await Promise.all([
      fetch(`/api/events/${id}/kontingen`),
      fetch(`/api/events/${id}/peserta`),
    ])
    setKontingen((await kRes.json()).data || [])
    setPesertaList((await pRes.json()).data || [])
  }

  // === FORM LOGIC ===
  const selectedKat = KATEGORI.find(k => k.nama === form.kategori)

  function updateAnggota(idx: number, val: string) {
    setForm(f => ({ ...f, anggota: f.anggota.map((a, i) => i === idx ? val : a) }))
  }
  function addAnggota() {
    if (selectedKat && form.anggota.length >= selectedKat.max) return
    setForm(f => ({ ...f, anggota: [...f.anggota, ''] }))
  }
  function removeAnggota(idx: number) {
    if (selectedKat && form.anggota.length <= selectedKat.min) return
    setForm(f => ({ ...f, anggota: f.anggota.filter((_, i) => i !== idx) }))
  }
  function onKategoriChange(val: string) {
    const kat = KATEGORI.find(k => k.nama === val)
    const count = kat ? kat.min : 1
    setForm(f => ({ ...f, kategori: val, anggota: Array(count).fill('') }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    const anggota = form.anggota.map(a => a.trim()).filter(Boolean)

    if (!form.kategori || !form.golongan || !form.kontingen_id) {
      setResult({ success: false, message: 'Lengkapi semua field.' }); return
    }
    if (selectedKat && anggota.length < selectedKat.min) {
      setResult({ success: false, message: `Minimal ${selectedKat.min} nama peserta untuk ${form.kategori}.` }); return
    }

    setSaving(true)
    const res = await fetch(`/api/events/${eventId}/peserta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, anggota })
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setResult({ success: false, message: data.error || 'Gagal mendaftar.' }); return }
    setResult({ success: true, message: `Terdaftar! Nomor Urut: ${data.data.no_urut}` })
    setForm({ kategori: '', golongan: '', kontingen_id: '', anggota: [''] })
    loadData()
  }

  // === EDIT LOGIC ===
  function openEdit(p: Peserta) {
    setEditPeserta(p)
    setEditForm({ kategori: p.kategori, golongan: p.golongan, kontingen_id: p.kontingen_id || '', anggota: [...(p.anggota || [])] })
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
    loadData()
  }

  async function handleDelete(id: string, noUrut: string) {
    if (!confirm(`Hapus peserta ${noUrut}? Tindakan ini tidak bisa dibatalkan.`)) return
    await fetch(`/api/events/${eventId}/peserta/${id}`, { method: 'DELETE' })
    loadData()
  }

  // Filtered peserta
  const filteredPeserta = pesertaList.filter(p =>
    (!filterKontingen || p.kontingen_id === filterKontingen) &&
    (!filterKategori || p.kategori === filterKategori) &&
    (!filterGolongan || p.golongan === filterGolongan)
  )

  if (loading) return <div className="py-12 text-center text-coklat">Memuat data event...</div>
  if (!eventId) return <div className="py-12 text-center text-merah-error">Event tidak ditemukan atau tidak publik.</div>

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('form')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
            tab === 'form'
              ? 'bg-hijau-tua text-emas-terang shadow'
              : 'bg-white text-coklat border-2 border-gray-200 hover:border-emas'
          }`}>
          📝 Pendaftaran
        </button>
        <button onClick={() => setTab('list')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
            tab === 'list'
              ? 'bg-hijau-tua text-emas-terang shadow'
              : 'bg-white text-coklat border-2 border-gray-200 hover:border-emas'
          }`}>
          📋 Daftar Peserta ({pesertaList.length})
        </button>
      </div>

      {/* Tab: Form */}
      {tab === 'form' && (
        <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-6 shadow">
          <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua mb-1">
            Pendaftaran Peserta
          </h2>
          <p className="text-sm text-coklat mb-6">Isi form di bawah untuk mendaftar sebagai peserta.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Kategori</label>
              <select value={form.kategori} onChange={e => onKategoriChange(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:border-emas focus:outline-none" required>
                <option value="">Pilih kategori</option>
                {KATEGORI.map(k => <option key={k.nama} value={k.nama}>{k.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Golongan</label>
              <select value={form.golongan} onChange={e => setForm(f => ({ ...f, golongan: e.target.value }))}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:border-emas focus:outline-none" required>
                <option value="">Pilih golongan</option>
                {GOLONGAN.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Kontingen</label>
              <select value={form.kontingen_id} onChange={e => setForm(f => ({ ...f, kontingen_id: e.target.value }))}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:border-emas focus:outline-none" required>
                <option value="">Pilih kontingen</option>
                {kontingen.map(k => <option key={k.id} value={k.id}>{k.nama} ({k.kode})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">
                Nama Peserta {selectedKat && <span className="font-normal text-xs text-gray-400">({form.anggota.length} dari {selectedKat.min}–{selectedKat.max})</span>}
              </label>
              <div className="space-y-2">
                {form.anggota.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={a} onChange={e => updateAnggota(i, e.target.value)}
                      className="flex-1 rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:border-emas focus:outline-none"
                      placeholder={`Nama peserta ${i + 1}`} required />
                    {selectedKat && form.anggota.length > selectedKat.min && (
                      <button type="button" onClick={() => removeAnggota(i)}
                        className="rounded-lg border-2 border-gray-200 px-3 text-red-500 font-bold hover:bg-red-50">×</button>
                    )}
                  </div>
                ))}
                {selectedKat && form.anggota.length < selectedKat.max && (
                  <button type="button" onClick={addAnggota}
                    className="text-sm font-bold text-hijau-sedang hover:underline">+ Tambah peserta</button>
                )}
              </div>
            </div>

            {result && (
              <div className={`rounded-lg p-3 text-sm font-semibold ${result.success ? 'bg-green-50 text-hijau-sedang' : 'bg-red-50 text-merah-error'}`}>
                {result.message}
              </div>
            )}

            <button type="submit" disabled={saving}
              className="w-full rounded-lg bg-hijau-tua py-3 font-bold text-emas-terang transition hover:brightness-110 disabled:opacity-60">
              {saving ? 'Mendaftar...' : 'Daftar Peserta'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: List */}
      {tab === 'list' && (
        <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua">
              Daftar Peserta
            </h2>
            <button onClick={() => loadData()} className="rounded bg-gray-100 px-3 py-1 text-xs font-bold hover:bg-gray-200">↻</button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={filterKontingen} onChange={e => setFilterKontingen(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none">
              <option value="">Semua Kontingen</option>
              {kontingen.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none">
              <option value="">Semua Kategori</option>
              {KATEGORI.map(k => <option key={k.nama} value={k.nama}>{k.nama}</option>)}
            </select>
            <select value={filterGolongan} onChange={e => setFilterGolongan(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none">
              <option value="">Semua Golongan</option>
              {GOLONGAN.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <p className="text-xs text-gray-400 mb-3">Menampilkan {filteredPeserta.length} dari {pesertaList.length} peserta</p>

          {filteredPeserta.length === 0 ? (
            <p className="text-center text-sm text-coklat py-4">Tidak ada peserta sesuai filter.</p>
          ) : (
            <div className="space-y-2">
              {filteredPeserta.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-hijau-tua">{p.no_urut}</span>
                      <span className="rounded bg-hijau-tua/10 px-1.5 py-0.5 text-[10px] font-bold text-hijau-tua">{p.kategori}</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{p.golongan}</span>
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
                    <button onClick={() => handleDelete(p.id, p.no_urut)}
                      className="rounded bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100">
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  {KATEGORI.map(k => <option key={k.nama} value={k.nama}>{k.nama}</option>)}
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
    </div>
  )
}
