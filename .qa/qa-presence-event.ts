/** QA probe: join the gala event room to verify event-detail presence. */
import { io } from 'socket.io-client'
const roomId = process.argv[2] ?? 'event:8e0f5647-8c50-40cd-99b8-2b51433f5e60'
const socket = io('http://127.0.0.1:3003', { path: '/', transports: ['websocket'] })
socket.on('connect', () => {
  socket.emit('room:join', { rooms: [roomId], user: { id: 'qa-sofia', fullName: 'Sofia Reyes', role: 'TEAM_LEADER' } }, () => {
    setTimeout(() => { socket.close(); process.exit(0) }, 15000)
  })
})
socket.on('connect_error', () => process.exit(1))
