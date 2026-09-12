/**
 * Auth integration tests — register, login, session lifecycle, 401 contract.
 * Every client uses its own fake IP so login/register rate limits never
 * interfere across tests (rate limiting itself is covered in security.test.ts).
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import {
  BASE_URL,
  EMPLOYEE,
  MANAGER,
  TestClient,
  loginAs,
  uniqueEmail,
  waitForServer,
} from './helpers'

const registered = { email: uniqueEmail('auth'), password: 'Str0ng!Passphrase', fullName: 'QA Auth User' }

beforeAll(async () => {
  await waitForServer()
}, 60_000)

describe('GET /api/health', () => {
  it('answers without authentication', async () => {
    const res = await new TestClient().get<{ status: string }>('/health')
    expect(res.status).toBe(200)
    expect(res.data.status).toBe('ok')
  })
})

describe('POST /api/auth/register', () => {
  it('creates an account (201), sets the session cookie and returns the user', async () => {
    const client = new TestClient()
    const res = await client.post<{ user: { email: string; role: string; fullName: string } }>(
      '/auth/register',
      { ...registered, role: 'EMPLOYEE' }
    )
    expect(res.status).toBe(201)
    expect(res.data.user.email).toBe(registered.email)
    expect(res.data.user.fullName).toBe('QA Auth User')
    expect(client.hasSessionCookie()).toBe(true)
  })

  it('rejects a duplicate email with 409', async () => {
    const res = await new TestClient().post('/auth/register', {
      ...registered,
      password: 'Another1!Pass',
      fullName: 'Duplicate',
    })
    expect(res.status).toBe(409)
  })

  it('rejects weak passwords with 400', async () => {
    for (const password of ['short', 'alllowercase1!', 'NOLOWERCASE1!', 'NoNumber!!!', 'NoSpecial11A']) {
      const res = await new TestClient().post('/auth/register', {
        email: uniqueEmail('weak'),
        password,
        fullName: 'Weak Password',
      })
      expect(res.status).toBe(400)
    }
  })

  it('rejects malformed emails with 400', async () => {
    const res = await new TestClient().post('/auth/register', {
      email: 'not-an-email',
      password: 'Str0ng!Passphrase',
      fullName: 'Bad Email',
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  it('logs a seeded manager in (200) and sets an httpOnly session cookie', async () => {
    const client = await loginAs(MANAGER)
    expect(client.hasSessionCookie()).toBe(true)
  })

  it('rejects a wrong password with 401', async () => {
    const res = await new TestClient().post('/auth/login', {
      email: EMPLOYEE.email,
      password: 'DefinitelyWrong!1',
    })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown account with 401 (no user enumeration)', async () => {
    const res = await new TestClient().post('/auth/login', {
      email: 'ghost-who-never-was@qa.eventflow.io',
      password: 'Whatever!1x',
    })
    expect(res.status).toBe(401)
  })

  it('rejects an invalid payload with 400', async () => {
    const res = await new TestClient().post('/auth/login', { email: 'nope', password: '' })
    expect(res.status).toBe(400)
  })
})

describe('session lifecycle', () => {
  it('GET /api/auth/me returns the signed-in user, 401 without a session', async () => {
    const client = await loginAs(MANAGER)
    const me = await client.get<{ user: { email: string; role: string } }>('/auth/me')
    expect(me.status).toBe(200)
    expect(me.data.user.email).toBe(MANAGER.email)
    expect(me.data.user.role).toBe('EVENT_MANAGER')

    const anonymous = await new TestClient().get('/auth/me')
    expect(anonymous.status).toBe(401)
  })

  it('the freshly registered user can sign in again and me() resolves', async () => {
    const client = await loginAs({ email: registered.email, password: registered.password })
    const me = await client.get<{ user: { email: string } }>('/auth/me')
    expect(me.status).toBe(200)
    expect(me.data.user.email).toBe(registered.email)
  })

  it('POST /api/auth/logout clears the session (me → 401)', async () => {
    const client = await loginAs(EMPLOYEE)
    const out = await client.post('/auth/logout')
    expect(out.status).toBe(200)
    const me = await client.get('/auth/me')
    expect(me.status).toBe(401)
  })

  it('tampered session cookies are rejected with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: 'ems_session=forged-token-value', Accept: 'application/json' },
    })
    expect(res.status).toBe(401)
  })
})
