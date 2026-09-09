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
import { updateTaskSchema } from '@/lib/schemas'
import { canFullyManageTask, assertAccess } from '@/lib/permissions'
import { emitBoardChange } from '@/lib/realtime'
import {
  serializeTaskDetail,
  taskDetailInclude,
  type TaskWithComments,
} from '../../_lib/tasks'
import type { Prisma } from '@prisma/client'

async function fetchTaskDetail(id: string): Promise<TaskWithComments | null> {
  const task = await db.task.findUnique({ where: { id }, include: taskDetailInclude })
  return task
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const task = await fetchTaskDetail(id)
    if (!task) throw new ApiError(404, 'Task not found')
    return ok({ task: serializeTaskDetail(task) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const existing = await db.task.findUnique({
      where: { id },
      include: { event: { select: { teamId: true } } },
    })
    if (!existing) throw new ApiError(404, 'Task not found')

    const body = await parseBody(request, updateTaskSchema)

    // Permission model: managers / owning team leaders / creators edit everything;
    // the assignee may only update status + actualHours; everyone else 403.
    const fullManager = canFullyManageTask(user, existing, existing.event.teamId)
    const isAssignee = existing.assignedTo === user.id
    if (!fullManager && !isAssignee) {
      throw new ApiError(403, 'You do not have permission to edit this task')
    }
    if (!fullManager) {
      const restricted = Object.keys(body).filter(
        (key) => key !== 'status' && key !== 'actualHours'
      )
      if (restricted.length > 0) {
        throw new ApiError(403, 'Assignees can only update task status and actual hours')
      }
    }

    if (body.eventId && body.eventId !== existing.eventId) {
      const event = await db.event.findUnique({ where: { id: body.eventId } })
      if (!event) throw new ApiError(404, 'Event not found')
    }

    const assignedToChanged = body.assignedTo !== undefined && body.assignedTo !== existing.assignedTo
    if (assignedToChanged && body.assignedTo) {
      const assignee = await db.user.findUnique({ where: { id: body.assignedTo } })
      if (!assignee) throw new ApiError(404, 'Assignee not found')
    }

    if (body.dependsOnTaskIds) {
      const depIds = [...new Set(body.dependsOnTaskIds)]
      if (depIds.includes(id)) throw new ApiError(400, 'A task cannot depend on itself')
      const found = await db.task.findMany({ where: { id: { in: depIds } }, select: { id: true } })
      if (found.length !== depIds.length) {
        throw new ApiError(404, 'One or more dependency tasks not found')
      }
    }

    // Merged start/due validation (payload-only values can't see stored dates).
    const effectiveStart = body.startDate !== undefined ? body.startDate : existing.startDate
    const effectiveDue = body.dueDate !== undefined ? body.dueDate : existing.dueDate
    if (
      effectiveStart &&
      effectiveDue &&
      new Date(effectiveStart).getTime() > new Date(effectiveDue).getTime()
    ) {
      throw new ApiError(400, 'Start date must be on or before the due date')
    }

    // Resulting title used in notification messages.
    const title = body.title ?? existing.title

    const data: Prisma.TaskUpdateInput = {}
    if (body.title !== undefined) data.title = body.title
    if (body.description !== undefined) data.description = body.description
    if (body.priority !== undefined) data.priority = body.priority
    if (body.status !== undefined) data.status = body.status
    if (body.eventId !== undefined) data.event = { connect: { id: body.eventId } }
    if (body.assignedTo !== undefined) {
      data.assignee = body.assignedTo
        ? { connect: { id: body.assignedTo } }
        : { disconnect: true }
    }
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.estimatedHours !== undefined) data.estimatedHours = body.estimatedHours
    if (body.actualHours !== undefined) data.actualHours = body.actualHours
    if (body.dependsOnTaskIds) {
      data.dependencies = {
        deleteMany: {},
        create: [...new Set(body.dependsOnTaskIds)].map((depId) => ({ dependsOnTaskId: depId })),
      }
    }

    await db.task.update({ where: { id }, data })
    emitBoardChange(existing.eventId, 'task:updated', user.id, { taskId: id })

    if (assignedToChanged && body.assignedTo) {
      // Contract message: no priority suffix on reassignment.
      await notifyUser(body.assignedTo, 'TASK_ASSIGNED', `You were assigned "${title}"`)
      await logActivity(user.id, ACTIVITY_ACTIONS.TASK_ASSIGNED, {
        taskId: id,
        title,
        assignedTo: body.assignedTo,
      })
    }

    const statusChanged = body.status !== undefined && body.status !== existing.status
    if (statusChanged && body.status) {
      const notifyType =
        body.status === 'COMPLETED'
          ? 'TASK_COMPLETED'
          : body.status === 'BLOCKED'
            ? 'TASK_BLOCKED'
            : 'TASK_STATUS_CHANGED'
      const label = TASK_STATUS_LABELS[body.status] ?? body.status
      const message = `"${title}" moved to ${label}`

      const recipients = new Set<string>([existing.createdBy])
      const currentAssignee = body.assignedTo !== undefined ? body.assignedTo : existing.assignedTo
      if (currentAssignee) recipients.add(currentAssignee)
      recipients.delete(user.id)
      for (const recipientId of recipients) {
        await notifyUser(recipientId, notifyType, message)
      }

      await logActivity(user.id, notifyType, { taskId: id, title, from: existing.status, to: body.status })
    }

    const task = await fetchTaskDetail(id)
    if (!task) throw new ApiError(404, 'Task not found')
    return ok({ task: serializeTaskDetail(task) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const existing = await db.task.findUnique({
      where: { id },
      select: { id: true, eventId: true, createdBy: true, assignedTo: true, event: { select: { teamId: true } } },
    })
    if (!existing) throw new ApiError(404, 'Task not found')
    assertAccess(
      canFullyManageTask(user, existing, existing.event.teamId),
      'Only event managers, the owning team leader, or the task creator can delete this task'
    )

    // Comments and dependencies cascade-delete via schema relations.
    await db.task.delete({ where: { id } })
    emitBoardChange(existing.eventId, 'task:deleted', user.id, { taskId: id })
    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
