import { db } from '@/lib/db'
import { handleApiError, ok, requireUser } from '@/lib/api-utils'
import type { Prisma } from '@prisma/client'

/**
 * GET /api/tasks/stats — role-scoped task statistics (Phase 5 get_task_stats).
 *
 * Scope rules (mirror the spec's authorization matrix):
 * - EMPLOYEE: tasks assigned to them.
 * - TEAM_LEADER: tasks inside events owned by their team.
 * - EVENT_MANAGER: every task.
 *
 * One groupBy over status + one overdue count keeps this to two queries.
 */
export async function GET() {
  try {
    const user = await requireUser()

    let where: Prisma.TaskWhereInput = {}
    if (user.role === 'EMPLOYEE') {
      where = { assignedTo: user.id }
    } else if (user.role === 'TEAM_LEADER') {
      // A team leader without a team simply sees an empty scope.
      where = user.teamId ? { event: { teamId: user.teamId } } : { id: '__none__' }
    }

    const now = new Date()
    const [grouped, overdue] = await Promise.all([
      db.task.groupBy({ by: ['status'], where, _count: { _all: true } }),
      db.task.count({
        where: { ...where, status: { not: 'COMPLETED' }, dueDate: { lt: now } },
      }),
    ])

    const countBy = new Map(grouped.map((row) => [row.status, row._count._all]))
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0)
    const completed = countBy.get('COMPLETED') ?? 0

    return ok({
      stats: {
        total,
        notStarted: countBy.get('NOT_STARTED') ?? 0,
        inProgress: countBy.get('IN_PROGRESS') ?? 0,
        blocked: countBy.get('BLOCKED') ?? 0,
        completed,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
