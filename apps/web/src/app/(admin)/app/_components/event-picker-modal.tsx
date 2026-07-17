'use client'

import type { PickerEvent } from './use-event-picker'

export function EventPickerModal({ events, loading, onSelect, onClose }: {
  events: PickerEvent[]
  loading?: boolean
  onSelect: (eventId: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-putih-gading p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-[family-name:var(--font-cinzel)] text-lg font-bold text-hijau-tua mb-4">Pilih Event</h3>
        {loading ? (
          <p className="text-sm text-coklat">Memuat...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-coklat mb-3 text-center py-4">Belum ada event.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {events.map(ev => (
              <button key={ev.id} onClick={() => onSelect(ev.id)}
                className="w-full rounded-lg border-2 border-gray-200 bg-white p-3 text-left transition hover:border-emas hover:bg-krem">
                <div className="font-bold text-hijau-tua">{ev.nama}</div>
                <div className="text-xs text-coklat">{ev.prefix} · {ev.tahun}</div>
              </button>
            ))}
          </div>
        )}
        <button onClick={onClose}
          className="mt-4 w-full rounded-lg border-2 border-gray-200 py-2 text-sm font-bold text-coklat hover:bg-gray-50">
          Batal
        </button>
      </div>
    </div>
  )
}
