import { db } from '@/lib/db'
import { handleApiError, ok, requireUser } from '@/lib/api-utils'

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 50

/**
 * GET /api/activity?limit=&offset=&action=<A,B,…>&userId=<id|me>
 * Paginated activity feed with optional action-type and user filters.
 * `action` accepts a comma-separated list (e.g. EVENT_CREATED,TASK_CREATED).
 * `userId=me` resolves to the signed-in user.
 */
export async function GET(request: Request) {
  try {
    const current = await requireUser()
    const { searchParams } = new URL(request.url)

    const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)

    const parsedOffset = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset

    const actions = (searchParams.get('action') ?? '')
      .split(',')
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean)

    const rawUserId = (searchParams.get('userId') ?? '').trim()
    const userId = rawUserId === 'me' ? current.id : rawUserId || undefined

    const where = {
      ...(actions.length > 0 ? { action: { in: actions } } : {}),
      ...(userId ? { userId } : {}),
    }

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: { user: { select: { id: true, fullName: true } } },
      }),
      db.activityLog.count({ where }),
    ])

    return ok({
      activities: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        user: log.user ?? null,
        action: log.action,
        details: log.details,
        timestamp: log.timestamp.toISOString(),
      })),
      total,
      hasMore: offset + logs.length < total,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
