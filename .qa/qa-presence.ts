/**
 * QA probe: join `board:tasks` as a second user so the admin browser session
 * should show a presence avatar stack in the Tasks page header.
 * (Scratch file — safe to delete.)
 */
import { io } from 'socket.io-client'

const socket = io('http://127.0.0.1:3003', { path: '/', transports: ['websocket'] })

socket.on('connect', () => {
  socket.emit(
    'room:join',
    { rooms: ['board:tasks'], user: { id: 'qa-david', fullName: 'David Kim', role: 'TEAM_LEADER' } },
    (ack: { ok: boolean; viewers: Record<string, unknown[]> }) => {
      console.log('joined, viewers per room:', JSON.stringify(ack))
      // Stay connected for 25s so the browser session can render the stack.
      setTimeout(() => {
        socket.close()
        process.exit(0)
      }, 25000)
    }
  )
})

socket.on('connect_error', (err: Error) => {
  console.error('connect_error:', err.message)
  process.exit(1)
})
