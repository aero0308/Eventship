/**
 * EventFlow realtime service (socket.io)
 *
 * Public : port 3003 — websocket endpoint reached through the Caddy gateway as
 *          `io('/?XTransformPort=3003')` (path must stay '/').
 * Internal: 127.0.0.1:3004 — loopback-only HTTP endpoint the Next.js API
 *          routes call to broadcast (`POST /emit`). Never exposed publicly.
 *
 * Rooms:
 *   event:{eventId} — board activity for one event (task created/updated/deleted, comments)
 *   user:{userId}   — personal channel (new notifications)
 *
 * Presence: every `event:*` room tracks connected viewers (id + name + role)
 * and broadcasts the list whenever it changes, so pages can show who is
 * looking at the same board right now.
 *
 * Typing: clients emit `comment:typing` ({room, user}) while composing a task
 * comment; the server relays it to everyone else in the room (rate-limited).
 */

import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'

const PORT = 3003
const INTERNAL_PORT = 3004

interface PresenceUser {
  id: string
  fullName: string
  role: string
}

/** room -> socketId -> presence */
const presence = new Map<string, Map<string, PresenceUser>>()

/** socketId:room -> last relayed typing ts (rate limit) */
const typingLast = new Map<string, number>()

/**
 * Rooms that CAN track presence. `event:{id}` rooms serve the event workspace
 * and per-event boards; `board:*` rooms serve global boards (e.g. `board:tasks`,
 * the all-tasks kanban) where no single event room applies.
 *
 * Membership alone does NOT imply presence: each socket keeps a separate
 * `presenceRooms` set (subset of its joined rooms) so background subscribers
 * (the tasks board listening to every event room, the calendar joining a
 * month's worth of rooms) don't show up as "viewing" those spaces everywhere.
 */
function isPresenceRoom(room: string): boolean {
  return room.startsWith('event:') || room.startsWith('board:')
}

function roomViewers(room: string): PresenceUser[] {
  const bySocket = presence.get(room)
  if (!bySocket) return []
  // Deduplicate by user id (same user may have several tabs).
  const seen = new Map<string, PresenceUser>()
  for (const user of bySocket.values()) {
    if (!seen.has(user.id)) seen.set(user.id, user)
  }
  return [...seen.values()]
}

function broadcastPresence(io: Server, room: string) {
  const viewers = roomViewers(room)
  io.to(room).emit('presence:updated', { room, viewers })
  // Site-wide echo (tiny payload) lets presence-observer surfaces — e.g. the
  // events grid, which joins no rooms — stay live without polling.
  io.emit('presence:global', { room, viewers })
}

function trackPresence(io: Server, socket: Socket, room: string, user: PresenceUser) {
  const bySocket = presence.get(room) ?? new Map<string, PresenceUser>()
  bySocket.set(socket.id, user)
  presence.set(room, bySocket)
  broadcastPresence(io, room)
}

function untrackPresence(io: Server, socket: Socket, room: string) {
  const bySocket = presence.get(room)
  if (!bySocket) return
  bySocket.delete(socket.id)
  if (bySocket.size === 0) presence.delete(room)
  // Always broadcast (roomViewers handles a missing map → []): observers like
  // the events grid rely on the final empty echo to clear their chips.
  broadcastPresence(io, room)
}

function forgetSocket(io: Server, socket: Socket) {
  const presenceRooms = (socket.data.presenceRooms as Set<string> | undefined) ?? new Set<string>()
  for (const room of presenceRooms) {
    untrackPresence(io, socket, room)
  }
  presenceRooms.clear()
}

const publicServer = createServer()

