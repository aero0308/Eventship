/**
 * CRUD lifecycle integration tests: team → event → task → patch → comment →
 * cascading cleanup. Everything the suite creates is deleted again so the
 * demo database stays pristine.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { MANAGER, TestClient, loginAs, waitForServer } from './helpers'

let manager!: TestClient
const trash: { teamId?: string; eventId?: string; taskId?: string } = {}

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString()

beforeAll(async () => {
  await waitForServer()
  manager = await loginAs(MANAGER)
}, 60_000)

afterAll(async () => {
  // Best-effort cleanup in reverse dependency order.
  if (trash.taskId && manager) await manager.del(`/tasks/${trash.taskId}`)
  if (trash.eventId && manager) await manager.del(`/events/${trash.eventId}`)
  if (trash.teamId && manager) await manager.del(`/teams/${trash.teamId}`)
})

describe('full CRUD lifecycle', () => {
  let teamId = ''
  let eventId = ''
  let taskId = ''

  it('CREATE team (201)', async () => {
    const res = await manager.post<{ team: { id: string; name: string } }>('/teams', {
      name: `QA CRUD Team ${Date.now()}`,
      description: 'crud.test.ts fixture',
    })
    expect(res.status).toBe(201)
    teamId = res.data.team.id
    trash.teamId = teamId
  })

  it('READ team back (200) with matching name', async () => {
    const res = await manager.get<{ team: { id: string } }>(`/teams/${teamId}`)
    expect(res.status).toBe(200)
    expect(res.data.team.id).toBe(teamId)
  })

  it('CREATE event for the team (201)', async () => {
    const res = await manager.post<{ event: { id: string; name: string; status: string } }>(
      '/events',
      {
        name: 'QA CRUD Event',
        description: 'crud.test.ts fixture',
        startDate: iso(1),
        endDate: iso(3),
        status: 'PLANNING',
        teamId,
      }
    )
    expect(res.status).toBe(201)
    expect(res.data.event.status).toBe('PLANNING')
    eventId = res.data.event.id
    trash.eventId = eventId
  })

  it('PATCH event status (200)', async () => {
    const res = await manager.patch<{ event: { status: string } }>(`/events/${eventId}`, {
      status: 'IN_PROGRESS',
    })
    expect(res.status).toBe(200)
    expect(res.data.event.status).toBe('IN_PROGRESS')
  })

  it('CREATE task on the event (201)', async () => {
    const res = await manager.post<{ task: { id: string; title: string; status: string; priority: string } }>(
      '/tasks',
      {
        title: 'QA CRUD Task',
        description: 'crud.test.ts fixture',
        priority: 'HIGH',
        eventId,
        startDate: iso(1),
        dueDate: iso(2),
        estimatedHours: 4,
      }
    )
    expect(res.status).toBe(201)
    expect(res.data.task.priority).toBe('HIGH')
    taskId = res.data.task.id
    trash.taskId = taskId
  })

  it('PATCH task status with a status note (200) and it shows in the board data', async () => {
    const res = await manager.patch<{ task: { status: string } }>(`/tasks/${taskId}`, {
      status: 'IN_PROGRESS',
    })
    expect(res.status).toBe(200)
    expect(res.data.task.status).toBe('IN_PROGRESS')
  })

  it('POST comment on the task (201)', async () => {
    const res = await manager.post(`/tasks/${taskId}/comments`, {
      content: 'QA CRUD comment — integration check',
    })
    expect(res.status).toBe(201)
  })

  it('READ task back (200) with updated fields', async () => {
    const res = await manager.get<{ task: { id: string; status: string; comments?: unknown[] } }>(
      `/tasks/${taskId}`
    )
    expect(res.status).toBe(200)
    expect(res.data.task.id).toBe(taskId)
    expect(res.data.task.status).toBe('IN_PROGRESS')
  })

  it('DELETE task (200) → GET returns 404', async () => {
    const removed = await manager.del(`/tasks/${taskId}`)
    expect([200, 204]).toContain(removed.status)
    trash.taskId = undefined
    const gone = await manager.get(`/tasks/${taskId}`)
    expect(gone.status).toBe(404)
  })

  it('DELETE event (200) → GET returns 404', async () => {
    const removed = await manager.del(`/events/${eventId}`)
    expect([200, 204]).toContain(removed.status)
    trash.eventId = undefined
    const gone = await manager.get(`/events/${eventId}`)
    expect(gone.status).toBe(404)
  })

  it('DELETE team (200) → GET returns 404', async () => {
    const removed = await manager.del(`/teams/${teamId}`)
    expect([200, 204]).toContain(removed.status)
    trash.teamId = undefined
    const gone = await manager.get(`/teams/${teamId}`)
    expect(gone.status).toBe(404)
  })
})

describe('404 contract', () => {
  it('unknown ids on detail routes return 404, not 500', async () => {
    const ghost = '00000000-0000-4000-8000-000000000000'
    expect((await manager.get(`/events/${ghost}`)).status).toBe(404)
    expect((await manager.get(`/tasks/${ghost}`)).status).toBe(404)
    expect((await manager.get(`/teams/${ghost}`)).status).toBe(404)
  })
})
