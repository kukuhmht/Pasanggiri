'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Event = {
  id: string; nama: string; subjudul: string; tahun: number
  prefix: string; slug: string; is_public: boolean; created_at: string
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nama: '', subjudul: '', tahun: '2026', prefix: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [orgSlug, setOrgSlug] = useState('')

  // Edit state
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [editForm, setEditForm] = useState({ nama: '', subjudul: '', tahun: '', prefix: '', is_public: true })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setLoading(true)
    const [eventsRes, orgRes] = await Promise.all([
      fetch('/api/events').then(r => r.json()),
      fetch('/api/org/profile').then(r => r.json())
    ])
    setEvents(eventsRes.data || [])
    setOrgSlug(orgRes.org?.slug || '')
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const result = await res.json()
    if (!res.ok) { setError(result.error); setSaving(false); return }
    setShowForm(false)
    setForm({ nama: '', subjudul: '', tahun: '2026', prefix: '' })
    setSaving(false)
    loadEvents()
  }

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus event "${nama}"? Semua data peserta & nilai akan terhapus.`)) return
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    loadEvents()
  }

  function openEdit(ev: Event) {
    setEditEvent(ev)
    setEditForm({
      nama: ev.nama,
      subjudul: ev.subjudul || '',
      tahun: String(ev.tahun),
      prefix: ev.prefix,
      is_public: ev.is_public,
    })
    setEditError('')
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editEvent) return
    setEditError('')
    setEditSaving(true)
    const res = await fetch(`/api/events/${editEvent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    })
    const result = await res.json()
    if (!res.ok) { setEditError(result.error); setEditSaving(false); return }
    setEditEvent(null)
    setEditSaving(false)
    loadEvents()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">Events</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="rounded-lg bg-hijau-tua px-4 py-2 text-sm font-bold text-emas-terang hover:brightness-110"
        >
          {showForm ? 'Batal' : '+ Buat Event'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border-l-4 border-emas bg-putih-gading p-6 shadow">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Nama Event *</label>
              <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-emas focus:outline-none"
                placeholder="Pasanggiri ASAD 2026" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Prefix Nomor Urut *</label>
              <input value={form.prefix} onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 uppercase focus:border-emas focus:outline-none"
                placeholder="PSG26" maxLength={6} required />
              <p className="mt-1 text-xs text-gray-400">Contoh: PSG26, LMB26. Maks 6 karakter.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Subjudul</label>
              <input value={form.subjudul} onChange={e => setForm(f => ({ ...f, subjudul: e.target.value }))}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-emas focus:outline-none"
                placeholder="Sistem Pendaftaran dan Penilaian" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-coklat">Tahun</label>
              <input type="number" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: e.target.value }))}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-emas focus:outline-none" />
            </div>
          </div>
          {error && <p className="mt-3 text-sm font-semibold text-merah-error">{error}</p>}
          <button type="submit" disabled={saving}
            className="mt-4 rounded-lg bg-hijau-tua px-6 py-2 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Event'}
          </button>
        </form>
      )}

      {/* Event list */}
      {loading ? (
        <div className="py-12 text-center text-coklat">Memuat events...</div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border-l-4 border-gray-300 bg-putih-gading p-8 text-center shadow">
          <p className="text-coklat">Belum ada event. Klik &quot;Buat Event&quot; untuk mulai.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map(ev => {
            const publicLink = orgSlug ? `${window.location.origin}/${orgSlug}/${ev.slug}/daftar` : ''
            return (
              <div key={ev.id} className="rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow flex flex-col">
                <div>
                  <h3 className="font-[family-name:var(--font-cinzel)] text-base font-semibold text-hijau-tua">
                    {ev.nama}
                  </h3>
                  <p className="mt-0.5 text-xs text-coklat">{ev.subjudul}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded bg-hijau-tua/10 px-2 py-0.5 text-xs font-bold text-hijau-tua">{ev.prefix}</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{ev.tahun}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${ev.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ev.is_public ? 'Publik' : 'Private'}
                    </span>
                  </div>
                </div>
                
                {ev.is_public && publicLink && (
                  <div className="mt-4 rounded-lg bg-white p-3 border border-gray-100">
                    <p className="text-[10px] text-gray-500 mb-1">Link Publik Pendaftaran:</p>
                    <div className="flex items-center gap-2">
                      <input type="text" readOnly value={publicLink} 
                        className="flex-grow text-xs text-hijau-tua bg-transparent outline-none truncate"/>
                      <button onClick={() => navigator.clipboard.writeText(publicLink)}
                        className="text-xs font-bold text-emas hover:underline">Copy</button>
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-4 flex gap-2 flex-wrap">
                  <Link href={`/app/events/${ev.id}`}
                    className="rounded bg-hijau-sedang px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">
                    Kelola
                  </Link>
                  <button onClick={() => openEdit(ev)}
                    className="rounded bg-emas/20 px-3 py-1.5 text-xs font-bold text-emas hover:bg-emas/30">
                    ✏️ Edit
                  </button>
                  <button onClick={() => handleDelete(ev.id, ev.nama)}
                    className="rounded bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200">
                    Hapus
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditEvent(null)}>
          <div className="w-full max-w-md rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-4">
              Edit Event
            </h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-coklat">Nama Event</label>
                <input value={editForm.nama} onChange={e => setEditForm(f => ({ ...f, nama: e.target.value }))}
                  className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-emas focus:outline-none" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-coklat">Subjudul</label>
                <input value={editForm.subjudul} onChange={e => setEditForm(f => ({ ...f, subjudul: e.target.value }))}
                  className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-emas focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-coklat">Prefix</label>
                  <input value={editForm.prefix} onChange={e => setEditForm(f => ({ ...f, prefix: e.target.value }))}
                    className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 uppercase focus:border-emas focus:outline-none" maxLength={6} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-coklat">Tahun</label>
                  <input type="number" value={editForm.tahun} onChange={e => setEditForm(f => ({ ...f, tahun: e.target.value }))}
                    className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-emas focus:outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-coklat">Visibilitas:</label>
                <button type="button" onClick={() => setEditForm(f => ({ ...f, is_public: !f.is_public }))}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${editForm.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                  {editForm.is_public ? '🌐 Publik' : '🔒 Private'}
                </button>
              </div>

              {editError && <p className="text-sm font-semibold text-merah-error">{editError}</p>}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={editSaving}
                  className="flex-1 rounded-lg bg-hijau-tua py-2.5 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button type="button" onClick={() => setEditEvent(null)}
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
