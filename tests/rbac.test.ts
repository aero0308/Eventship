/**
 * Role-based access control tests.
 * RBAC rules (src/lib/permissions.ts):
 * - EVENT_MANAGER: full control.
 * - EMPLOYEE: read-only + status updates on assigned tasks.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { EMPLOYEE, MANAGER, TestClient, loginAs, waitForServer } from './helpers'

let employee!: TestClient
let manager!: TestClient

beforeAll(async () => {
  await waitForServer()
  manager = await loginAs(MANAGER)
  employee = await loginAs(EMPLOYEE)
}, 60_000)

describe('team management is manager-only', () => {
  it('employee cannot create a team (403)', async () => {
    const res = await employee.post('/teams', { name: 'Employee Shadow Team' })
    expect(res.status).toBe(403)
  })

  it('anonymous cannot create a team (401)', async () => {
    const res = await new TestClient().post('/teams', { name: 'Ghost Team' })
    expect(res.status).toBe(401)
  })

  it('manager can create a team (201) — cleaned up afterwards', async () => {
    const created = await manager.post<{ team: { id: string } }>('/teams', {
      name: `QA RBAC Team ${Date.now()}`,
      description: 'created by rbac.test.ts',
    })
    expect(created.status).toBe(201)
    expect(created.data.team.id).toBeTruthy()

    const removed = await manager.del(`/teams/${created.data.team.id}`)
    expect(removed.status).toBe(200)
  })
})

describe('user administration is manager-only', () => {
  it('employee cannot patch another user (403)', async () => {
    const managerMe = await manager.get<{ user: { id: string } }>('/auth/me')
    const targetId = managerMe.data.user.id
    const res = await employee.patch(`/users/${targetId}`, { isActive: false })
    expect(res.status).toBe(403)
  })

  it('employee cannot deactivate themselves via the admin route (403)', async () => {
    const me = await employee.get<{ user: { id: string } }>('/auth/me')
    const res = await employee.patch(`/users/${me.data.user.id}`, { role: 'EVENT_MANAGER' })
    expect(res.status).toBe(403)
  })
})

describe('read access is authenticated-but-shared', () => {
  it('employee can list teams and events (200)', async () => {
    const teams = await employee.get('/teams')
    expect(teams.status).toBe(200)
    const events = await employee.get('/events')
    expect(events.status).toBe(200)
  })

  it('anonymous read is rejected with 401', async () => {
    const res = await new TestClient().get('/events')
    expect(res.status).toBe(401)
  })
})
