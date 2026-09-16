/**
 * Multi-tenant room system tests — onboarding gate, room create/join,
 * tenant isolation, owner management and regeneration endpoints.
 *
 * Isolation contract: a user in Room A can NEVER read or write Room B's
 * data (the row resolves as 404, never 403 — existence is not disclosed),
 * and cross-room references (teams/events/assignees) are rejected.
 */

import { beforeAll, afterAll, describe, expect, it } from 'bun:test'
import { TestClient, expectErrorContains, newXff, uniqueEmail, waitForServer } from './helpers'

const PASSWORD = 'Str0ng!Passphrase'

interface RoomShape {
  id: string
  roomCode: string
  name: string
  ownerId: string
  memberCount: number | null
  members?: { id: string; fullName: string; email: string }[]
}

/** Register a fresh user (always lands room-less) and return its client + email. */
async function registerFresh(prefix: string): Promise<{ client: TestClient; email: string; userId: string }> {
  const client = new TestClient(newXff())
  const email = uniqueEmail(prefix)
  const res = await client.post<{ user: { id: string; role: string; needsOnboarding: boolean } }>('/auth/register', {
    email,
    password: PASSWORD,
    fullName: `QA ${prefix}`,
    // Multi-tenant contract: self-service role selection is ignored server-side.
    role: 'EVENT_MANAGER',
  })
  expect(res.status).toBe(201)
  expect(res.data.user.role).toBe('EMPLOYEE') // role grants happen at onboarding, never at signup
  expect(res.data.user.needsOnboarding).toBe(true)
  return { client, email, userId: res.data.user.id }
}

const ctx: {
  a?: { client: TestClient; room: RoomShape }
  b?: { client: TestClient; room: RoomShape }
  fixtures?: { teamId: string; eventId: string; taskId: string }
  joined?: { client: TestClient; userId: string }
} = {}

beforeAll(async () => {
  await waitForServer()
}, 60_000)

afterAll(async () => {
  // Owners clean up their rooms — which also exercises DELETE and drops every
  // member back to the onboarding gate (asserted in the delete test).
  for (const tenant of [ctx.b, ctx.a]) {
    if (tenant?.room && tenant.client) {
      await tenant.client.del(`/rooms/${tenant.room.id}`)
    }
  }
})

describe('onboarding gate', () => {
  it('reports needsOnboarding=true for fresh registrations (anonymous → 401)', async () => {
    const anon = await new TestClient().get('/auth/onboarding-status')
    expect(anon.status).toBe(401)

    const fresh = await registerFresh('gate')
    const status = await fresh.client.get<{ needsOnboarding: boolean; roomId: string | null }>('/auth/onboarding-status')
    expect(status.status).toBe(200)
    expect(status.data.needsOnboarding).toBe(true)
    expect(status.data.roomId).toBeNull()
  })

  it('blocks every data endpoint with 403 until a room exists', async () => {
    const fresh = await registerFresh('gate2')
    for (const path of ['/teams', '/events', '/tasks', '/users', '/dashboard', '/activity']) {
      const res = await fresh.client.get(path)
      expect(res.status).toBe(403)
      expectErrorContains(res, 'onboarding')
    }
  })
})

describe('create room (owner path)', () => {
  it('creates a room, promotes the creator to EVENT_MANAGER and stamps the code format', async () => {
    const fresh = await registerFresh('ownerA')
    const res = await fresh.client.post<{ room: RoomShape }>('/rooms', {
      name: `QA Isolation Room A ${Date.now()}`,
      password: 'JoinMe22!',
      description: 'primary fixture',
    })
    expect(res.status).toBe(201)
    expect(res.data.room.roomCode).toMatch(/^EVT-[A-Z2-9]{6}$/)
    expect(res.data.room.memberCount).toBe(1)

    const me = await fresh.client.get<{ user: { role: string; roomId: string | null; needsOnboarding: boolean } }>('/auth/me')
    expect(me.data.user.role).toBe('EVENT_MANAGER')
    expect(me.data.user.needsOnboarding).toBe(false)
    expect(me.data.user.roomId).toBe(res.data.room.id)

    ctx.a = { client: fresh.client, room: res.data.room }
  })

  it('rejects a second room while already a member (409)', async () => {
    const res = await ctx.a!.client.post('/rooms', { name: 'Second Room', password: 'JoinMe22!' })
    expect(res.status).toBe(409)
  })

  it('rejects short room passwords (400)', async () => {
    const fresh = await registerFresh('shortpw')
    const res = await fresh.client.post('/rooms', { name: 'Short PW Room', password: 'abc' })
    expect(res.status).toBe(400)
  })
})

