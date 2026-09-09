import { db } from '@/lib/db'
import { TASK_STATUS_LABELS, ACTIVITY_ACTIONS } from '@/lib/constants'
import {
  ApiError,
  handleApiError,
  logActivity,
  notifyUser,
  ok,
  parseBody,
  requireUser,
} from '@/lib/api-utils'
import { bulkTaskActionSchema } from '@/lib/schemas'
import { canFullyManageTask, assertAccess } from '@/lib/permissions'
import { emitBoardChange } from '@/lib/realtime'

/**
 * POST /api/tasks/bulk — apply one action to many tasks.
 * Actions: status | priority | assign | unassign | delete
 * Permissions mirror the single-task routes:
 * - status: managers / owning team leader / creator, OR the task's assignee (status only)
 * - priority / assign / unassign / delete: managers / owning team leader / creator only
 * Per-task failures are collected so one bad task never blocks the rest.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await parseBody(request, bulkTaskActionSchema)

    if (body.action === 'status' && !body.status) throw new ApiError(400, 'A target status is required')
    if (body.action === 'priority' && !body.priority) throw new ApiError(400, 'A target priority is required')
    if (body.action === 'assign' && !body.assignedTo) throw new ApiError(400, 'Choose who to assign these tasks to')

    if (body.assignedTo) {
      const assignee = await db.user.findUnique({ where: { id: body.assignedTo } })
      if (!assignee) throw new ApiError(404, 'Assignee not found')
    }

    const ids = [...new Set(body.ids)]
    const tasks = await db.task.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        assignedTo: true,
        createdBy: true,
        eventId: true,
        event: { select: { teamId: true } },
      },
    })
    const taskById = new Map(tasks.map((t) => [t.id, t]))
    const touchedEvents = new Set<string>()

    // Strict dependency guard (per-user preference): pre-compute unfinished
    // dependency counts for the selected tasks so COMPLETED can be refused.
    const unfinishedDeps = new Map<string, number>()
    if (body.action === 'status' && body.status === 'COMPLETED' && user.strictDependencyGuard) {
      const depRows = await db.taskDependency.findMany({
        where: { taskId: { in: ids } },
        select: { taskId: true, dependsOnTask: { select: { status: true } } },
      })
      for (const row of depRows) {
        if (row.dependsOnTask.status === 'COMPLETED') continue
        unfinishedDeps.set(row.taskId, (unfinishedDeps.get(row.taskId) ?? 0) + 1)
      }
    }

    let updated = 0
    let deleted = 0
    const failed: { id: string; title: string; reason: string }[] = []

    for (const id of ids) {
      const task = taskById.get(id)
      if (!task) {
        failed.push({ id, title: id.slice(0, 8), reason: 'Task not found (may have been deleted)' })
        continue
      }

      const fullManager = canFullyManageTask(user, task, task.event.teamId)

      try {
        if (body.action === 'delete') {
          assertAccess(fullManager, 'Only managers, the owning team leader, or the creator can delete a task')
          await db.task.delete({ where: { id } })
          touchedEvents.add(task.eventId)
          deleted += 1
          continue
        }

        if (body.action === 'status') {
          const isAssignee = task.assignedTo === user.id
          if (!fullManager && !isAssignee) {
            failed.push({ id, title: task.title, reason: 'You can only change status of your own tasks' })
            continue
          }
          const blockedBy = unfinishedDeps.get(id) ?? 0
          if (body.status === 'COMPLETED' && task.status !== 'COMPLETED' && blockedBy > 0) {
            failed.push({
              id,
              title: task.title,
              reason: `Dependency guard is on — ${blockedBy} unfinished ${blockedBy === 1 ? 'dependency' : 'dependencies'}`,
            })
            continue
          }
          if (task.status !== body.status) {
            await db.task.update({ where: { id }, data: { status: body.status! } })
            const notifyType =
              body.status === 'COMPLETED' ? 'TASK_COMPLETED' : body.status === 'BLOCKED' ? 'TASK_BLOCKED' : 'TASK_STATUS_CHANGED'
            const message = `"${task.title}" moved to ${TASK_STATUS_LABELS[body.status!] ?? body.status}`
            const recipients = new Set<string>([task.createdBy])
            if (task.assignedTo) recipients.add(task.assignedTo)
            recipients.delete(user.id)
            await Promise.all([...recipients].map((recipientId) => notifyUser(recipientId, notifyType, message)))
            await logActivity(user.id, notifyType, { taskId: id, title: task.title, from: task.status, to: body.status })
            touchedEvents.add(task.eventId)
            updated += 1
          }
          continue
        }

        // priority / assign / unassign — full manage required.
        assertAccess(fullManager, 'Only managers, the owning team leader, or the creator can edit this task')

        if (body.action === 'priority' && task.priority !== body.priority) {
          await db.task.update({ where: { id }, data: { priority: body.priority! } })
          touchedEvents.add(task.eventId)
          updated += 1
        } else if (body.action === 'assign' && task.assignedTo !== body.assignedTo) {
          await db.task.update({ where: { id }, data: { assignedTo: body.assignedTo! } })
          if (body.assignedTo) {
            await notifyUser(body.assignedTo, 'TASK_ASSIGNED', `You were assigned "${task.title}"`)
          }
          await logActivity(user.id, ACTIVITY_ACTIONS.TASK_ASSIGNED, {
            taskId: id,
            title: task.title,
            assignedTo: body.assignedTo,
          })
          touchedEvents.add(task.eventId)
          updated += 1
        } else if (body.action === 'unassign' && task.assignedTo !== null) {
          await db.task.update({ where: { id }, data: { assignedTo: null } })
          touchedEvents.add(task.eventId)
          updated += 1
        }
      } catch (error) {
        const reason =
          error instanceof ApiError ? error.message : 'Update failed for this task'
        failed.push({ id, title: task.title, reason })
      }
    }

    // One board-change ping per touched event (clients refetch on receipt).
    for (const eventId of touchedEvents) {
      emitBoardChange(eventId, `task:${body.action}`, user.id, { bulk: true, updated, deleted })
    }

    return ok({ updated, deleted, failed, total: ids.length })
  } catch (error) {
    return handleApiError(error)
  }
}
