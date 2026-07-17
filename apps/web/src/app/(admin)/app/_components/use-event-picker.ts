'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export type PickerEvent = { id: string; nama: string; prefix: string; tahun: number }

// 'peserta' tidak punya sub-route sendiri, ditangani oleh /app/events/[id] (tab default)
export function featurePath(key: string) {
  return key === 'peserta' ? '' : key
}

export function useEventPicker() {
  const router = useRouter()
  const [events, setEvents] = useState<PickerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [targetPath, setTargetPath] = useState('')

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(({ data }) => {
      setEvents(data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const navigate = useCallback((eventId: string, path: string) => {
    setShowModal(false)
    router.push(`/app/events/${eventId}/${path}`)
  }, [router])

  const pickEventAndNavigate = useCallback((path: string) => {
    if (events.length === 1) {
      navigate(events[0].id, path)
    } else {
      setTargetPath(path)
      setShowModal(true)
    }
  }, [events, navigate])

  const selectEvent = useCallback((eventId: string) => {
    navigate(eventId, targetPath)
  }, [navigate, targetPath])

  return { events, loading, showModal, setShowModal, pickEventAndNavigate, selectEvent }
}
