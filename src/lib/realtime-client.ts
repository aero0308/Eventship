'use client'

/**
 * Browser singleton for the EventFlow realtime service (socket.io).
 *
 * - Connects through the Caddy gateway: io('/?XTransformPort=3003', path '/').
 * - Rooms are grouped by "scope" (one per consuming component) so multiple
 *   mounted components manage disjoint room sets on the shared socket.
 * - Rejoins all scoped rooms automatically after a reconnect.
 * - Everything degrades silently: if the service is offline the socket simply
 *   never connects and pages keep working off their normal fetches.
 */

import { io, type Socket } from 'socket.io-client'

export interface RealtimeUser {
  id: string
  fullName: string
  role: string
}

export interface BoardChangePayload {
  type: string
  eventId: string
  actorId: string
  at: string
  taskId?: string
  bulk?: boolean
}

export interface PresenceUser {
  id: string
  fullName: string
  role: string
}

export interface PresencePayload {
  room: string
  viewers: PresenceUser[]
}

let socket: Socket | null = null
let currentUser: RealtimeUser | null = null
const scopes = new Map<string, Set<string>>()
const stateListeners = new Set<(connected: boolean) => void>()

function allRooms(): string[] {
  const union = new Set<string>()
  for (const rooms of scopes.values()) {
    for (const room of rooms) union.add(room)
  }
  return [...union]
}

function notifyState(connected: boolean) {
  for (const listener of stateListeners) {
    try {
      listener(connected)
    } catch {
      // A broken listener must not break the others.
    }
  }
}

export function getRealtimeSocket(): Socket | null {
  if (typeof window === 'undefined') return null
  if (socket) return socket
  socket = io('/?XTransformPort=3003', {
    path: '/',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 8000,
    timeout: 10000,
  })
  socket.on('connect', () => {
    const rooms = allRooms()
    if (rooms.length > 0) {
      socket?.emit('room:join', { rooms, user: currentUser })
    }
    notifyState(true)
  })
  socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') notifyState(false)
  })
  socket.on('connect_error', () => notifyState(false))
  return socket
}

/** Identify the signed-in user (used for presence + reconnect joins). */
export function setRealtimeUser(user: RealtimeUser | null) {
  currentUser = user
}

/**
 * Replace the room set for one scope. Leaving/joining is diffed so repeated
 * renders don't spam the server.
 */
export function setRealtimeRooms(scope: string, rooms: string[]) {
  if (typeof window === 'undefined') return
  const next = new Set(rooms)
  const previous = scopes.get(scope) ?? new Set<string>()
  const toLeave = [...previous].filter((room) => !next.has(room))
  const toJoin = [...next].filter((room) => !previous.has(room))
  scopes.set(scope, next)
  if (toLeave.length === 0 && toJoin.length === 0) return

  const sock = getRealtimeSocket()
  if (!sock) return
  if (toLeave.length > 0 && sock.connected) {
    sock.emit('room:leave', { rooms: toLeave })
  }
  if (toJoin.length > 0 && sock.connected) {
    sock.emit('room:join', { rooms: toJoin, user: currentUser })
  }
}

/** Release a scope's rooms (call from the component's cleanup). */
export function clearRealtimeRooms(scope: string) {
  setRealtimeRooms(scope, [])
}

/** Subscribe to realtime connection state. Returns an unsubscribe function. */
export function onRealtimeStateChange(listener: (connected: boolean) => void): () => void {
  stateListeners.add(listener)
  listener(socket?.connected ?? false)
  return () => {
    stateListeners.delete(listener)
  }
}

// Debug probe (harmless in prod; used by QA tooling to verify the socket).
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__realtimeDebug', {
    get() {
      return {
        hasSocket: socket !== null,
        connected: socket?.connected ?? false,
        listenerCount: stateListeners.size,
        scopes: [...scopes.entries()].map(([scope, rooms]) => ({ scope, rooms: [...rooms] })),
        socketId: socket?.id ?? null,
      }
    },
    configurable: true,
  })
}
