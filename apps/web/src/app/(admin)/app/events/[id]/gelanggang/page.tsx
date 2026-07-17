'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getPusherClient } from '@/lib/pusher/client'
import { Spinner } from '@/components/spinner'

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeGelId, setActiveGelId] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [runningTimerGelId, setRunningTimerGelId] = useState<string | null>(null)
  const [pendingGelId, setPendingGelId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Subscribe to Pusher untuk update jumlah juri secara real-time
  useEffect(() => {
    if (!eventId) return
    const pusher = getPusherClient()
    if (!pusher) return
    const channel = pusher.subscribe(`event-${eventId}`)
    channel.bind('nilai-update', (data: { peserta_id: string }) => {
      setNilaiCount(prev => ({ ...prev, [data.peserta_id]: (prev[data.peserta_id] || 0) + 1 }))
    })
    return () => { channel.unbind_all(); pusher.unsubscribe(`event-${eventId}`) }
  }, [eventId])

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

  // Selesai tampil: clear peserta aktif
  async function selesaikanPenampilan(gid: string, antrianOverride?: string[]) {
    const updates: { peserta_aktif_id: null; antrian?: string[] } = { peserta_aktif_id: null }
    if (antrianOverride) updates.antrian = antrianOverride
    await updateGelanggang(gid, updates)
  }

  // Kirim waktu tampil ke juri (via Pusher, not DB)
  async function kirimWaktu(gid: string, waktu_detik: number) {
    const res = await fetch(`/api/events/${eventId}/gelanggang/${gid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waktu_detik })
    })
    if (res.ok) {
      setToast({ message: `Waktu ${waktu_detik} detik berhasil dikirim ke Juri!`, type: 'success' })
    } else {
      const { error } = await res.json()
      setToast({ message: `Gagal mengirim waktu: ${error}`, type: 'error' })
    }
  }

  // Tampilkan berikutnya: ambil pertama dari antrian → jadi aktif
  async function tampilkanBerikutnya(gid: string, antrianOverride?: string[]) {
    const gel = gelanggangList.find(g => g.id === gid)
    const source = antrianOverride ?? gel?.antrian
    if (!source?.length) return
    const [next, ...rest] = source
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

  if (loading) return <div className="flex items-center justify-center py-12 gap-2 text-coklat"><Spinner className="h-5 w-5" /> Memuat data...</div>

  const activeGel = gelanggangList.find(g => g.id === activeGelId) || gelanggangList[0]

  function handleTabClick(targetGelId: string) {
    if (runningTimerGelId && runningTimerGelId === activeGel?.id && targetGelId !== runningTimerGelId) {
      setPendingGelId(targetGelId)
    } else {
      setActiveGelId(targetGelId)
    }
  }

  function confirmTabSwitch() {
    setActiveGelId(pendingGelId)
    setPendingGelId(null)
  }

  return (
    <div className="space-y-6">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-bold text-white shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/app/events/${eventId}`} className="text-sm text-coklat hover:underline">← Detail Event</Link>
            <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">
              🏟️ Gelanggang & Antrian Tampil
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGuide(true)}
              className="rounded-lg bg-emas/10 px-3 py-1 text-xs font-medium text-hijau-tua hover:bg-emas/20">
              ℹ️ Panduan
            </button>
            <button onClick={() => setShowAddForm(v => !v)}
              className="rounded-lg bg-hijau-tua px-4 py-2 text-xs font-bold text-emas-terang hover:brightness-110">
              + Gelanggang
            </button>
          </div>
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

      {/* Gelanggang Tabs */}
      {gelanggangList.length > 1 && (
        <div className="flex gap-1 border-b-2 border-gray-200">
          {gelanggangList.map(g => (
            <button key={g.id} onClick={() => handleTabClick(g.id)}
              className={`relative -mb-0.5 rounded-t-lg border-2 border-b-0 px-4 py-2 text-sm font-bold transition ${
                activeGel?.id === g.id
                  ? 'border-gray-200 bg-putih-gading text-hijau-tua'
                  : 'border-transparent text-gray-400 hover:bg-gray-100'
              }`}>
              {g.peserta_aktif && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>}
              {g.nama}
            </button>
          ))}
        </div>
      )}

      {/* Tab Switch Confirmation Modal */}
      {pendingGelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingGelId(null)}>
          <div className="w-full max-w-sm rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-2">Pindah Gelanggang?</h3>
            <p className="text-sm text-coklat mb-4">Waktu sedang berjalan di gelanggang saat ini. Pindah tab akan menghentikan timer dan mengembalikannya ke 00:00. Lanjutkan?</p>
            <div className="flex gap-2">
              <button onClick={confirmTabSwitch}
                className="flex-1 rounded-lg bg-merah-error py-2.5 font-bold text-white hover:brightness-110">Ya, Pindah</button>
              <button onClick={() => setPendingGelId(null)}
                className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-coklat hover:bg-gray-50">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Panduan Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowGuide(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua mb-4">Panduan Penggunaan Gelanggang</h3>
            <ul className="list-disc pl-6 space-y-2 text-coklat text-sm">
              <li>Saat peserta sedang tampil (timer berjalan), <strong>JANGAN</strong> melakukan refresh halaman, menambah antrian, mengubah urutan tampil, berpindah menu, atau berpindah ke gelanggang lain. Tindakan tersebut akan menghentikan timer dan mengembalikannya ke 00:00.</li>
              <li>Untuk mengubah urutan tampil, gunakan <strong>perangkat lain</strong> (misal laptop terpisah) sehingga timer tidak terganggu.</li>
              <li>Waktu tampil sangat krusial bagi Juri karena Juri <strong>tidak dapat menginput waktu</strong> sendiri. Admin harus mengirim waktu lewat tombol "Kirim Waktu". Oleh karena itu, <strong>JANGAN</strong> mereset waktu atau keluar dari tampilan waktu sebelum mengklik "Kirim Waktu".</li>
            </ul>
            <button onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-hijau-tua px-4 py-2 font-bold text-emas-terang hover:brightness-110">Tutup</button>
          </div>
        </div>
      )}

      {/* Gelanggang Card */}
      {gelanggangList.length === 0 ? (
        <p className="text-center text-sm text-coklat py-8">Belum ada gelanggang.</p>
      ) : activeGel ? (
        <GelanggangCard
          key={activeGel.id}
          gel={activeGel}
          peserta={peserta}
          nilaiCount={nilaiCount}
          busyPesertaIds={busyPesertaIds}
          getPesertaInfo={getPesertaInfo}
          onTimerChange={(running) => setRunningTimerGelId(running ? activeGel.id : (runningTimerGelId === activeGel.id ? null : runningTimerGelId))}
          onSelesaikan={(antrian) => selesaikanPenampilan(activeGel.id, antrian)}
          onKirimWaktu={(waktu) => kirimWaktu(activeGel.id, waktu)}
          onNext={(antrian) => tampilkanBerikutnya(activeGel.id, antrian)}
          onRemoveAntrian={(idx) => removeFromAntrian(activeGel.id, idx)}
          onAddAntrian={(pid) => addToAntrian(activeGel.id, pid)}
          onReorder={(newArr) => reorderAntrian(activeGel.id, newArr)}
          onDelete={() => deleteGelanggang(activeGel.id)}
        />
      ) : null}
    </div>
  )
}

