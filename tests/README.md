# Test Suite (Phase: Testing & Polish)

Zero-dependency test suite built on **`bun:test`** — the FastAPI/pytest spec
from the phase plan maps onto the real stack (Next.js API routes) as HTTP
integration tests, plus unit tests for pure client-safe utilities.

## Run

```bash
bun run test          # single run (dev server must be up on :3000)
bun run test:watch    # watch mode
TEST_BASE_URL=http://other-host:3000 bun run test   # custom target
```

The suite targets the **real HTTP surface** (`/api/...`) of the running dev
server, so start it first (`bun run dev`). `waitForServer()` in
`tests/helpers.ts` waits up to 30s for cold-compile.

## Files

| File                  | Scope                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| `helpers.ts`          | Cookie-jar HTTP client, per-test fake IPs, login helper, server probe  |
| `auth.test.ts`        | Register/login/me/logout, 401 contract, weak-password + duplicate guards |
| `rbac.test.ts`        | Role gates: teams/users admin manager-only, employee read-only         |
| `crud.test.ts`        | team → event → task → patch → comment lifecycle + 404 contract (self-cleaning) |
| `validation.test.ts`  | zod contract: 400s with human messages, malformed JSON → never 500     |
| `security.test.ts`    | Security headers on API + pages; per-IP rate limits (429 + Retry-After) |
| `unit.test.ts`        | Pure utils: password policy, qs(), describeError(), rate-limiter clock |

## Design notes

- **Rate-limit isolation**: every `TestClient` sends a unique
  `x-forwarded-for`; the server's limiter buckets per IP, so deliberate 429
  tests (dedicated IPs `10.99.31.x`) never starve the functional suites.
- **Database hygiene**: the CRUD suite deletes everything it creates
  (`afterAll` trash list). Auth tests create a handful of `qa-*` users
  (no user-delete API exists) — acceptable demo-data noise.
- **No new dependencies**: `bun:test` ships with Bun; no vitest/RTL needed.
  Frontend behavior is additionally verified end-to-end via agent-browser QA.
