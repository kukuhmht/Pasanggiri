'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type PinRow = {
  id: string; pin_hash: string; keterangan: string; status: string
  berlaku_hingga: string | null; terakhir_dipakai: string | null; created_at: string
}

export default function PinJuriPage() {
  const { id: eventId } = useParams()
  const [pins, setPins] = useState<PinRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKeterangan, setNewKeterangan] = useState('')
  const [newBerlaku, setNewBerlaku] = useState('')
  const [generatedPin, setGeneratedPin] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [juriLink, setJuriLink] = useState('')

  useEffect(() => { loadPins(); loadEventInfo() }, [])

  async function loadEventInfo() {
    // Fetch event + org info to build juri link
    const res = await fetch(`/api/events/${eventId}/info`)
    if (res.ok) {
      const { orgSlug, eventSlug } = await res.json()
      const base = window.location.origin
      setJuriLink(`${base}/juri/${orgSlug}/${eventSlug}`)
    }
  }

  useEffect(() => { loadPins() }, [])

  async function loadPins() {
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}/pin`)
    const { data } = await res.json()
    setPins(data || [])
    setLoading(false)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setGeneratedPin('')
    const res = await fetch(`/api/events/${eventId}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keterangan: newKeterangan, berlaku_hingga: newBerlaku || null })
    })
    const result = await res.json()
    setGenerating(false)
    if (res.ok && result.pin) {
      setGeneratedPin(result.pin)
      setNewKeterangan('')
      setNewBerlaku('')
      loadPins()
    }
  }

  async function toggleStatus(pin: PinRow) {
    const newStatus = pin.status === 'aktif' ? 'nonaktif' : 'aktif'
    await fetch(`/api/events/${eventId}/pin/${pin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    loadPins()
  }

  async function deletePin(id: string) {
    if (!confirm('Hapus PIN ini?')) return
    await fetch(`/api/events/${eventId}/pin/${id}`, { method: 'DELETE' })
    loadPins()
  }

  function copyPin() {
    navigator.clipboard.writeText(generatedPin)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/app/events/${eventId}`} className="text-sm text-coklat hover:underline">← Detail Event</Link>
        <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">PIN Juri</h2>
      </div>

      {/* Generate form */}
      <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-hijau-sedang">Generate PIN Baru</h3>
          <button onClick={() => setShowForm(v => !v)}
            className="text-xs font-bold text-hijau-tua hover:underline">
            {showForm ? 'Tutup' : '+ Buat PIN'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleGenerate} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-coklat">Keterangan (opsional)</label>
              <input value={newKeterangan} onChange={e => setNewKeterangan(e.target.value)}
                className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none"
                placeholder="Contoh: Juri 1 — Sesi Pagi" />
            </div>
            <div>
              <label className="text-xs font-semibold text-coklat">Berlaku Hingga (opsional)</label>
              <input type="date" value={newBerlaku} onChange={e => setNewBerlaku(e.target.value)}
                className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-emas focus:outline-none" />
            </div>
            <button type="submit" disabled={generating}
              className="rounded-lg bg-hijau-tua px-5 py-2 text-sm font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
              {generating ? 'Generating...' : 'Generate PIN'}
            </button>
          </form>
        )}

        {/* Generated PIN display */}
        {generatedPin && (
          <div className="mt-4 rounded-lg border-3 border-emas bg-white p-4 text-center">
            <p className="text-xs font-bold text-coklat mb-1">PIN BARU (simpan sekarang — tidak bisa dilihat lagi)</p>
            <div className="font-[family-name:var(--font-cinzel)] text-4xl font-bold text-hijau-tua tracking-widest">
              {generatedPin}
            </div>
            <button onClick={copyPin}
              className="mt-3 rounded-lg bg-hijau-sedang px-4 py-2 text-sm font-bold text-white hover:brightness-110">
              {copied ? '✓ Tersalin!' : '📋 Copy PIN'}
            </button>
          </div>
        )}
      </div>

      {/* PIN list */}
      <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow">
        <h3 className="text-sm font-bold text-hijau-sedang mb-3">Daftar PIN ({pins.length})</h3>

        {loading ? (
          <p className="text-sm text-coklat">Memuat...</p>
        ) : pins.length === 0 ? (
          <p className="text-sm text-coklat py-4 text-center">Belum ada PIN. Generate PIN baru di atas.</p>
        ) : (
          <div className="space-y-2">
            {pins.map(pin => (
              <div key={pin.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      pin.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {pin.status.toUpperCase()}
                    </span>
                    <span className="font-mono text-lg font-bold tracking-wider text-hijau-tua">
                      {pin.pin_hash}
                    </span>
                    <button onClick={() => { navigator.clipboard.writeText(pin.pin_hash); }}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-gray-200"
                      title="Copy PIN">
                      📋
                    </button>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {pin.keterangan || '(tanpa keterangan)'}
                  </div>
                  {juriLink && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{juriLink}</span>
                      <button onClick={() => navigator.clipboard.writeText(juriLink)}
                        className="text-[10px] font-bold text-hijau-sedang hover:underline">Copy Link</button>
                    </div>
                  )}
                  <div className="mt-0.5 text-[10px] text-gray-400">
                    Dibuat: {new Date(pin.created_at).toLocaleDateString('id-ID')}
                    {pin.berlaku_hingga && ` · Berlaku s/d: ${pin.berlaku_hingga}`}
                    {pin.terakhir_dipakai && ` · Terakhir: ${new Date(pin.terakhir_dipakai).toLocaleString('id-ID')}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleStatus(pin)}
                    className={`rounded px-2 py-1 text-[10px] font-bold ${
                      pin.status === 'aktif'
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}>
                    {pin.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => deletePin(pin.id)}
                    className="rounded bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100">
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
