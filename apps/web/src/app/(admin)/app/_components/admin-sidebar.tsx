'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '../logout-button'
import { useEventPicker, featurePath } from './use-event-picker'
import { EventPickerModal } from './event-picker-modal'
import { PdfViewerModal } from './pdf-viewer-modal'

const FEATURES = [
  { key: 'peserta', title: 'Peserta', emoji: '🥋' },
  { key: 'penilaian', title: 'Penilaian', emoji: '👨🏼‍🏫' },
  { key: 'gelanggang', title: 'Gelanggang', emoji: '🏟️' },
  { key: 'rekap', title: 'Rekap', emoji: '🏆' },
  { key: 'pin', title: 'PIN', emoji: '🔐' },
]

export function AdminSidebar({ orgNama, isSuperAdmin, isActive }: { orgNama: string; isSuperAdmin: boolean; isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const pathname = usePathname()
  const { events, loading, showModal, setShowModal, pickEventAndNavigate, selectEvent } = useEventPicker()

  const isActiveLink = (href: string) => {
    if (href === '/app') return pathname === '/app'
    return pathname === href || pathname.startsWith(href + '/')
  }

  function handleClick(key: string) {
    setIsOpen(false)
    pickEventAndNavigate(featurePath(key))
  }

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2.5 xl:py-3 rounded-lg text-sm xl:text-base 2xl:text-lg font-semibold transition ${
      isActiveLink(href) ? 'bg-emas/20 text-emas-terang' : 'hover:bg-white/10'
    }`

  const disabledClass = 'opacity-50 cursor-not-allowed pointer-events-none'

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 lg:hidden bg-black/50" onClick={() => setIsOpen(false)} />}
      <button onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-hijau-tua text-emas-terang rounded-md shadow-lg text-lg"
        aria-label="Toggle menu">
        ☰
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 xl:w-72 2xl:w-80 flex flex-col bg-gradient-to-b from-hijau-tua to-hijau-sedang text-putih-gading transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform shadow-xl`}>
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/10">
          <h1 className="font-[family-name:var(--font-cinzel)] text-lg xl:text-xl 2xl:text-2xl font-bold text-emas-terang">
            {orgNama}
          </h1>
          <p className="text-xs xl:text-sm opacity-80 mt-1">Admin Dashboard</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <Link href="/app" onClick={() => setIsOpen(false)}
            className={linkClass('/app') + (isActive ? '' : disabledClass)}>
            <span className="text-xl">🏠</span> Dashboard
          </Link>
          <Link href="/app/events" onClick={() => setIsOpen(false)}
            className={linkClass('/app/events') + (isActive ? '' : disabledClass)}>
            <span className="text-xl">📋</span> Events
          </Link>
          <Link href="/app/settings" onClick={() => setIsOpen(false)}
            className={linkClass('/app/settings') + (isActive ? '' : disabledClass)}>
            <span className="text-xl">⚙️</span> Pengaturan
          </Link>
          <button
            onClick={() => { setIsOpen(false); setShowPdfModal(true) }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/10 xl:py-3 xl:text-base 2xl:text-lg ${isActive ? '' : disabledClass}`}
          >
            <span className="text-xl">📖</span> Peraturan
          </button>

          <div className="pt-6 mt-4 border-t border-white/10">
            <p className="text-[10px] xl:text-xs uppercase tracking-widest opacity-60 px-3 mb-2 font-bold">Shortcut Fitur</p>
            <div className="space-y-1">
              {FEATURES.map(f => (
                <button key={f.key} onClick={() => handleClick(f.key)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 xl:py-3 rounded-lg text-sm xl:text-base 2xl:text-lg font-medium hover:bg-white/10 transition text-left ${isActive ? '' : disabledClass}`}>
                  <span className="text-xl">{f.emoji}</span> {f.title}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Aksen emas */}
        <div className="h-1.5 flex-shrink-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #B8860B 0 8px, #D4A843 8px 16px)' }} />

        {/* Footer */}
        <div className="px-4 py-4 space-y-2 flex-shrink-0">
          {isSuperAdmin && (
            <Link href="/sa" onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs xl:text-sm font-semibold hover:bg-white/20">
              🛡️ Admin Pusat
            </Link>
          )}
          <LogoutButton />
        </div>
      </aside>

      {showModal && (
        <EventPickerModal
          events={events}
          loading={loading}
          onSelect={selectEvent}
          onClose={() => setShowModal(false)}
        />
      )}
      {showPdfModal && (
        <PdfViewerModal
          pdfUrl="/file/peraturan-pasanggiri.pdf"
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </>
  )
}
