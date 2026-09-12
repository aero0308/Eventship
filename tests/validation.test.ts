/**
 * Input validation tests — the zod contract (src/lib/schemas.ts) must reject
 * malformed payloads with a 400 and a human-readable `error` message.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { BASE_URL, MANAGER, TestClient, expectErrorContains, loginAs, waitForServer } from './helpers'

type ManagerClient = Awaited<ReturnType<typeof loginAs>>
let manager!: ManagerClient

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString()

beforeAll(async () => {
  await waitForServer()
  manager = await loginAs(MANAGER)
}, 60_000)

describe('event payload validation', () => {
  it('missing name → 400 mentioning name', async () => {
    const res = await manager.post('/events', {
      startDate: iso(1),
      endDate: iso(2),
      teamId: '00000000-0000-4000-8000-000000000001',
    })
    expect(res.status).toBe(400)
    expectErrorContains(res, 'name')
  })

  it('invalid teamId (not a uuid) → 400', async () => {
    const res = await manager.post('/events', {
      name: 'QA Validation Event',
      startDate: iso(1),
      endDate: iso(2),
      teamId: 'not-a-uuid',
    })
    expect(res.status).toBe(400)
  })

  it('invalid status enum → 400', async () => {
    const res = await manager.post('/events', {
      name: 'QA Validation Event',
      startDate: iso(1),
      endDate: iso(2),
      teamId: '00000000-0000-4000-8000-000000000001',
      status: 'ON_FIRE',
    })
    expect(res.status).toBe(400)
    expectErrorContains(res, 'status')
  })
})

describe('task payload validation', () => {
  it('missing title → 400 mentioning title', async () => {
    const res = await manager.post('/tasks', {
      eventId: '00000000-0000-4000-8000-000000000001',
      priority: 'HIGH',
    })
    expect(res.status).toBe(400)
    expectErrorContains(res, 'title')
  })

  it('invalid priority enum → 400', async () => {
    const res = await manager.post('/tasks', {
      title: 'QA Validation Task',
      eventId: '00000000-0000-4000-8000-000000000001',
      priority: 'URGENT',
    })
    expect(res.status).toBe(400)
    expectErrorContains(res, 'priority')
  })

  it('oversized title (200 chars) → 400', async () => {
    const res = await manager.post('/tasks', {
      title: 'x'.repeat(200),
      eventId: '00000000-0000-4000-8000-000000000001',
    })
    expect(res.status).toBe(400)
  })
})

describe('generic body handling', () => {
  it('malformed JSON body with a valid session → 400 "Invalid JSON body"', async () => {
    const res = await manager.postRaw<{ error: string }>('/tasks', '{not-json')
    expect(res.status).toBe(400)
    expectErrorContains(res, 'json')
  })

  it('empty body with a valid session → 400 (never 500)', async () => {
    const res = await manager.postRaw('/tasks', '')
    expect(res.status).toBe(400)
  })
})

describe('404 vs 400 precedence', () => {
  it('unknown team on event detail → 404', async () => {
    const res = await manager.get('/events/00000000-0000-4000-8000-00000000dead')
    expect(res.status).toBe(404)
  })
})

// Guard against accidental edits to BASE_URL drift between helpers and tests.
describe('suite sanity', () => {
  it('targets the configured base url', () => {
    expect(new URL(`${BASE_URL}/api/health`).protocol).toBe('http:')
  })
  it('TestClient is exported and constructible', () => {
    expect(new TestClient() instanceof TestClient).toBe(true)
  })
})
