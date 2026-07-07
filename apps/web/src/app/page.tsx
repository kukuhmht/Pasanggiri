import Link from 'next/link'
import { Footer } from '@/components/footer'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="bg-gradient-to-br from-hijau-tua to-hijau-sedang text-putih-gading">
        <div className="mx-auto max-w-5xl px-6 py-12 text-center">
          <h1 className="font-[family-name:var(--font-cinzel)] text-3xl font-bold text-emas-terang md:text-4xl">
            Pasanggiri
          </h1>
          <p className="mt-2 text-sm opacity-90">
            Platform Pendaftaran & Penilaian Pencak Silat Persinas ASAD
          </p>
        </div>
        <div className="h-1.5 bg-repeating-linear-gradient" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #B8860B 0 8px, #D4A843 8px 16px)'
        }} />
      </header>

      {/* Hero */}
      <main className="mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-xl border-l-4 border-emas bg-putih-gading p-8 shadow-md">
          <h2 className="font-[family-name:var(--font-cinzel)] text-2xl font-semibold text-hijau-tua">
            Kelola Event Pasanggiri dengan Mudah
          </h2>
          <p className="mt-4 text-coklat">
            Pendaftaran peserta, penilaian juri, gelanggang real-time, dan hasil otomatis — 
            semua dalam satu platform.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="rounded-lg bg-hijau-tua px-6 py-3 font-bold text-emas-terang transition hover:brightness-110"
            >
              Daftar Sebagai Penyelenggara
            </Link>
            <Link
              href="/login"
              className="rounded-lg border-2 border-hijau-sedang px-6 py-3 font-bold text-hijau-tua transition hover:bg-hijau-tua/5"
            >
              Masuk
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
