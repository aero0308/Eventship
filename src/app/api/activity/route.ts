import { db } from '@/lib/db'
import { handleApiError, ok, requireUser } from '@/lib/api-utils'

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 50

export async function GET(request: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(request.url)

    const parsed = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const limit = Number.isNaN(parsed)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(parsed, 1), MAX_LIMIT)

    const logs = await db.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { user: { select: { id: true, fullName: true } } },
    })

    return ok({
      activities: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        user: log.user ?? null,
        action: log.action,
        details: log.details,
        timestamp: log.timestamp.toISOString(),
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
