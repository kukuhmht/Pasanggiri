import Pusher from 'pusher'

let pusherInstance: Pusher | null = null

export function getPusher(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY
  const secret = process.env.PUSHER_SECRET
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

  if (!appId || !key || !secret || !cluster) return null

  if (!pusherInstance) {
    pusherInstance = new Pusher({ appId, key, secret, cluster, useTLS: true })
  }
  return pusherInstance
}

/**
 * Trigger gelanggang update event.
 * Channel: `event-{eventId}`, Event: `gelanggang-update`
 */
export async function triggerGelanggangUpdate(eventId: string, data: unknown) {
  const pusher = getPusher()
  if (!pusher) return
  await pusher.trigger(`event-${eventId}`, 'gelanggang-update', data)
}

/**
 * Trigger nilai update event (when juri submits score).
 * Channel: `event-{eventId}`, Event: `nilai-update`
 */
export async function triggerNilaiUpdate(eventId: string, data: unknown) {
  const pusher = getPusher()
  if (!pusher) return
  await pusher.trigger(`event-${eventId}`, 'nilai-update', data)
}