const io = new Server(publicServer, {
  // DO NOT change the path: the Caddy gateway forwards `/?XTransformPort=3003` here.
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  socket.data.joinedRooms = new Set<string>()
  // Rooms where THIS socket announces presence (subset of joinedRooms).
  socket.data.presenceRooms = new Set<string>()

  /**
   * Client joins a set of rooms. Rooms listed in `presenceRooms` announce the
   * user to other viewers; rooms joined only for subscriptions stay silent.
   * Legacy clients that omit `presenceRooms` keep the old behavior: every
   * event:/board: room they join tracks presence.
   */
  socket.on(
    'room:join',
    (
      payload: { rooms?: string[]; user?: PresenceUser; presenceRooms?: string[] },
      ack?: (response: { ok: boolean; viewers?: Record<string, PresenceUser[]> }) => void
    ) => {
      const rooms = Array.isArray(payload.rooms) ? payload.rooms.slice(0, 50) : []
      const user = payload.user
      const requestedPresence = Array.isArray(payload.presenceRooms)
        ? new Set(payload.presenceRooms.slice(0, 50))
        : null
      const joinedPresence = socket.data.presenceRooms as Set<string>
      const viewersByRoom: Record<string, PresenceUser[]> = {}

      for (const room of rooms) {
        if (typeof room !== 'string' || room.length === 0 || room.length > 128) continue
        socket.join(room)
        ;(socket.data.joinedRooms as Set<string>).add(room)
        if (!isPresenceRoom(room)) continue
        const wantsPresence = requestedPresence ? requestedPresence.has(room) : true
        if (wantsPresence) {
          if (user && typeof user.id === 'string' && typeof user.fullName === 'string') {
            trackPresence(io, socket, room, {
              id: user.id,
              fullName: user.fullName,
              role: user.role ?? 'EMPLOYEE',
            })
            joinedPresence.add(room)
          }
          viewersByRoom[room] = roomViewers(room)
        } else {
          // Re-joining as a silent subscriber: drop any stale presence.
          if (joinedPresence.has(room)) {
            joinedPresence.delete(room)
            untrackPresence(io, socket, room)
          }
          viewersByRoom[room] = roomViewers(room)
        }
      }
      ack?.({ ok: true, viewers: viewersByRoom })
    }
  )

  /** Leave specific rooms (component unmount / filter change). */
  socket.on('room:leave', (payload: { rooms?: string[] }) => {
    const rooms = Array.isArray(payload.rooms) ? payload.rooms : []
    const joined = socket.data.joinedRooms as Set<string>
    const joinedPresence = socket.data.presenceRooms as Set<string>
    for (const room of rooms) {
      socket.leave(room)
      joined.delete(room)
      if (joinedPresence.delete(room) && isPresenceRoom(room)) {
        untrackPresence(io, socket, room)
      }
    }
  })

  socket.on('disconnecting', () => {
    forgetSocket(io, socket)
  })

  socket.on('disconnect', () => {
    forgetSocket(io, socket)
    // Reap this socket's typing entries.
    for (const key of typingLast.keys()) {
      if (key.startsWith(`${socket.id}:`)) typingLast.delete(key)
    }
  })

  /**
   * Presence snapshot for observers that join no rooms (e.g. the events grid):
   * returns the current viewer list of every presence room matching one of the
   * requested prefixes (default: event:* only).
   */
  socket.on(
    'presence:summary',
    (
      payload: { prefixes?: string[] } | undefined,
      ack?: (response: { summaries: { room: string; viewers: PresenceUser[] }[] }) => void
    ) => {
      const raw = Array.isArray(payload?.prefixes) ? payload!.prefixes : ['event:']
      const prefixes = raw
        .filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length <= 64)
        .slice(0, 8)
      const match = (room: string) => prefixes.length === 0 || prefixes.some((p) => room.startsWith(p))
      const summaries = [...presence.keys()]
        .filter(match)
        .map((room) => ({ room, viewers: roomViewers(room) }))
      ack?.({ summaries })
    }
  )

  /**
   * Relay "someone is typing a comment" to the rest of an event room.
   * Client→server emit (high frequency, ephemeral) — never persisted, never
   * echoed back to the sender, rate-limited to one relay per 800ms.
   */
  socket.on('comment:typing', (payload: { room?: string; user?: PresenceUser }) => {
    const room = typeof payload?.room === 'string' ? payload.room : ''
    if (!room.startsWith('event:') || room.length > 128) return
    const user = payload.user
    if (!user || typeof user.id !== 'string' || typeof user.fullName !== 'string') return
    const key = `${socket.id}:${room}`
    const now = Date.now()
    if (now - (typingLast.get(key) ?? 0) < 800) return
    typingLast.set(key, now)
    socket.to(room).emit('comment:typing', {
      room,
      user: { id: user.id, fullName: user.fullName },
      at: new Date(now).toISOString(),
    })
  })
})

publicServer.listen(PORT, () => {
  console.log(`[realtime] socket.io listening on :${PORT} (path '/')`)
})

// ---------- internal loopback HTTP API (emit / health) ----------

const internalServer = createServer((req, res) => {
  const url = req.url ?? ''

  if (req.method === 'GET' && url.startsWith('/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'realtime', sockets: io.engine.clientsCount }))
    return
  }

  if (req.method === 'POST' && url.startsWith('/emit')) {
    let body = ''
    let overflow = false
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
      if (body.length > 64 * 1024) overflow = true
      if (overflow) req.destroy()
    })
    req.on('end', () => {
      if (overflow) return
      try {
        const { room, event, data } = JSON.parse(body) as { room?: string; event?: string; data?: unknown }
        if (typeof room !== 'string' || typeof event !== 'string' || room.length === 0 || room.length > 128) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'room and event are required (room <= 128 chars)' }))
          return
        }
        io.to(room).emit(event, data ?? {})
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

internalServer.listen(INTERNAL_PORT, '127.0.0.1', () => {
  console.log(`[realtime] internal emit API on 127.0.0.1:${INTERNAL_PORT}`)
})
