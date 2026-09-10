/**
 * Server-side helper for broadcasting realtime events.
 *
 * Posts to the realtime mini-service's loopback emit API (127.0.0.1:3004).
 * Fire-and-forget by design: if the realtime service is down, API requests
 * still succeed — clients simply fall back to their 30s polling / refetches.
 * Import ONLY from route handlers / server code.
 */

const INTERNAL_EMIT_URL = 'http://127.0.0.1:3004/emit'

export interface RealtimeEmit {
  /** Target room, e.g. `event:<uuid>` or `user:<uuid>`. */
  room: string
  /** Event name, e.g. `board:changed` or `notification:new`. */
  event: string
  /** JSON payload delivered verbatim to clients. */
  data?: unknown
}

export async function emitRealtime({ room, event, data }: RealtimeEmit): Promise<void> {
  try {
    await fetch(INTERNAL_EMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, event, data }),
      signal: AbortSignal.timeout(1500),
    })
  } catch {
    // Realtime is best-effort — never fail an API request because of it.
  }
}

/** Broadcast a board change to everyone viewing a given event. */
export function emitBoardChange(eventId: string, type: string, actorId: string, extra?: Record<string, unknown>): void {
  void emitRealtime({
    room: `event:${eventId}`,
    event: 'board:changed',
    data: { type, eventId, actorId, at: new Date().toISOString(), ...extra },
  })
}
