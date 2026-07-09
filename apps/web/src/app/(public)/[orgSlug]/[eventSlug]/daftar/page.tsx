'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { getPusherClient } from '@/lib/pusher/client'

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
type AuditLog = { id: string; action: string; entity_id: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; actor_name: string; actor_phone: string; created_at: string }
type RekapRow = { peserta_id: string; jumlah_juri: number; nilai_akhir: number }

export default function DaftarPage() {
  const { orgSlug, eventSlug } = useParams()
  const [eventId, setEventId] = useState('')
  const [kontingen, setKontingen] = useState<Kontingen[]>([])
  const [pesertaList, setPesertaList] = useState<Peserta[]>([])
  const [deletedList, setDeletedList] = useState<Peserta[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'live' | 'form' | 'list' | 'deleted' | 'logs'>('live')
  
  // Live state
  const [gelanggangList, setGelanggangList] = useState<LiveGelanggang[]>([])
  const [rekapLive, setRekapLive] = useState<RekapRow[]>([])
  const [gelanggangTimers, setGelanggangTimers] = useState<Record<string, number>>({})

  // Form state
  const [form, setForm] = useState({ kategori: '', golongan: '', kontingen_id: '', anggota: [''] })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Edit state
  const [editPeserta, setEditPeserta] = useState<Peserta | null>(null)
  const [editForm, setEditForm] = useState({ kategori: '', golongan: '', kontingen_id: '', anggota: [''] })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Identity modal state
  const [identityModal, setIdentityModal] = useState<{ action: 'edit' | 'delete' | 'restore'; peserta: Peserta } | null>(null)
  const [identity, setIdentity] = useState({ nama: '', phone: '' })
  const [identityError, setIdentityError] = useState('')

  // Filters for list
  const [filterKontingen, setFilterKontingen] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [filterGolongan, setFilterGolongan] = useState('')

  useEffect(() => { resolveEvent() }, [])

  useEffect(() => {
    if (!eventId) return
    const pusher = getPusherClient()
    if (!pusher) return
    const channel = pusher.subscribe(`event-${eventId}`)
    channel.bind('gelanggang-update', (data: { gelanggang_id: string; gelanggang_nama: string; peserta_aktif: Peserta | null; antrian: string[] }) => {
      setGelanggangList(prev => {
        const idx = prev.findIndex(g => g.id === data.gelanggang_id)
        if (idx >= 0) {
          const newArr = [...prev]
          newArr[idx] = { ...newArr[idx], nama: data.gelanggang_nama, peserta_aktif: data.peserta_aktif, antrian: data.antrian || [] }
          return newArr
        }
        return [...prev, { id: data.gelanggang_id, nama: data.gelanggang_nama, peserta_aktif: data.peserta_aktif, antrian: data.antrian || [] }]
      })
    })

    channel.bind('waktu-tampil-update', (data: { gelanggang_id: string; peserta_id: string; waktu_detik: number }) => {
      setGelanggangTimers(prev => ({ ...prev, [data.gelanggang_id]: data.waktu_detik }))
    })

    return () => { channel.unbind_all(); pusher.unsubscribe(`event-${eventId}`) }
  }, [eventId])

  useEffect(() => {
    if (tab !== 'live' || !eventId) return
    async function fetchRekap() {
      const res = await fetch(`/api/events/${eventId}/rekap`)
      const { data } = await res.json()
      setRekapLive((data || []).map((r: any) => ({ peserta_id: r.peserta_id, jumlah_juri: r.jumlah_juri, nilai_akhir: r.nilai_akhir })))
    }
    fetchRekap()
    const interval = setInterval(fetchRekap, 5000)
    return () => clearInterval(interval)
  }, [tab, eventId])

  async function resolveEvent() {
    const res = await fetch(`/api/public/${orgSlug}/${eventSlug}`)
    if (!res.ok) { setLoading(false); return }
    const { event } = await res.json()
    setEventId(event.id)
    await Promise.all([loadData(event.id), loadGelanggang(event.id)])
    setLoading(false)
  }

  async function loadGelanggang(eid: string) {
    const res = await fetch(`/api/events/${eid}/gelanggang`)
    const { data } = await res.json()
    setGelanggangList((data || []).map((g: any) => ({ ...g, antrian: g.antrian || [] })))
  }

  async function loadData(eid?: string) {
    const id = eid || eventId
    const [kRes, pRes, dRes, lRes] = await Promise.all([
      fetch(`/api/events/${id}/kontingen`),
      fetch(`/api/events/${id}/peserta`),
      fetch(`/api/events/${id}/peserta/deleted`),
      fetch(`/api/events/${id}/audit-logs`),
    ])
    setKontingen((await kRes.json()).data || [])
    setPesertaList((await pRes.json()).data || [])
    setDeletedList((await dRes.json()).data || [])
    setAuditLogs((await lRes.json()).data || [])
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

  // === IDENTITY MODAL ===
  function validateIdentity(): boolean {
    if (!identity.nama.trim()) { setIdentityError('Nama wajib diisi.'); return false }
    if (!identity.phone.startsWith('62') || identity.phone.length < 10) {
      setIdentityError('Nomor WhatsApp harus diawali 62 dan minimal 10 digit.'); return false
    }
    setIdentityError('')
    return true
  }

  function requestEdit(p: Peserta) {
    setIdentityModal({ action: 'edit', peserta: p })
    setIdentity({ nama: '', phone: '' })
    setIdentityError('')
  }

  function requestDelete(p: Peserta) {
    setIdentityModal({ action: 'delete', peserta: p })
    setIdentity({ nama: '', phone: '' })
    setIdentityError('')
  }

  function requestRestore(p: Peserta) {
    setIdentityModal({ action: 'restore', peserta: p })
    setIdentity({ nama: '', phone: '' })
    setIdentityError('')
  }

  async function confirmIdentity() {
    if (!validateIdentity() || !identityModal) return

    const { action, peserta } = identityModal

    if (action === 'edit') {
      setIdentityModal(null)
      setEditPeserta(peserta)
      setEditForm({ kategori: peserta.kategori, golongan: peserta.golongan, kontingen_id: peserta.kontingen_id || '', anggota: [...(peserta.anggota || [])] })
      setEditError('')
    } else if (action === 'delete') {
      const res = await fetch(`/api/events/${eventId}/peserta/${peserta.id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_name: identity.nama, actor_phone: identity.phone })
      })
      if (!res.ok) { const r = await res.json(); setIdentityError(r.error || 'Gagal menghapus.'); return }
      setIdentityModal(null)
      loadData()
    } else if (action === 'restore') {
      const res = await fetch(`/api/events/${eventId}/peserta/${peserta.id}/restore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_name: identity.nama, actor_phone: identity.phone })
      })
      if (!res.ok) { const r = await res.json(); setIdentityError(r.error || 'Gagal restore.'); return }
      setIdentityModal(null)
      loadData()
    }
  }

  // === EDIT LOGIC ===
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editPeserta) return
    setEditError('')
    const anggota = editForm.anggota.map(a => a.trim()).filter(Boolean)
    if (!anggota.length) { setEditError('Minimal 1 nama peserta.'); return }

    setEditSaving(true)
    const res = await fetch(`/api/events/${eventId}/peserta/${editPeserta.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, anggota, actor_name: identity.nama, actor_phone: identity.phone })
    })
    setEditSaving(false)
    if (!res.ok) { const r = await res.json(); setEditError(r.error || 'Gagal update.'); return }
    setEditPeserta(null)
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
      <div className="flex gap-2 flex-wrap">
        {(['live', 'form', 'list', 'deleted', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 min-w-[120px] rounded-lg py-2.5 text-sm font-bold transition ${
              tab === t
                ? 'bg-hijau-tua text-emas-terang shadow'
                : 'bg-white text-coklat border-2 border-gray-200 hover:border-emas'
            }`}>
            {t === 'live' && '🔴 Live'}
            {t === 'form' && '📝 Pendaftaran'}
            {t === 'list' && `📋 Peserta (${pesertaList.length})`}
            {t === 'deleted' && `🗑️ Terhapus (${deletedList.length})`}
            {t === 'logs' && `📜 Riwayat (${auditLogs.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Live */}
      {tab === 'live' && (
        <LiveDisplay gelanggang={gelanggangList} rekap={rekapLive} timers={gelanggangTimers} pesertaList={pesertaList} />
      )}
      
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
                    <button onClick={() => requestEdit(p)}
                      className="rounded bg-emas/20 px-2 py-1 text-[10px] font-bold text-emas hover:bg-emas/30">
                      Edit
                    </button>
                    <button onClick={() => requestDelete(p)}
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

      {/* Tab: Deleted */}
      {tab === 'deleted' && (
        <div className="rounded-xl border-l-4 border-gray-300 bg-putih-gading p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua">
              Peserta Terhapus
            </h2>
            <button onClick={() => loadData()} className="rounded bg-gray-100 px-3 py-1 text-xs font-bold hover:bg-gray-200">↻</button>
          </div>

          {deletedList.length === 0 ? (
            <p className="text-center text-sm text-coklat py-4">Tidak ada peserta terhapus.</p>
          ) : (
            <div className="space-y-2">
              {deletedList.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm border border-gray-100 opacity-70">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-gray-500 line-through">{p.no_urut}</span>
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-500">TERHAPUS</span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-gray-500 truncate line-through">
                      {(p.anggota || []).join(', ')}
                    </div>
                    <div className="text-[10px] text-gray-400">{p.kontingen?.nama || '-'}</div>
                  </div>
                  <button onClick={() => requestRestore(p)}
                    className="rounded bg-green-50 px-3 py-1.5 text-[10px] font-bold text-green-700 hover:bg-green-100">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audit Logs */}
      {tab === 'logs' && (
        <div className="rounded-xl border-l-4 border-hijau-sedang bg-putih-gading p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua">
              Riwayat Perubahan
            </h2>
            <button onClick={() => loadData()} className="rounded bg-gray-100 px-3 py-1 text-xs font-bold hover:bg-gray-200">↻</button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-center text-sm text-coklat py-4">Belum ada riwayat perubahan.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map(log => (
                <div key={log.id} className="rounded-lg bg-white p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                      log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{log.actor_name}</span>
                    <span className="text-gray-400"> ({log.actor_phone})</span>
                  </div>
                  {log.action === 'DELETE' && log.old_data && (
                    <div className="mt-2 text-xs text-gray-500">
                      Menghapus: <span className="font-medium">{(log.old_data.anggota as string[])?.join(', ')}</span>
                      {' '}— {log.old_data.no_urut as string}
                    </div>
                  )}
                  {log.action === 'UPDATE' && log.old_data && log.new_data && (
                    <div className="mt-2 text-xs text-gray-500">
                      Mengubah peserta <span className="font-medium">{log.old_data.no_urut as string}</span>
                    </div>
                  )}
                  {log.action === 'RESTORE' && log.new_data && (
                    <div className="mt-2 text-xs text-gray-500">
                      Restore: <span className="font-medium">{(log.new_data.anggota as string[])?.join(', ')}</span>
                      {' '}— {log.new_data.no_urut as string}
                    </div>
                  )}
                  {log.action === 'CREATE' && log.new_data && (
                    <div className="mt-2 text-xs text-gray-500">
                      Mendaftarkan: <span className="font-medium">{(log.new_data.anggota as string[])?.join(', ')}</span>
                      {' '}— {log.new_data.no_urut as string}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Identity Modal */}
      {identityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIdentityModal(null)}>
          <div className="w-full max-w-sm rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-1">
              {identityModal.action === 'edit' ? 'Edit Peserta' : identityModal.action === 'delete' ? 'Hapus Peserta' : 'Restore Peserta'}
            </h3>
            <p className="text-xs text-coklat mb-4">
              {identityModal.action === 'delete'
                ? `Anda akan menghapus ${identityModal.peserta.no_urut}. `
                : identityModal.action === 'restore'
                ? `Anda akan mengembalikan ${identityModal.peserta.no_urut}. `
                : `Anda akan mengedit ${identityModal.peserta.no_urut}. `}
              Masukkan identitas Anda untuk mencatat perubahan.
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-coklat">Nama Anda</label>
                <input value={identity.nama} onChange={e => setIdentity(f => ({ ...f, nama: e.target.value }))}
                  className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-emas focus:outline-none"
                  placeholder="Nama lengkap" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-coklat">Nomor WhatsApp</label>
                <input value={identity.phone} onChange={e => setIdentity(f => ({ ...f, phone: e.target.value.replace(/[^0-9]/g, '') }))}
                  className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-emas focus:outline-none"
                  placeholder="6281234567890" />
                <p className="mt-1 text-[10px] text-gray-400">Harus diawali 62 (tanpa +)</p>
              </div>

              {identityError && <p className="text-sm font-semibold text-merah-error">{identityError}</p>}

              <div className="flex gap-2 pt-2">
                <button onClick={confirmIdentity}
                  className={`flex-1 rounded-lg py-2.5 font-bold transition hover:brightness-110 ${
                    identityModal.action === 'delete'
                      ? 'bg-red-600 text-white'
                      : 'bg-hijau-tua text-emas-terang'
                  }`}>
                  {identityModal.action === 'edit' ? 'Lanjut Edit' : identityModal.action === 'delete' ? 'Konfirmasi Hapus' : 'Konfirmasi Restore'}
                </button>
                <button onClick={() => setIdentityModal(null)}
                  className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-coklat hover:bg-gray-50">
                  Batal
                </button>
              </div>
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

type LiveGelanggang = { id: string; nama: string; peserta_aktif: { id: string; no_urut: string; kategori: string; golongan: string; anggota: string[]; kontingen: { nama: string } | null } | null; antrian: string[] }

function LiveDisplay({ gelanggang, rekap, timers, pesertaList }: { gelanggang: LiveGelanggang[]; rekap: RekapRow[]; timers: Record<string, number>; pesertaList: Peserta[] }) {
  if (gelanggang.length === 0) {
    return (
      <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-8 text-center shadow">
        <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua mb-2">🔴 Live Gelanggang</h2>
        <p className="text-coklat">Belum ada gelanggang yang dibuka oleh admin.</p>
      </div>
    )
  }

  const liveScores = rekap.filter(r => gelanggang.some(g => g.peserta_aktif?.id === r.peserta_id))
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="space-y-6">
      {gelanggang.map(g => (
        <div key={g.id} className="rounded-xl border border-gray-200 bg-putih-gading shadow overflow-hidden">
          {/* Header + Peserta Aktif */}
          <div className="p-5 bg-gradient-to-br from-hijau-tua to-hijau-sedang text-putih-gading">
            <h3 className="font-[family-name:var(--font-cinzel)] text-base font-bold text-emas-terang uppercase mb-3">{g.nama}</h3>
            {g.peserta_aktif ? (
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold text-emas-terang uppercase">▶ Sedang Tampil</div>
                  <div className="text-lg font-bold">{(g.peserta_aktif.anggota || []).join(', ')}</div>
                  <div className="text-xs opacity-80 mt-0.5">No Urut: {g.peserta_aktif.no_urut}</div>
                  <div className="text-xs opacity-80">{g.peserta_aktif.kontingen?.nama || "-"} | {g.peserta_aktif.kategori} | {g.peserta_aktif.golongan}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold">{formatTime(timers[g.id] || 0)}</div>
                  <div className="text-2xl font-bold text-green-300">
                    {liveScores.find(s => s.peserta_id === g.peserta_aktif!.id)?.nilai_akhir || '...'}
                  </div>
                  <div className="text-xs text-white/60">
                    Juri: {liveScores.find(s => s.peserta_id === g.peserta_aktif!.id)?.jumlah_juri || 0}/5
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-300">Tidak ada peserta tampil</p>
              </div>
            )}
          </div>

          {/* Antrian selanjutnya */}
          <div className="p-4">
            <p className="text-xs font-bold text-hijau-sedang mb-2">🔜 Selanjutnya Tampil</p>
            {(g.antrian?.length || 0) > 0 ? (
              <div className="space-y-2">
                {g.antrian.slice(0, 3).map((pid, idx) => {
                  const p = pesertaList.find(p => p.id === pid)
                  if (!p) return null
                  if (idx === 0) {
                    return (
                      <div key={pid} className="rounded-lg bg-emas/10 border-2 border-emas p-2">
                        <p className="text-xs font-bold text-emas-terang">BERIKUTNYA</p>
                        <p className="font-semibold text-sm text-hijau-tua">{(p.anggota || []).join(', ')}</p>
                        <p className="text-xs text-coklat">{p.kontingen?.nama || '-'} · {p.kategori} · {p.golongan}</p>
                      </div>
                    )
                  }
                  return (
                    <div key={pid} className="pl-3 border-l-2 border-gray-200">
                      <p className="font-medium text-xs text-gray-700">{(p.anggota || []).join(', ')}</p>
                      <p className="text-[10px] text-gray-500">{p.kontingen?.nama || '-'} · {p.kategori} · {p.golongan}</p>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-sm text-gray-400">Tidak ada peserta selanjutnya.</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
