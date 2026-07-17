'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

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
  'ATT': { min: 35, max: 50 },
  'DEFAULT': { min: 39, max: 50 },
}

type Peserta = { id: string; no_urut: string; kategori: string; golongan: string; anggota: string[]; kontingen: { nama: string } | null }
type Gelanggang = { id: string; nama: string; peserta_aktif: Peserta | null }

export default function PenilaianPage() {
  const { id: eventId } = useParams()
  const [gelanggang, setGelanggang] = useState<Gelanggang[]>([])
  const [selectedGel, setSelectedGel] = useState('')
  const [peserta, setPeserta] = useState<Peserta | null>(null)
  const [juri, setJuri] = useState('')
  const [namaJuri, setNamaJuri] = useState('')
  const [nilai, setNilai] = useState<Record<string, number>>({})
  const [waktuMenit, setWaktuMenit] = useState('')
  const [waktuDetik, setWaktuDetik] = useState('')
  const [keluarGelanggang, setKeluarGelanggang] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadGelanggang() }, [])

  async function loadGelanggang() {
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}/gelanggang`)
    const { data } = await res.json()
    setGelanggang(data || [])
    setLoading(false)
  }

  function selectGelanggang(gid: string) {
    setSelectedGel(gid)
    const gel = gelanggang.find(g => g.id === gid)
    setPeserta(gel?.peserta_aktif || null)
    resetForm()
  }

  function resetForm() {
    setJuri(''); setNamaJuri(''); setNilai({}); setWaktuMenit(''); setWaktuDetik(''); setKeluarGelanggang(0); setMessage('')
  }

  const kriteriaKeys = useMemo(() => {
    if (!peserta) return []
    return KRITERIA_PER_KATEGORI[peserta.kategori] || []
  }, [peserta])

  function getRange(key: string, kategori: string) {
    if (key === 'orisinalitas') return ORISINALITAS_RANGE[kategori] || ORISINALITAS_RANGE.DEFAULT
    return KRITERIA_META[key] || { min: 0, max: 100 }
  }

  const waktuTotal = (parseInt(waktuMenit) || 0) * 60 + (parseInt(waktuDetik) || 0)

  const totalPreview = useMemo(() => {
    let base = Object.values(nilai).reduce((s, v) => s + (v || 0), 0)
    let penalti = 0
    if (peserta?.kategori === 'BERPASANGAN' && waktuTotal > 120) {
      const selisih = waktuTotal - 120
      if (selisih >= 11) penalti += 15
      else if (selisih >= 5) penalti += 5
      penalti += keluarGelanggang * 5
    }
    return { base, penalti, total: base - penalti }
  }, [nilai, peserta, waktuTotal, keluarGelanggang])

  async function handleSubmit() {
    if (!peserta) return setMessage('Pilih gelanggang dengan peserta aktif.')
    if (!juri) return setMessage('Pilih posisi juri.')
    if (!namaJuri.trim()) return setMessage('Nama juri wajib diisi.')
    if (waktuTotal <= 0) return setMessage('Isi waktu tampil.')

    setSaving(true)
    setMessage('')
    const res = await fetch(`/api/events/${eventId}/nilai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peserta_id: peserta.id,
        posisi_juri: juri,
        nama_juri: namaJuri.trim(),
        nilai,
        waktu_detik: waktuTotal,
        keluar_gelanggang: keluarGelanggang,
        kategori: peserta.kategori,
      })
    })
    const result = await res.json()
    setSaving(false)

    if (!res.ok) return setMessage(result.error || 'Gagal menyimpan.')
    setMessage('Penilaian tersimpan!')
    resetForm()
  }

  if (loading) return <div className="py-8 text-center text-coklat">Memuat...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/app/events/${eventId}`} className="text-sm text-coklat hover:underline">← Detail Event</Link>
        <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">Form Penilaian</h2>
      </div>

      {/* Step 1: Pilih Gelanggang */}
      <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow">
        <h3 className="text-sm font-bold text-hijau-sedang mb-2">Langkah 1 — Pilih Gelanggang</h3>
        <select value={selectedGel} onChange={e => selectGelanggang(e.target.value)}
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none">
          <option value="">Pilih gelanggang...</option>
          {gelanggang.map(g => (
            <option key={g.id} value={g.id}>
              {g.nama} {g.peserta_aktif ? `— ▶ ${g.peserta_aktif.no_urut}` : '(kosong)'}
            </option>
          ))}
        </select>

        {peserta && (
          <div className="mt-3 rounded-lg bg-hijau-tua/5 border border-dashed border-emas p-3 text-sm space-y-0.5">
            <div className="text-xs font-bold text-hijau-sedang">▶ SEDANG TAMPIL</div>
            <div><b>No. Urut:</b> {peserta.no_urut}</div>
            <div><b>Kategori:</b> {peserta.kategori} | <b>Golongan:</b> {peserta.golongan}</div>
            <div><b>Peserta:</b> {(peserta.anggota || []).join(', ')}</div>
          </div>
        )}
        {selectedGel && !peserta && (
          <p className="mt-2 text-sm text-merah-error">Belum ada peserta aktif di gelanggang ini.</p>
        )}
      </div>

      {peserta && (
        <>
          {/* Step 2: Juri */}
          <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow">
            <h3 className="text-sm font-bold text-hijau-sedang mb-2">Langkah 2 — Pilih Juri</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={juri} onChange={e => setJuri(e.target.value)}
                className="rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none">
                <option value="">Posisi juri</option>
                {JURI_LIST.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              <input value={namaJuri} onChange={e => setNamaJuri(e.target.value)}
                className="rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none"
                placeholder="Nama lengkap juri" />
            </div>
          </div>

          {/* Step 3: Nilai */}
          <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-5 shadow">
            <h3 className="text-sm font-bold text-hijau-sedang mb-3">Langkah 3 — Input Nilai</h3>
            <div className="space-y-3">
              {kriteriaKeys.map(key => {
                const meta = KRITERIA_META[key]
                const range = getRange(key, peserta.kategori)
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

            {/* Waktu */}
            <div className="mt-4">
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

            {/* Keluar gelanggang (BERPASANGAN only) */}
            {peserta.kategori === 'BERPASANGAN' && (
              <div className="mt-3">
                <label className="text-sm font-semibold text-coklat">Keluar Gelanggang (kali)</label>
                <input type="number" inputMode="numeric" min="0" value={keluarGelanggang}
                  onChange={e => setKeluarGelanggang(parseInt(e.target.value) || 0)}
                  className="mt-1 w-24 rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-emas focus:outline-none" />
                {keluarGelanggang > 0 && (
                  <p className="mt-1 text-xs font-bold text-merah-error">{keluarGelanggang}× keluar → −{keluarGelanggang * 5} poin</p>
                )}
              </div>
            )}

            {/* Total */}
            <div className="mt-4 flex items-center justify-between rounded-lg bg-hijau-tua p-4">
              <span className="font-bold text-white">Total Nilai</span>
              <span className={`text-2xl font-bold font-[family-name:var(--font-cinzel)] ${
                totalPreview.total >= 230 ? 'text-green-300' : totalPreview.total >= 210 ? 'text-emas-terang' : 'text-gray-300'
              }`}>
                {totalPreview.total}
                {totalPreview.penalti > 0 && <span className="ml-2 text-sm text-red-300">(−{totalPreview.penalti})</span>}
              </span>
            </div>

            {message && (
              <p className={`mt-3 text-sm font-semibold ${message.includes('tersimpan') ? 'text-hijau-sedang' : 'text-merah-error'}`}>
                {message}
              </p>
            )}

            <button onClick={handleSubmit} disabled={saving}
              className="mt-4 w-full rounded-lg bg-hijau-tua py-3 font-bold text-emas-terang hover:brightness-110 disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan Penilaian'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
