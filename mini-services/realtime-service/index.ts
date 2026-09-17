/**
 * Eventship realtime service (socket.io)
 *
 * Public : port 3003 — websocket endpoint reached through the Caddy gateway as
 *          `io('/?XTransformPort=3003')` (path must stay '/').
 * Internal: 127.0.0.1:3004 — loopback-only HTTP endpoint the Next.js API
 *          routes call to broadcast (`POST /emit`). Never exposed publicly.
 *
 * Rooms:
 *   event:{eventId} — board activity for one event (task created/updated/deleted, comments)
 *   team:{teamId}   — team-wide activity (roster edits, task fan-out for the team)
 *   user:{userId}   — personal channel (new notifications)
 *
 * Auth (Phase 7): every socket handshake is authenticated with the app's
 * `ems_session` cookie (forwarded by the Caddy gateway on the same origin).
 * The cookie is validated against the Next.js API (`/api/auth/me` over
 * loopback) and the resulting identity is authoritative — clients cannot
 * claim someone else's name/presence. Unauthenticated sockets are rejected.
 *
 * Presence: every `event:*`/`board:*` room tracks connected viewers
 * (id + name + role) and broadcasts the list whenever it changes, so pages
 * can show who is looking at the same board right now.
 *
 * Typing: clients emit `comment:typing` ({room, user}) while composing a task
 * comment; the server relays it to everyone else in the room (rate-limited).
 *
 * data:echo — every board/team broadcast is echoed SITE-WIDE with a minimal
 * {room, event} hint (never the payload — payloads may be role-restricted),
 * so surfaces that join no rooms (dashboard, activity feed) can refresh live
 * without leaking data: refetches go through the role-scoped REST API.
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

// ---------- handshake authentication (Phase 7) ----------

const NEXT_AUTH_URL = 'http://127.0.0.1:3000/api/auth/me'

function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const name = part.slice(0, eq).trim()
    if (name === 'ems_session') {
      const value = part.slice(eq + 1).trim()
      return value.length > 0 ? value : null
    }
  }
  return null
}

interface AuthedUser {
  id: string
  fullName: string
  role: string
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

/**
 * Validate the session cookie against the Next.js API and attach the
 * authoritative identity to the socket. Rejects the handshake when the
 * cookie is missing/invalid or when the auth API is unreachable — mirrors the
 * spec's `ConnectionRefusedError('Authentication failed')` behavior.
 */
io.use(async (socket, next) => {
  try {
    const token = extractSessionCookie(socket.handshake.headers.cookie)
    if (!token) {
      next(new Error('Authentication required'))
      return
    }
    const res = await fetch(NEXT_AUTH_URL, {
      headers: { cookie: `ems_session=${token}` },
      // Generous timeout: in dev, the first /api/auth/me hit can trigger a
      // cold compile. A miss here is safe — the client retries with backoff.
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      next(new Error('Authentication failed'))
      return
    }
    const body = (await res.json()) as { user?: { id?: string; fullName?: string; role?: string } }
    const user = body.user
    if (!user?.id || !user.fullName) {
      next(new Error('Authentication failed'))
      return
    }
    socket.data.user = { id: user.id, fullName: user.fullName, role: user.role ?? 'EMPLOYEE' } as AuthedUser
    next()
  } catch {
    next(new Error('Authentication failed'))
  }
})

io.on('connection', (socket) => {
  socket.data.joinedRooms = new Set<string>()
  // Rooms where THIS socket announces presence (subset of joinedRooms).
  socket.data.presenceRooms = new Set<string>()
  // Authoritative identity from the handshake auth middleware.
  const authedUser = socket.data.user as AuthedUser | undefined

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
      // The server-validated identity always wins over the client-provided one.
      const user = authedUser ?? payload.user
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
    // Relay only for authenticated sockets, under the server-validated identity.
    const user = authedUser
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
        // Site-wide echo with a MINIMAL hint (no payload — payloads may carry
        // role-restricted data). Surfaces like the dashboard/activity feed
        // listen for these to trigger live refetches through the REST API.
        // Board changes ride as `board:changed` with the semantic type inside
        // data.type — unwrap it so the echo carries `task:updated` etc.
        let echoEvent = event
        if (event === 'board:changed' && data && typeof data === 'object' && typeof (data as { type?: unknown }).type === 'string') {
          echoEvent = (data as { type: string }).type
        }
        if (
          (room.startsWith('event:') || room.startsWith('board:') || room.startsWith('team:')) &&
          (echoEvent.startsWith('task:') || echoEvent.startsWith('comment:') || echoEvent === 'event:updated' || echoEvent === 'team:updated')
        ) {
          io.emit('data:echo', { room, event: echoEvent, at: new Date().toISOString() })
        }
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
