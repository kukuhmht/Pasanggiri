'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { getPusherClient } from '@/lib/pusher/client'

const JURI_LIST = ['Juri 1', 'Juri 2', 'Juri 3', 'Juri 4', 'Juri 5']

const KRITERIA_PER_KATEGORI: Record<string, string[]> = {
  'PERORANGAN': ['orisinalitas', 'kemantapan', 'stamina'],
  'BERPASANGAN': ['teknikSerangBela', 'kemantapan', 'penghayatan'],
  'BERKELOMPOK': ['orisinalitas', 'kemantapan', 'kekompakan'],
  'MASSAL': ['orisinalitas', 'kemantapan', 'kekompakan', 'kreatifitas'],
  'ATT': ['orisinalitas', 'kemantapan', 'kekayaanTeknik'],
}

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
  'DEFAULT': { min: 39, max: 50 },
}

type Peserta = { id: string; no_urut: string; kategori: string; golongan: string; anggota: string[]; kontingen: { nama: string } | null }

export default function JuriPage() {
  const { orgSlug, eventSlug } = useParams() as { orgSlug: string; eventSlug: string }
  const [eventId, setEventId] = useState('')
  const [eventNama, setEventNama] = useState('')
  const [resolving, setResolving] = useState(true)
  const [resolveError, setResolveError] = useState('')

  const [authed, setAuthed] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  // Gelanggang state
  const [gelanggangList, setGelanggangList] = useState<{ id: string; nama: string; peserta_aktif: Peserta | null }[]>([])
  const [selectedGel, setSelectedGel] = useState('')

  // Scoring state
  const [pesertaAktif, setPesertaAktif] = useState<Peserta | null>(null)
  const [gelanggangNama, setGelanggangNama] = useState('')
  const [juri, setJuri] = useState('')
  const [namaJuri, setNamaJuri] = useState('')
  const [nilai, setNilai] = useState<Record<string, number>>({})
  const [waktuMenit, setWaktuMenit] = useState('')
  const [waktuDetik, setWaktuDetik] = useState('')
  const [keluarGelanggang, setKeluarGelanggang] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Resolve org+event slugs to eventId
  useEffect(() => {
    async function resolve() {
      const res = await fetch(`/api/public/${orgSlug}/${eventSlug}`)
      if (!res.ok) { setResolveError('Event tidak ditemukan.'); setResolving(false); return }
      const { event } = await res.json()
      setEventId(event.id)
      setEventNama(event.nama)
      setResolving(false)
    }
    resolve()
  }, [orgSlug, eventSlug])

  // Check session
  useEffect(() => {
    const token = sessionStorage.getItem('juriToken')
    const exp = sessionStorage.getItem('juriTokenExpiry')
    if (token && exp && new Date(exp).getTime() > Date.now()) {
      setAuthed(true)
    }
  }, [])

  // Subscribe to Pusher for gelanggang updates
  useEffect(() => {
    if (!authed || !eventId) return
    const pusher = getPusherClient()
    if (!pusher) return

    const channel = pusher.subscribe(`event-${eventId}`)
    channel.bind('gelanggang-update', (data: { gelanggang_id: string; gelanggang_nama: string; peserta_aktif: Peserta | null }) => {
      setGelanggangList(prev => prev.map(g =>
        g.id === data.gelanggang_id ? { ...g, nama: data.gelanggang_nama, peserta_aktif: data.peserta_aktif } : g
      ))
      setSelectedGel(prev => {
        if (prev === data.gelanggang_id || (!prev && gelanggangList.length <= 1)) {
          setPesertaAktif(data.peserta_aktif)
          setGelanggangNama(data.gelanggang_nama)
          setNilai({}); setWaktuMenit(''); setWaktuDetik(''); setKeluarGelanggang(0); setMessage('')
        }
        return prev
      })
    })

    channel.bind('waktu-tampil-update', (data: { gelanggang_id: string; peserta_id: string; waktu_detik: number }) => {
      if (selectedGel === data.gelanggang_id) {
        const menit = Math.floor(data.waktu_detik / 60)
        const detik = data.waktu_detik % 60
        setWaktuMenit(String(menit))
        setWaktuDetik(String(detik))
      }
    })

    loadCurrentGelanggang()

    return () => { channel.unbind_all(); pusher.unsubscribe(`event-${eventId}`) }
  }, [authed, eventId])

  async function loadCurrentGelanggang() {
    if (!eventId) return
    const res = await fetch(`/api/events/${eventId}/gelanggang`)
    const { data } = await res.json()
    if (!data) return
    setGelanggangList(data)
    if (data.length === 1) {
      setSelectedGel(data[0].id)
      setGelanggangNama(data[0].nama)
      setPesertaAktif(data[0].peserta_aktif)
    }
  }

  function selectGelanggang(gid: string) {
    setSelectedGel(gid)
    const gel = gelanggangList.find(g => g.id === gid)
    if (gel) { setPesertaAktif(gel.peserta_aktif); setGelanggangNama(gel.nama) }
    else { setPesertaAktif(null); setGelanggangNama('') }
    setNilai({}); setWaktuMenit(''); setWaktuDetik(''); setKeluarGelanggang(0); setMessage('')
  }

  // PIN login
  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!eventId) return
    setPinError('')
    setPinLoading(true)
    const res = await fetch(`/api/events/${eventId}/pin/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    })
    const result = await res.json()
    setPinLoading(false)
    if (result.success) {
      sessionStorage.setItem('juriToken', result.token)
      sessionStorage.setItem('juriTokenExpiry', result.expiredAt)
      setAuthed(true)
    } else {
      setPinError(result.message || 'PIN tidak valid.')
      setPin('')
    }
  }

  // Scoring
  const kriteriaKeys = useMemo(() => {
    if (!pesertaAktif) return []
    return KRITERIA_PER_KATEGORI[pesertaAktif.kategori] || []
  }, [pesertaAktif])

  function getRange(key: string) {
    if (!pesertaAktif) return { min: 0, max: 100 }
    if (key === 'orisinalitas') return ORISINALITAS_RANGE[pesertaAktif.kategori] || ORISINALITAS_RANGE.DEFAULT
    return KRITERIA_META[key] || { min: 0, max: 100 }
  }

  const waktuTotal = (parseInt(waktuMenit) || 0) * 60 + (parseInt(waktuDetik) || 0)

  const totalPreview = useMemo(() => {
    let base = Object.values(nilai).reduce((s, v) => s + (v || 0), 0)
    let penalti = 0
    if (pesertaAktif?.kategori === 'BERPASANGAN' && waktuTotal > 120) {
      const selisih = waktuTotal - 120
      if (selisih >= 11) penalti += 15
      else if (selisih >= 5) penalti += 5
      penalti += keluarGelanggang * 5
    }
    return { base, penalti, total: base - penalti }
  }, [nilai, pesertaAktif, waktuTotal, keluarGelanggang])

  async function handleSubmit() {
    if (!pesertaAktif || !eventId) return
    if (!juri) return setMessage('Pilih posisi juri.')
    if (!namaJuri.trim()) return setMessage('Nama juri wajib diisi.')
    if (waktuTotal <= 0) return setMessage('Isi waktu tampil.')

    setSaving(true); setMessage('')
    const res = await fetch(`/api/events/${eventId}/nilai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peserta_id: pesertaAktif.id,
        posisi_juri: juri, nama_juri: namaJuri.trim(),
        nilai, waktu_detik: waktuTotal,
        keluar_gelanggang: keluarGelanggang,
        kategori: pesertaAktif.kategori,
      })
    })
    const result = await res.json()
    setSaving(false)
    if (!res.ok) return setMessage(result.error || 'Gagal menyimpan.')
    setMessage('Penilaian tersimpan!')
    setNilai({}); setWaktuMenit(''); setWaktuDetik(''); setKeluarGelanggang(0); setJuri(''); setNamaJuri('')
  }

  // ==================== RESOLVING ====================
  if (resolving) return <div className="flex min-h-screen items-center justify-center bg-krem"><p className="text-coklat">Memuat...</p></div>
  if (resolveError) return <div className="flex min-h-screen items-center justify-center bg-krem"><p className="text-merah-error font-bold">{resolveError}</p></div>

  // ==================== PIN MODAL ====================
  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-krem">
        <div className="w-full max-w-xs rounded-xl border-l-4 border-emas bg-putih-gading p-8 shadow-lg text-center">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">Akses Juri</h1>
          <p className="mt-1 text-xs text-coklat mb-1">{eventNama}</p>
          <p className="text-[10px] text-gray-400 mb-5">Masukkan PIN untuk membuka form penilaian.</p>
          <form onSubmit={handlePinSubmit}>
            <input type="password" inputMode="numeric" maxLength={6} value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] focus:border-emas focus:outline-none"
              placeholder="••••••" autoFocus />
            {pinError && <p className="mt-2 text-xs font-bold text-merah-error">{pinError}</p>}
            <button type="submit" disabled={pinLoading}
              className="mt-4 w-full rounded-lg bg-hijau-tua py-3 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
              {pinLoading ? 'Memvalidasi...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ==================== SCORING UI ====================
  return (
    <div className="min-h-screen bg-krem">
      <header className="bg-gradient-to-br from-hijau-tua to-hijau-sedang text-putih-gading">
        <div className="mx-auto max-w-lg px-4 py-4 text-center">
          <h1 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-emas-terang">Form Penilaian Juri</h1>
          <p className="text-xs opacity-80">{eventNama}{gelanggangNama && ` — 🏟️ ${gelanggangNama}`}</p>
        </div>
        <div className="h-1" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #B8860B 0 6px, #D4A843 6px 12px)' }} />
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {/* Gelanggang selector (shown if > 1 gelanggang) */}
        {gelanggangList.length > 1 && (
          <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-4 shadow">
            <label className="text-xs font-bold text-hijau-sedang mb-1 block">Pilih Gelanggang</label>
            <select value={selectedGel} onChange={e => selectGelanggang(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 font-medium focus:border-emas focus:outline-none">
              <option value="">Pilih gelanggang...</option>
              {gelanggangList.map(g => (
                <option key={g.id} value={g.id}>
                  {g.nama} {g.peserta_aktif ? `— ▶ ${g.peserta_aktif.no_urut}` : '(kosong)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Peserta aktif */}
        {pesertaAktif ? (
          <div className="rounded-xl border-2 border-dashed border-emas bg-putih-gading p-4 shadow">
            <div className="text-[10px] font-bold text-hijau-sedang mb-1">▶ SEDANG TAMPIL</div>
            <div className="font-bold text-hijau-tua">{pesertaAktif.no_urut}</div>
            <div className="text-sm text-coklat">{(pesertaAktif.anggota || []).join(', ')}</div>
            <div className="text-xs text-gray-500 mt-1">{pesertaAktif.kategori} · {pesertaAktif.golongan} · {pesertaAktif.kontingen?.nama || '-'}</div>
          </div>
        ) : (
          <div className="rounded-xl bg-putih-gading p-8 text-center shadow">
            <p className="text-coklat text-sm">Menunggu peserta tampil...</p>
            <p className="text-xs text-gray-400 mt-1">Halaman akan update otomatis saat admin mengaktifkan peserta.</p>
          </div>
        )}

        {pesertaAktif && (
          <>
            {/* Juri */}
            <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-4 shadow space-y-3">
              <select value={juri} onChange={e => setJuri(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-emas focus:outline-none">
                <option value="">Pilih posisi juri</option>
                {JURI_LIST.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              <input value={namaJuri} onChange={e => setNamaJuri(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-emas focus:outline-none"
                placeholder="Nama lengkap juri" />
            </div>

            {/* Nilai */}
            <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-4 shadow space-y-3">
              {kriteriaKeys.map(key => {
                const meta = KRITERIA_META[key]
                const range = getRange(key)
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-coklat">{meta.nama}</span>
                      <span className="text-[10px] text-gray-400">{range.min}–{range.max}</span>
                    </div>
                    <input type="number" inputMode="numeric" min={range.min} max={range.max}
                      value={nilai[key] ?? ''} onChange={e => setNilai(n => ({ ...n, [key]: parseFloat(e.target.value) || 0 }))}
                      className={`mt-1 w-full rounded-lg border-2 px-3 py-2.5 focus:outline-none ${
                        nilai[key] !== undefined && (nilai[key] < range.min || nilai[key] > range.max) ? 'border-merah-error bg-red-50' : 'border-gray-200 focus:border-emas'
                      }`} />
                  </div>
                )
              })}

              {/* Waktu */}
              <div>
                <span className="text-sm font-semibold text-coklat">Waktu Tampil</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" inputMode="numeric" min="0" max="59" value={waktuMenit}
                    onChange={e => setWaktuMenit(e.target.value)}
                    className="w-16 rounded-lg border-2 border-gray-200 px-2 py-2.5 text-center focus:border-emas focus:outline-none" placeholder="mm" />
                  <span className="font-bold text-coklat">:</span>
                  <input type="number" inputMode="numeric" min="0" max="59" value={waktuDetik}
                    onChange={e => setWaktuDetik(e.target.value)}
                    className="w-16 rounded-lg border-2 border-gray-200 px-2 py-2.5 text-center focus:border-emas focus:outline-none" placeholder="ss" />
                </div>
              </div>

              {pesertaAktif.kategori === 'BERPASANGAN' && (
                <div>
                  <span className="text-sm font-semibold text-coklat">Keluar Gelanggang</span>
                  <input type="number" inputMode="numeric" min="0" value={keluarGelanggang}
                    onChange={e => setKeluarGelanggang(parseInt(e.target.value) || 0)}
                    className="mt-1 w-20 rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-emas focus:outline-none" />
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between rounded-xl bg-hijau-tua p-4 shadow">
              <span className="font-bold text-white">Total</span>
              <span className={`font-[family-name:var(--font-cinzel)] text-3xl font-bold ${
                totalPreview.total >= 230 ? 'text-green-300' : totalPreview.total >= 210 ? 'text-emas-terang' : 'text-gray-300'
              }`}>
                {totalPreview.total}
                {totalPreview.penalti > 0 && <span className="ml-1 text-sm text-red-300">(−{totalPreview.penalti})</span>}
              </span>
            </div>

            {message && (
              <p className={`text-sm font-bold text-center ${message.includes('tersimpan') ? 'text-hijau-sedang' : 'text-merah-error'}`}>
                {message}
              </p>
            )}

            <button onClick={handleSubmit} disabled={saving}
              className="w-full rounded-xl bg-hijau-tua py-4 font-bold text-emas-terang text-lg hover:brightness-110 disabled:opacity-60 shadow-lg">
              {saving ? 'Menyimpan...' : 'Simpan Penilaian'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
