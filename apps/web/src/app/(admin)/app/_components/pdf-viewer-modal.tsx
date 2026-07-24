'use client'

import { useEffect, useRef } from 'react'

interface PdfViewerModalProps {
  pdfUrl: string
  onClose: () => void
}

export function PdfViewerModal({ pdfUrl, onClose }: PdfViewerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-5xl h-[90vh] bg-putih-gading rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emas/20 bg-gradient-to-r from-hijau-tua to-hijau-sedang">
          <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-emas-terang">
            📖 Buku Peraturan Pasanggiri Asad
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-putih-gading hover:bg-white/20 transition"
          >
            ✕ Tutup
          </button>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 bg-gray-100">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Peraturan Pasanggiri Asad"
          />
        </div>
      </div>
    </div>
  )
}
