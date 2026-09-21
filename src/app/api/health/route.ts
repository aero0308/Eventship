import { PrismaClient } from '@prisma/client'
import { ok } from '@/lib/api-utils'

type CheckState = 'ok' | 'warn' | 'fail'

interface HealthReport {
  status: 'ok' | 'degraded'
  service: string
  time: string
  checks: {
    databaseUrl: { state: CheckState; driver: string; location: string; hint?: string }
    prismaClient: { state: CheckState; hint?: string }
    database: { state: CheckState; latencyMs?: number; hint?: string }
    schema: { state: CheckState; hint?: string }
  }
  hint?: string
}

/**
 * Deployment self-diagnostic. Visit /api/health on ANY environment (sandbox,
 * VPS, Vercel…) and the response tells you exactly which setup step is missing:
 * DATABASE_URL unset → prisma client not generated → db unreachable → schema
 * not pushed. Never throws, never returns 500 — a broken deployment still gets
 * a structured report.
 */
export async function GET() {
  const report: HealthReport = {
    status: 'ok',
    service: 'event-management-api',
    time: new Date().toISOString(),
    checks: {
      databaseUrl: { state: 'fail', driver: 'unknown', location: 'unknown' },
      prismaClient: { state: 'ok' },
      database: { state: 'fail' },
      schema: { state: 'fail' },
    },
  }

  // ── 1. DATABASE_URL configured? ─────────────────────────────────
  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) {
    report.checks.databaseUrl = {
      state: 'fail',
      driver: 'unknown',
      location: 'unknown',
      hint: 'DATABASE_URL is not set. Add it in your host dashboard (Vercel: Project → Settings → Environment Variables). For local dev copy .env.example to .env.',
    }
    report.hint = 'Set DATABASE_URL, then redeploy / restart the server.'
    report.status = 'degraded'
    return Response.json(report, { status: 200 })
  }
  const isPostgres = rawUrl.startsWith('postgres')
  const driver = isPostgres ? 'postgresql' : 'sqlite'
  let location = 'local file'
  try {
    if (isPostgres) {
      const parsed = new URL(rawUrl)
      location = parsed.host // never expose user/password
    } else {
      // sqlite URLs: file:./db/custom.db (relative) or file:/abs/path
      location = rawUrl.replace(/^file:/, '') || './prisma/dev.db'
    }
  } catch {
    location = '(unparseable URL)'
  }
  report.checks.databaseUrl = {
    state: 'ok',
    driver,
    location,
    hint: isPostgres
      ? undefined
      : 'SQLite selected — fine for local/self-hosted with persistent disk, but NOT for serverless (Vercel/Netlify). See README → Deploying.',
  }

  // ── 2. Prisma client generated? + 3. DB reachable? + 4. schema? ─
  let prisma: PrismaClient
  try {
    prisma = new PrismaClient({ log: [] })
  } catch (e) {
    report.checks.prismaClient = {
      state: 'fail',
      hint: 'Prisma client failed to construct. Run `npx prisma generate` and redeploy.',
    }
    report.hint = 'Run `npx prisma generate` and redeploy.'
    report.status = 'degraded'
    return Response.json({ ...report, error: String(e) }, { status: 200 })
  }

  const t0 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    report.checks.database = { state: 'ok', latencyMs: Date.now() - t0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    report.checks.database.state = 'fail'
    if (msg.includes('Environment variable not found')) {
      report.checks.database.hint =
        'The runtime process cannot see DATABASE_URL even though the build environment may have it. Re-check the variable is set for the RUNNING environment and restart.'
    } else if (msg.includes('unable to open database file') || msg.includes('Error code 14')) {
      report.checks.database.hint =
        'SQLite file cannot be opened/created here — the filesystem is read-only or the relative path does not resolve. On Vercel/Netlify use PostgreSQL instead (README → Deploying); on a VPS make the db/ directory writable.'
    } else if (msg.includes("Can't reach database server") || msg.includes('P1001')) {
      report.checks.database.hint =
        'The database server is unreachable from this deployment: check the host/port in DATABASE_URL, IP allow-lists, and whether you used the POOLED connection string where required (Vercel + Neon).'
    } else {
      report.checks.database.hint = 'Unexpected database error — see server logs for details.'
    }
    report.hint = report.checks.database.hint
    report.status = 'degraded'
    return Response.json(report, { status: 200 })
  }

  try {
    await prisma.user.count()
    report.checks.schema = { state: 'ok' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    report.checks.schema.state = 'fail'
    report.checks.schema.hint = msg.includes('does not exist in the current database')
      ? 'Tables are missing: run `npx prisma db push` against this database (and optionally seed with `bun prisma/seed.ts` or `npx tsx prisma/seed.ts`).'
      : 'Schema check failed — see server logs.'
    report.hint = report.checks.schema.hint
    report.status = 'degraded'
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }

  return ok(report)
}
