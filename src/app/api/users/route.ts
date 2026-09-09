import { db } from '@/lib/db'
import { handleApiError, ok, requireUser } from '@/lib/api-utils'
import { toPublicUser } from '@/lib/auth'

export async function GET() {
  try {
    await requireUser()
    // Contract: return ALL users (frontend filters inactive ones where needed).
    const users = await db.user.findMany({
      orderBy: { fullName: 'asc' },
      include: { team: { select: { id: true, name: true } } },
    })

    // Workload aggregates (single grouped queries instead of per-user counts).
    const [taskGroups, logins] = await Promise.all([
      db.task.groupBy({
        by: ['assignedTo', 'status'],
        _count: { _all: true },
        where: { assignedTo: { not: null } },
      }),
      db.activityLog.groupBy({
        by: ['userId'],
        _max: { timestamp: true },
        where: { action: 'USER_LOGIN' },
      }),
    ])

    const lastLoginByUser = new Map<string, Date>()
    for (const row of logins) {
      if (row._max.timestamp) lastLoginByUser.set(row.userId, row._max.timestamp)
    }

    const statsByUser = new Map<string, { openTasks: number; overdueTasks: number; completedTasks: number }>()
    for (const row of taskGroups) {
      if (!row.assignedTo) continue
      const entry = statsByUser.get(row.assignedTo) ?? { openTasks: 0, overdueTasks: 0, completedTasks: 0 }
      if (row.status === 'COMPLETED') {
        entry.completedTasks += row._count._all
      } else {
        entry.openTasks += row._count._all
      }
      statsByUser.set(row.assignedTo, entry)
    }

    // Overdue needs dueDate; one more grouped query for open+overdue tasks.
    const overdueGroups = await db.task.groupBy({
      by: ['assignedTo'],
      _count: { _all: true },
      where: { assignedTo: { not: null }, status: { not: 'COMPLETED' }, dueDate: { lt: new Date() } },
    })
    for (const row of overdueGroups) {
      if (!row.assignedTo) continue
      const entry = statsByUser.get(row.assignedTo) ?? { openTasks: 0, overdueTasks: 0, completedTasks: 0 }
      entry.overdueTasks = row._count._all
      statsByUser.set(row.assignedTo, entry)
    }

    return ok({
      users: users.map((user) => ({
        ...toPublicUser(user),
        stats: statsByUser.get(user.id) ?? { openTasks: 0, overdueTasks: 0, completedTasks: 0 },
        lastLoginAt: lastLoginByUser.get(user.id)?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