describe('join room (member path)', () => {
  it('rejects a wrong password with a uniform 401 (no oracle)', async () => {
    const res = await (await registerFresh('joinbad')).client.post('/rooms/join', {
      roomCode: ctx.a!.room.roomCode,
      password: 'WrongPassword1!',
    })
    expect(res.status).toBe(401)
    expectErrorContains(res, 'Invalid Room ID or Password')
  })

  it('rejects an unknown room code with the same uniform 401', async () => {
    const res = await (await registerFresh('joinunknown')).client.post('/rooms/join', {
      roomCode: 'EVT-ZZZZZZ',
      password: 'JoinMe22!',
    })
    expect(res.status).toBe(401)
    expectErrorContains(res, 'Invalid Room ID or Password')
  })

  it('rejects malformed codes (400)', async () => {
    const res = await (await registerFresh('joinmalformed')).client.post('/rooms/join', {
      roomCode: 'NOT-A-CODE',
      password: 'JoinMe22!',
    })
    expect(res.status).toBe(400)
  })

  it('joins with the correct code + password as a member (role stays EMPLOYEE)', async () => {
    const fresh = await registerFresh('joiner')
    const res = await fresh.client.post<{ room: RoomShape }>('/rooms/join', {
      roomCode: ctx.a!.room.roomCode,
      password: 'JoinMe22!',
    })
    expect(res.status).toBe(200)
    expect(res.data.room.id).toBe(ctx.a!.room.id)
    expect(res.data.room.memberCount).toBe(2)

    const me = await fresh.client.get<{ user: { role: string; needsOnboarding: boolean } }>('/auth/me')
    expect(me.data.user.role).toBe('EMPLOYEE')
    expect(me.data.user.needsOnboarding).toBe(false)

    ctx.joined = fresh
  })

  it('refuses a second join while already in a room (409)', async () => {
    const res = await ctx.joined!.client.post('/rooms/join', {
      roomCode: ctx.a!.room.roomCode,
      password: 'JoinMe22!',
    })
    expect(res.status).toBe(409)
  })
})

describe('tenant isolation', () => {
  it('room B cannot see room A at all', async () => {
    const freshB = await registerFresh('ownerB')
    const created = await freshB.client.post<{ room: RoomShape }>('/rooms', {
      name: `QA Isolation Room B ${Date.now()}`,
      password: 'JoinB99!',
    })
    expect(created.status).toBe(201)
    ctx.b = { client: freshB.client, room: created.data.room }

    // Rooms listing shows only B's room (via /auth/me room link).
    const me = await freshB.client.get<{ user: { roomId: string | null } }>('/auth/me')
    expect(me.data.user.roomId).toBe(ctx.b!.room.id)
    expect(me.data.user.roomId).not.toBe(ctx.a!.room.id)
  })

  it('data created in room A never appears in room B (list + detail + cross-room writes)', async () => {
    // Fixture inside room A.
    const team = await ctx.a!.client.post<{ team: { id: string } }>('/teams', {
      name: `QA Iso Team ${Date.now()}`,
    })
    expect(team.status).toBe(201)
    const teamId = team.data.team.id

    const event = await ctx.a!.client.post<{ event: { id: string } }>('/events', {
      name: 'Isolation Proof Event',
      startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 8 * 86400000).toISOString(),
      teamId,
    })
    expect(event.status).toBe(201)
    const eventId = event.data.event.id

    const task = await ctx.a!.client.post<{ task: { id: string } }>('/tasks', {
      title: 'Isolation proof task',
      eventId,
    })
    expect(task.status).toBe(201)
    ctx.fixtures = { teamId, eventId, taskId: task.data.task.id }

    // Room B's lists must not contain room A's rows.
    const bEvents = await ctx.b!.client.get<{ events: { id: string }[] }>('/events')
    expect(bEvents.status).toBe(200)
    expect(bEvents.data.events.some((e) => e.id === eventId)).toBe(false)

    const bTasks = await ctx.b!.client.get<{ tasks: { id: string }[] }>('/tasks')
    expect(bTasks.status).toBe(200)
    expect(bTasks.data.tasks.some((t) => t.id === ctx.fixtures!.taskId)).toBe(false)

    // Direct detail access across rooms resolves as 404 (never 403/leak).
    const bEventDetail = await ctx.b!.client.get(`/events/${eventId}`)
    expect(bEventDetail.status).toBe(404)
    const bTaskDetail = await ctx.b!.client.get(`/tasks/${ctx.fixtures.taskId}`)
    expect(bTaskDetail.status).toBe(404)
    const bTeamDetail = await ctx.b!.client.get(`/teams/${teamId}`)
    expect(bTeamDetail.status).toBe(404)

    // Cross-room write attempts are rejected.
    const bEventInATeam = await ctx.b!.client.post('/events', {
      name: 'Smuggled Event',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      teamId,
    })
    expect(bEventInATeam.status).toBe(404)

    // The member who joined room A DOES see the fixture (positive control).
    const aMemberEvents = await ctx.joined!.client.get<{ events: { id: string }[] }>('/events')
    expect(aMemberEvents.status).toBe(200)
    expect(aMemberEvents.data.events.some((e) => e.id === eventId)).toBe(true)
  })

  it('user directory is room-scoped', async () => {
    const bUsers = await ctx.b!.client.get<{ users: { id: string }[] }>('/users')
    expect(bUsers.status).toBe(200)
    const ids = bUsers.data.users.map((u) => u.id)
    expect(ids).not.toContain(ctx.a!.room.ownerId)
    expect(ids).toContain(ctx.b!.room.ownerId)
  })
})

