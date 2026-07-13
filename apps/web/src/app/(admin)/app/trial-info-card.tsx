'use client'

import { useState } from 'react'

export function TrialInfoCard({
  status,
  sisaHari,
  totalHari,
  berlakuHingga,
}: {
  status: string
  sisaHari: number
  totalHari: number
  berlakuHingga: string | null
}) {
  const [showModal, setShowModal] = useState(false)

  const formatTanggal = (tgl: string | null) => {
    if (!tgl) return '-'
    return new Date(tgl).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (status === 'trial') {
    const progress = totalHari > 0 ? ((totalHari - sisaHari) / totalHari) * 100 : 0

    return (
      <>
        <div className="mb-6 rounded-xl border-l-4 border-emas bg-gradient-to-r from-yellow-50 to-emas/10 p-5 shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">⏳</span>
                <h3 className="font-[family-name:var(--font-cinzel)] text-sm font-bold uppercase tracking-wide text-hijau-tua">
                  Masa Trial
                </h3>
              </div>
              <p className="mb-3 text-sm text-coklat">
                Akun Anda dalam masa trial. Sisa <b>{sisaHari} hari</b> sebelum akun tersuspend.
              </p>

              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between text-xs text-coklat">
                  <span>
                    {totalHari - sisaHari} / {totalHari} hari berlalu
                  </span>
                  <span>{sisaHari} hari tersisa</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-emas transition-all"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-600">
                Berakhir: <b>{formatTanggal(berlakuHingga)}</b>
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex-shrink-0 rounded-lg bg-hijau-tua px-4 py-2.5 text-sm font-bold text-emas-terang transition hover:brightness-110"
            >
              💚 Dukung Kami
            </button>
          </div>
        </div>

        {showModal && <DonateModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  if (status === 'active') {
    return (
      <>
        <div className="mb-6 rounded-xl border-l-4 border-hijau-sedang bg-gradient-to-r from-green-50 to-hijau-tua/5 p-5 shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">💚</span>
                <h3 className="font-[family-name:var(--font-cinzel)] text-sm font-bold uppercase tracking-wide text-hijau-tua">
                  Terima Kasih Atas Dukungan Anda
                </h3>
              </div>
              <p className="mb-1 text-sm text-coklat">
                Akun Anda aktif hingga <b>{formatTanggal(berlakuHingga)}</b>.
              </p>
              <p className="text-xs text-gray-600">
                Dukungan Anda membantu layanan ini tetap berjalan dengan baik untuk semua pengguna.
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex-shrink-0 rounded-lg bg-hijau-tua px-4 py-2.5 text-sm font-bold text-emas-terang transition hover:brightness-110"
            >
              💚 Donate Lagi
            </button>
          </div>
        </div>

        {showModal && <DonateModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  if (status === 'suspended' || status === 'expired') {
    return (
      <>
        <div className="rounded-xl border-l-4 border-merah-error bg-gradient-to-r from-red-50 to-red-100/50 p-8 text-center shadow">
          <div className="mb-3 text-4xl">⚠️</div>
          <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">
            {status === 'suspended' ? 'Akun Tersuspend' : 'Masa Berlaku Habis'}
          </h2>
          <p className="mt-3 text-coklat">
            {status === 'suspended' ? (
              <>Akun Anda tersuspend karena masa trial telah berakhir. Silakan donasi untuk mengaktifkan kembali akun.</>
            ) : (
              <>
                Masa berlaku akun Anda sudah habis pada <b>{formatTanggal(berlakuHingga)}</b>. Silakan perpanjang dengan
                melakukan donasi.
              </>
            )}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 inline-block rounded-lg bg-hijau-tua px-6 py-3 font-bold text-emas-terang transition hover:brightness-110"
          >
            🔓 Aktivasi via Donate
          </button>
        </div>

        {showModal && <DonateModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  return null
}

function DonateModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 text-center">
          <div className="mb-2 text-4xl">💚</div>
          <h3 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-hijau-tua">Dukung Pasanggiri</h3>
        </div>

        <div className="mb-5 space-y-3 rounded-lg bg-emas/5 p-4 text-sm text-coklat">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0 text-base">ℹ️</span>
            <p className="font-bold text-hijau-tua">PENTING UNTUK DIKETAHUI</p>
          </div>

          <p>Setiap akun yang dibuat hanya aktif selama <b>7 hari</b>.</p>

          <p>
            Jika tidak melakukan donasi, akun akan <b>tersuspend</b> setelah melewati masa trial.
          </p>

          <p>
            Kebijakan ini bertujuan mengurangi beban server sehingga event pengguna lain juga bisa berjalan dengan lancar.
            Dengan berdonasi, Anda membantu layanan ini tetap tersedia untuk semua.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href="https://lynk.id/kkmht/n7nd13n58nx2"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-hijau-tua px-6 py-3 text-center font-bold text-emas-terang transition hover:brightness-110"
          >
            💚 Lanjut ke Halaman Donasi
          </a>
          <button
            onClick={onClose}
            className="rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-coklat transition hover:bg-gray-50"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
