/**
 * Phase 7 QA probe: socket auth + room delivery.
 * Usage: bun .qa/qa-p7-auth.ts <mode: no-cookie|bad-cookie|good-cookie> [seconds]
 * - no-cookie   : expect REJECT (Authentication required)
 * - bad-cookie  : expect REJECT (Authentication failed)
 * - good-cookie : expects CONNECT + presence under the server-validated identity
 * Login happens through the :81 gateway so the cookie matches production flow.
 */
const GATEWAY = 'http://127.0.0.1:81'
const mode = process.argv[2] ?? 'no-cookie'
const aliveMs = Number(process.argv[3] ?? 6) * 1000

const { io } = await import('/home/z/my-project/node_modules/socket.io-client/build/esm/index.js')

let cookie: string | null = null
if (mode === 'good-cookie') {
  const res = await fetch(`${GATEWAY}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@eventflow.io', password: 'password123' }),
  })
  const setCookie = res.headers.get('set-cookie') ?? ''
  cookie = setCookie.split(';')[0] || null
  if (!cookie) {
    console.log('PROBE-FAIL: could not obtain session cookie', res.status)
    process.exit(1)
  }
}

const extraHeaders: Record<string, string> = {}
if (mode === 'bad-cookie') extraHeaders.cookie = 'ems_session=forged-token-value'
if (mode === 'good-cookie' && cookie) extraHeaders.cookie = cookie

const socket = io('http://127.0.0.1:81/?XTransformPort=3003', {
  path: '/',
  transports: ['websocket', 'polling'],
  reconnection: false,
  timeout: 6000,
  extraHeaders,
})

const done = (code: number) => {
  try { socket.disconnect() } catch {}
  setTimeout(() => process.exit(code), 50)
}

socket.on('connect', () => {
  console.log(`PROBE[${mode}]: CONNECTED id=${socket.id}`)
  socket.emit(
    'room:join',
    { rooms: ['event:qa-probe-room'], user: { id: 'spoofed-id', fullName: 'Spoofed Name', role: 'EVENT_MANAGER' }, presenceRooms: ['event:qa-probe-room'] },
    (ack: { ok?: boolean; viewers?: Record<string, unknown[]> }) => {
      const viewers = ack?.viewers?.['event:qa-probe-room'] ?? []
      console.log(`PROBE[${mode}]: room:join ack ok=${ack?.ok} viewers=${JSON.stringify(viewers)}`)
      done(0)
    }
  )
})
socket.on('connect_error', (err: Error) => {
  console.log(`PROBE[${mode}]: REJECTED — ${err.message}`)
  done(0)
})
setTimeout(() => {
  console.log(`PROBE[${mode}]: TIMEOUT (no result in ${aliveMs}ms)`)
  done(1)
}, aliveMs)
