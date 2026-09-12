/** Listen for data:echo broadcasts for N seconds. Usage: bun .qa/qa-p7-echo.ts [seconds] */
const { io } = await import('/home/z/my-project/node_modules/socket.io-client/build/esm/index.js')
const seconds = Number(process.argv[2] ?? 8)

const login = await fetch('http://127.0.0.1:81/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@eventflow.io', password: 'password123' }),
})
const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]

const socket = io('http://127.0.0.1:81/?XTransformPort=3003', {
  path: '/',
  transports: ['websocket', 'polling'],
  reconnection: false,
  extraHeaders: { cookie },
})
socket.on('connect', () => console.log(`echo-listener connected (${socket.id})`))
socket.on('data:echo', (payload: unknown) => console.log('ECHO:', JSON.stringify(payload)))
socket.on('board:changed', (payload: unknown) => console.log('BOARD:', JSON.stringify(payload).slice(0, 120)))
setTimeout(() => process.exit(0), seconds * 1000)