/* ==================== GELANGGANG CARD ==================== */
function GelanggangCard({ gel, peserta, nilaiCount, busyPesertaIds, getPesertaInfo, onSelesaikan, onKirimWaktu, onNext, onRemoveAntrian, onAddAntrian, onReorder, onDelete, onTimerChange }: {
  gel: Gelanggang
  peserta: Peserta[]
  nilaiCount: Record<string, number>
  busyPesertaIds: Set<string>
  getPesertaInfo: (id: string) => Peserta | undefined
  onSelesaikan: (antrianOverride?: string[]) => void
  onKirimWaktu: (waktu: number) => void
  onNext: (antrianOverride?: string[]) => void
  onRemoveAntrian: (idx: number) => void
  onAddAntrian: (pid: string) => void
  onReorder: (newArr: string[]) => void
  onDelete: () => void
  onTimerChange: (running: boolean) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [timer, setTimer] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [confirmSelesai, setConfirmSelesai] = useState(false)
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const [localAntrian, setLocalAntrian] = useState<string[]>(gel.antrian || [])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)
  const hasAlertedRef = useRef(false)

  // Sinkronisasi localAntrian dengan props saat berubah dari luar (Pusher/refresh)
  useEffect(() => { 
    if (!isEditingOrder) setLocalAntrian(gel.antrian || [])
  }, [gel.antrian, isEditingOrder])

  function playGong() {
    try {
      new Audio('/sounds/gongfx.mp3').play()
    } catch {}
  }

  useEffect(() => {
    onTimerChange(isActive)

    if (isActive) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isActive, onTimerChange])

  // Reset alert flag & timer when active peserta changes
  useEffect(() => {
    hasAlertedRef.current = false
    setTimer(0)
    setIsActive(false)
  }, [gel.peserta_aktif?.id])

  // Play gong when timer reaches category time limit
  useEffect(() => {
    if (!isActive || !gel.peserta_aktif || hasAlertedRef.current) return
    const kategori = gel.peserta_aktif.kategori
    const batas = kategori === 'BERPASANGAN' ? 120 : kategori === 'ATT' ? 300 : 180
    if (timer === batas) {
      hasAlertedRef.current = true
      playGong()
    }
  }, [timer, isActive, gel.peserta_aktif?.kategori])

  // Keyboard shortcut: Space to start/pause
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && (document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        setIsActive(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Warn user before leaving page if timer is active
  useEffect(() => {
    if (!isActive) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isActive])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${m}:${ss.toString().padStart(2, '0')}`
  }

  const getTimerColor = () => {
    if (!gel.peserta_aktif) return 'text-emas-terang'
    const kategori = gel.peserta_aktif.kategori
    const batas = kategori === 'BERPASANGAN' ? 120 : kategori === 'ATT' ? 300 : 180
    return timer >= batas ? 'text-red-500' : 'text-emas-terang'
  }

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

  function handleDragStart(idx: number) {
    dragItem.current = idx
  }
  function handleDragEnter(idx: number) {
    if (dragItem.current === null || dragItem.current === idx) return
    setLocalAntrian(prev => {
      const arr = [...prev]
      const [removed] = arr.splice(dragItem.current!, 1)
      arr.splice(idx, 0, removed)
      return arr
    })
    dragItem.current = idx
    dragOver.current = idx
  }
  function handleDragEnd() {
    dragItem.current = null
    dragOver.current = null
  }

  function saveOrder() {
    onReorder(localAntrian)
    setIsEditingOrder(false)
  }

  function cancelOrder() {
    setLocalAntrian(gel.antrian || [])
    setIsEditingOrder(false)
  }

  function handleRemoveItem(idx: number) {
    if (isEditingOrder) {
      setLocalAntrian(prev => prev.filter((_, i) => i !== idx))
    } else {
      onRemoveAntrian(idx)
    }
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setLocalAntrian(prev => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
  }

  function handleAddItem(pid: string) {
    if (isEditingOrder) {
      setLocalAntrian(prev => [...prev, pid])
    } else {
      onAddAntrian(pid)
    }
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
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-emas-terang uppercase">▶ Sedang Tampil</div>
            <div className={`font-mono text-3xl font-bold ${getTimerColor()}`}>{formatTime(timer)}</div>
          </div>
           <div className="text-lg font-bold">{(gel.peserta_aktif.anggota || []).join(', ')}</div>
           <div className="text-xs opacity-80 mt-0.5 mb-3">
             {gel.peserta_aktif.no_urut} · {gel.peserta_aktif.kategori} · {gel.peserta_aktif.golongan}
           </div>

          {isActive && (
            <div className="rounded-lg bg-red-500/20 text-red-100 text-xs px-3 py-2 mb-3 font-semibold">
              ⚠️ Waktu sedang berjalan — hindari refresh, pindah menu, pindah tab gelanggang, atau ubah antrian.
            </div>
          )}
           
           {/* Timer Controls */}
           <div className="flex gap-2 mb-2">
            {!isActive ? (
              <button onClick={() => setIsActive(true)}
                className="flex-1 rounded-lg bg-green-600 py-2 text-center text-sm font-bold text-white hover:brightness-110">
                ▶ Start
              </button>
            ) : (
              <button onClick={() => setIsActive(false)}
                className="flex-1 rounded-lg bg-yellow-500 py-2 text-center text-sm font-bold text-white hover:brightness-110">
                ⏸ Pause
              </button>
            )}
            <button onClick={() => setTimer(0)}
              className="flex-1 rounded-lg bg-gray-500 py-2 text-center text-sm font-bold text-white hover:brightness-110">
              ↺ Reset
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button onClick={() => onKirimWaktu(timer)}
              className="flex-1 rounded-lg bg-hijau-sedang/50 py-2.5 text-center text-sm font-bold text-white hover:bg-hijau-sedang/70 transition">
              📤 Kirim Waktu
            </button>
            <button onClick={() => setConfirmSelesai(true)}
              className="flex-1 rounded-lg bg-merah-error py-2.5 text-center text-sm font-bold text-white hover:brightness-110">
              ✔ Selesai Tampil
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-5 mb-4 rounded-xl border-2 border-dashed border-gray-300 p-4 text-center">
          <p className="text-sm text-gray-400">Tidak ada peserta tampil</p>
          {(gel.antrian || []).length > 0 && (
            <button onClick={() => { onNext(isEditingOrder ? localAntrian : undefined); if (isEditingOrder) setIsEditingOrder(false) }}
              className="mt-2 rounded-lg bg-hijau-tua px-4 py-2 text-xs font-bold text-emas-terang hover:brightness-110">
              ▶ Tampilkan Berikutnya
            </button>
          )}
        </div>
      )}

      {/* Antrian */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-coklat">
            Antrian Berikutnya ({localAntrian.length})
          </div>
          {!isEditingOrder ? (
            <button onClick={() => setIsEditingOrder(true)} disabled={localAntrian.length < 2}
              className="text-xs font-bold text-hijau-sedang hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed">
              ✎ Edit Urutan
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={saveOrder} className="text-xs font-bold text-green-600 hover:underline">💾 Simpan</button>
              <button onClick={cancelOrder} className="text-xs font-bold text-gray-400 hover:underline">Batal</button>
            </div>
          )}
        </div>

        {isEditingOrder && (
          <p className="text-[11px] text-coklat bg-emas/10 rounded-lg px-3 py-1.5 mb-2">
            Mode edit urutan aktif — seret item untuk mengatur ulang, lalu klik Simpan.
          </p>
        )}

        {localAntrian.length > 0 ? (
          <div className={`space-y-1 mb-3 ${isEditingOrder ? 'rounded-lg outline outline-2 outline-emas p-2 -m-2' : ''}`}>
            {localAntrian.map((pid, idx) => {
              const p = getPesertaInfo(pid)
              return (
                <div
                  key={`${pid}-${idx}`}
                  draggable={isEditingOrder}
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className={`flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm hover:shadow-md transition border border-gray-100 ${isEditingOrder ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {isEditingOrder && (
                    <div className="flex flex-col flex-shrink-0 -ml-1 mr-1">
                      <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                        className="text-hijau-sedang hover:text-hijau-tua text-xs leading-none disabled:text-gray-200 disabled:cursor-not-allowed">▲</button>
                      <button onClick={() => moveItem(idx, 1)} disabled={idx === localAntrian.length - 1}
                        className="text-hijau-sedang hover:text-hijau-tua text-xs leading-none disabled:text-gray-200 disabled:cursor-not-allowed">▼</button>
                    </div>
                  )}
                  <span className="text-gray-400 text-sm select-none">⠿</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {p ? (p.anggota || []).join(', ') : pid}
                    </div>
                    {p && (
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {p.kontingen?.nama || '-'} · {p.kategori} · {p.golongan}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{p?.no_urut || ''}</span>
                  <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 text-sm ml-1 flex-shrink-0">🗑️</button>
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
                <button key={p.id} onClick={() => { handleAddItem(p.id); setShowAdd(false); setSearch('') }}
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

      {/* Modal Konfirmasi Selesai Tampil */}
      {confirmSelesai && gel.peserta_aktif && (() => {
        const jumlahJuri = nilaiCount[gel.peserta_aktif.id] || 0
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmSelesai(false)}>
            <div className="w-full max-w-sm rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-2">Selesaikan Penampilan?</h3>
              <div className={`rounded-lg p-3 mb-4 ${
                jumlahJuri === 0 ? 'bg-red-50 border-2 border-red-300' :
                jumlahJuri < 5 ? 'bg-yellow-50 border-2 border-yellow-300' :
                'bg-green-50 border-2 border-green-300'
              }`}>
                <p className={`text-sm font-bold ${
                  jumlahJuri === 0 ? 'text-red-700' : jumlahJuri < 5 ? 'text-yellow-700' : 'text-green-700'
                }`}>
                  {jumlahJuri === 0 && 'Belum ada juri yang menilai!'}
                  {jumlahJuri > 0 && jumlahJuri < 5 && `Baru dinilai oleh ${jumlahJuri} dari 5 juri.`}
                  {jumlahJuri >= 5 && 'Semua 5 juri sudah menilai.'}
                </p>
                {jumlahJuri < 5 && (
                  <p className="text-xs text-gray-600 mt-1">Yakin ingin menyelesaikan penampilan?</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setConfirmSelesai(false); onSelesaikan(isEditingOrder ? localAntrian : undefined); if (isEditingOrder) setIsEditingOrder(false) }}
                  className="flex-1 rounded-lg bg-merah-error py-2.5 font-bold text-white hover:brightness-110">
                  Ya, Selesaikan
                </button>
                <button onClick={() => setConfirmSelesai(false)}
                  className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-coklat hover:bg-gray-50">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