describe('owner management', () => {
  it('non-owners cannot manage the room (403); members can read it', async () => {
    const put = await ctx.joined!.client.put(`/rooms/${ctx.a!.room.id}`, { name: 'Hijacked Name' })
    expect(put.status).toBe(403)

    const regenCode = await ctx.joined!.client.post('/rooms/regenerate-code')
    expect(regenCode.status).toBe(403)

    const regenPw = await ctx.joined!.client.post('/rooms/regenerate-password', {})
    expect(regenPw.status).toBe(403)

    const del = await ctx.joined!.client.del(`/rooms/${ctx.a!.room.id}`)
    expect(del.status).toBe(403)

    // Non-member probes resolve as 404 (existence not disclosed).
    const outsiderRead = await ctx.b!.client.get(`/rooms/${ctx.a!.room.id}`)
    expect(outsiderRead.status).toBe(404)

    // Members can read the room.
    const memberRead = await ctx.joined!.client.get<{ room: RoomShape }>(`/rooms/${ctx.a!.room.id}`)
    expect(memberRead.status).toBe(200)
  })

  it('owner can rename the room (200)', async () => {
    const res = await ctx.a!.client.put<{ room: RoomShape }>(`/rooms/${ctx.a!.room.id}`, {
      name: 'QA Isolation Room A (renamed)',
      description: 'updated by rooms.test.ts',
    })
    expect(res.status).toBe(200)
    expect(res.data.room.name).toBe('QA Isolation Room A (renamed)')
  })

  it('regenerating the code invalidates the old code for joins', async () => {
    const oldCode = ctx.a!.room.roomCode
    const regen = await ctx.a!.client.post<{ room: RoomShape }>('/rooms/regenerate-code')
    expect(regen.status).toBe(200)
    expect(regen.data.room.roomCode).not.toBe(oldCode)
    ctx.a!.room.roomCode = regen.data.room.roomCode

    const staleJoin = await (await registerFresh('stalejoin')).client.post('/rooms/join', {
      roomCode: oldCode,
      password: 'JoinMe22!',
    })
    expect(staleJoin.status).toBe(401)
  })

  it('regenerating the password revokes the old password immediately', async () => {
    const rot = await ctx.a!.client.post<{ roomPassword: string }>('/rooms/regenerate-password', {
      password: 'FreshJoin77!',
    })
    expect(rot.status).toBe(200)
    expect(rot.data.roomPassword).toBe('FreshJoin77!')

    const oldPw = await (await registerFresh('oldpw')).client.post('/rooms/join', {
      roomCode: ctx.a!.room.roomCode,
      password: 'JoinMe22!',
    })
    expect(oldPw.status).toBe(401)

    const newPw = await (await registerFresh('newpw')).client.post('/rooms/join', {
      roomCode: ctx.a!.room.roomCode,
      password: 'FreshJoin77!',
    })
    expect(newPw.status).toBe(200)
  })

  it('deleting the room drops every member back to onboarding', async () => {
    const res = await ctx.a!.client.del<{ deleted: boolean }>(`/rooms/${ctx.a!.room.id}`)
    expect(res.status).toBe(200)
    expect(res.data.deleted).toBe(true)
    ctx.a = undefined

    const memberStatus = await ctx.joined!.client.get<{ needsOnboarding: boolean }>('/auth/onboarding-status')
    expect(memberStatus.status).toBe(200)
    expect(memberStatus.data.needsOnboarding).toBe(true)

    const memberData = await ctx.joined!.client.get('/events')
    expect(memberData.status).toBe(403)
  })
})
