'use client'

import PusherClient from 'pusher-js'

let pusherInstance: PusherClient | null = null

export function getPusherClient(): PusherClient | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

  if (!key || !cluster) return null

  if (!pusherInstance) {
    pusherInstance = new PusherClient(key, { cluster })
  }
  return pusherInstance
}
