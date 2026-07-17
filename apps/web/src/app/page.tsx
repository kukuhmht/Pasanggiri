import Link from 'next/link'
import { getAdminClient } from '@/lib/auth'
import { DonateCTASection, DonateFloatingButton } from './(public)/donate-widget'

export const dynamic = 'force-dynamic'

async function getStats() {
  const db = getAdminClient()
  const { count: events } = await db.from('events').select('*', { count: 'exact', head: true })
  const { count: peserta } = await db.from('peserta').select('*', { count: 'exact', head: true })
  const { count: penilaian } = await db.from('penilaian').select('*', { count: 'exact', head: true })
  return { events: events || 0, peserta: peserta || 0, penilaian: penilaian || 0 }
}

export default async function LandingPage() {
  const { events, peserta, penilaian } = await getStats()

  const fitur = [
    { nama: 'Pendaftaran Online', icon: '📝', img: '/screenshots/pendaftaran.png', desc: 'Peserta daftar mandiri, data otomatis terorganisir.' },
    { nama: 'Gelanggang Real-Time', icon: '🏟️', img: '/screenshots/gelanggang.png', desc: 'Antrian tampil, stopwatch, & peserta aktif live.' },
    { nama: 'Penilaian Juri', icon: '👨🏼‍🏫', img: '/screenshots/penilaian.png', desc: 'Input nilai per kriteria, kalkulasi otomatis.' },
    { nama: 'Live Score Publik', icon: '🔴', img: '/screenshots/live-score.png', desc: 'Hasil tampil realtime untuk juri & publik.' },
    { nama: 'Rekap & Juara Umum', icon: '🏆', img: '/screenshots/rekap.png', desc: 'Otomatis ranking & poin juara kontingen.' },
    { nama: 'Dashboard Admin', icon: '📊', img: '/screenshots/dashboard.png', desc: 'Kelola event & peserta dalam satu layar.' },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-gradient-to-br from-hijau-tua to-hijau-sedang text-putih-gading">
        <nav className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <span className="font-[family-name:var(--font-cinzel)] font-bold text-xl text-emas-terang">Pasanggiri</span>
          <Link href="/login" className="rounded-lg bg-emas text-hijau-tua px-4 py-2 font-bold text-sm transition hover:brightness-110">Masuk</Link>
        </nav>
        <div className="mx-auto max-w-5xl px-6 py-12 text-center">
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-bold text-emas-terang md:text-5xl">PASANGGIRI</h1>
          <p className="mt-3 text-lg opacity-90">Platform Pendaftaran Kontingen & Digital Scoring Persinas Asad</p>
          <div className="mt-8 flex gap-3 justify-center">
            <Link href="/register" className="rounded-lg bg-white px-6 py-3 font-bold text-hijau-tua transition hover:brightness-110">Daftar Penyelenggara</Link>
            <Link href="/login" className="rounded-lg border-2 border-emas-terang px-6 py-3 font-bold text-emas-terang transition hover:bg-emas-terang/10">Masuk</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 space-y-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-hijau-tua">{events}+</div>
            <div className="text-sm text-coklat">Event Terselenggara</div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-hijau-tua">{peserta}+</div>
            <div className="text-sm text-coklat">Jumlah Peserta</div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-hijau-tua">{penilaian}+</div>
            <div className="text-sm text-coklat">Penilaian Selesai</div>
          </div>
        </div>

        <section>
          <h2 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-hijau-tua text-center mb-10">Fitur Utama</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fitur.map(f => (
              <div key={f.nama} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 transition hover:shadow-md">
                <div className="text-2xl mb-2">{f.icon}</div>
                <h3 className="font-bold text-hijau-tua mb-1">{f.nama}</h3>
                <p className="text-xs text-coklat mb-4">{f.desc}</p>
                <img src={f.img} alt={f.nama} className="rounded border shadow-sm w-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-hijau-tua rounded-2xl p-8 text-putih-gading text-center">
          <h2 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-emas-terang mb-6">Cara Kerja</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {['1. Buat Event', '2. Daftar Peserta', '3. Penilaian Juri', '4. Hasil Otomatis'].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emas text-hijau-tua font-bold">{i+1}</div>
                <p className="text-sm font-semibold">{s}</p>
              </div>
            ))}
          </div>
        </section>

        <DonateCTASection />
      </main>

      <DonateFloatingButton />
    </div>
  )
}
