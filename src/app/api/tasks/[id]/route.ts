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
import { emitBoardChange, emitTaskBoardChange } from '@/lib/realtime'
import {
  serializeTaskDetail,
  taskDetailInclude,
  wouldCreateCycle,
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
      include: {
        event: { select: { teamId: true } },
        dependencies: { include: { dependsOnTask: { select: { id: true, title: true, status: true } } } },
      },
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
        (key) => key !== 'status' && key !== 'actualHours' && key !== 'statusNote'
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
      const found = await db.task.findMany({ where: { id: { in: depIds } }, select: { id: true, title: true } })
      if (found.length !== depIds.length) {
        throw new ApiError(404, 'One or more dependency tasks not found')
      }
      const titleById = new Map(found.map((t) => [t.id, t.title]))
      // Phase 5 circular-dependency check: only NEW edges need the walk —
      // edges that already exist cannot close a loop (they were checked when
      // they were added, and a cycle can only be introduced by a new edge).
      const existingDeps = new Set(existing.dependencies.map((dep) => dep.dependsOnTaskId))
      for (const depId of depIds) {
        if (existingDeps.has(depId)) continue
        if (await wouldCreateCycle(id, depId)) {
          throw new ApiError(
            400,
            `Circular dependency detected — “${titleById.get(depId) ?? 'that task'}” already depends on this task directly or indirectly`
          )
        }
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

    // Strict dependency guard (per-user workflow preference): refuse to mark a
    // task COMPLETED while any of its dependencies is unfinished.
    if (
      body.status === 'COMPLETED' &&
      existing.status !== 'COMPLETED' &&
      user.strictDependencyGuard
    ) {
      const unfinished = existing.dependencies.filter((dep) => dep.dependsOnTask.status !== 'COMPLETED')
      if (unfinished.length > 0) {
        const names = unfinished
          .slice(0, 2)
          .map((dep) => `“${dep.dependsOnTask.title}”`)
          .join(', ')
        throw new ApiError(
          409,
          `Dependency guard is on — finish ${unfinished.length === 1 ? 'this task' : `${unfinished.length} tasks`} first: ${names}${unfinished.length > 2 ? ` +${unfinished.length - 2} more` : ''}`
        )
      }
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

    // Phase 5 statusNote: an optional note attached to a status change becomes
    // a regular comment authored by the mover (the blocker-reporting flow —
    // "why is this blocked?" — lands here as a first-class comment).
    let statusNoteComment: {
      id: string
      content: string
      taskId: string
      userId: string
      user: { id: string; fullName: string; role: string } | null
      createdAt: string
    } | null = null
    if (body.statusNote) {
      const note = await db.taskComment.create({
        data: { content: body.statusNote, taskId: id, userId: user.id },
        include: { user: { select: { id: true, fullName: true, role: true } } },
      })
      statusNoteComment = {
        id: note.id,
        content: note.content,
        taskId: note.taskId,
        userId: note.userId,
        user: note.user ?? null,
        createdAt: note.createdAt.toISOString(),
      }
    }

    // Serialize once; the full DTO also rides the realtime broadcast so other
    // clients can patch their boards optimistically without refetching.
    // statusChange rides along (Phase 7) so toast layers can announce status
    // moves without spamming every field-level edit.
    const task = await fetchTaskDetail(id)
    if (!task) throw new ApiError(404, 'Task not found')
    const serialized = serializeTaskDetail(task)
    emitTaskBoardChange(
      existing.eventId,
      existing.event.teamId,
      'task:updated',
      user.id,
      statusChanged
        ? { taskId: id, task: serialized, statusChange: { from: existing.status, to: body.status! } }
        : { taskId: id, task: serialized }
    )
    if (statusNoteComment) {
      // After the task patch so open dialogs append the note to a fresh detail.
      emitBoardChange(existing.eventId, 'comment:added', user.id, {
        taskId: id,
        taskTitle: title,
        comment: statusNoteComment,
      })
    }

    return ok({ task: serialized })
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
      select: { id: true, title: true, eventId: true, createdBy: true, assignedTo: true, event: { select: { teamId: true } } },
    })
    if (!existing) throw new ApiError(404, 'Task not found')
    assertAccess(
      canFullyManageTask(user, existing, existing.event.teamId),
      'Only event managers, the owning team leader, or the task creator can delete this task'
    )

    // Comments and dependencies cascade-delete via schema relations.
    await db.task.delete({ where: { id } })
    emitTaskBoardChange(existing.eventId, existing.event.teamId, 'task:deleted', user.id, {
      taskId: id,
      taskTitle: existing.title,
    })
    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
