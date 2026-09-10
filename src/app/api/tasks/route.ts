import { db } from '@/lib/db'
import { canManageEvents, assertAccess } from '@/lib/permissions'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  ACTIVITY_ACTIONS,
} from '@/lib/constants'
import {
  ApiError,
  handleApiError,
  logActivity,
  notifyUser,
  ok,
  parseBody,
  requireUser,
} from '@/lib/api-utils'
import { createTaskSchema } from '@/lib/schemas'
import { serializeTask, taskInclude } from '../_lib/tasks'
import { emitBoardChange } from '@/lib/realtime'
import type { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)

    const where: Prisma.TaskWhereInput = {}

    const eventId = searchParams.get('eventId')
    if (eventId) where.eventId = eventId

    const status = searchParams.get('status')
    if (status && (TASK_STATUSES as readonly string[]).includes(status)) where.status = status

    const priority = searchParams.get('priority')
    if (priority && (TASK_PRIORITIES as readonly string[]).includes(priority)) {
      where.priority = priority
    }

    const assignedTo = searchParams.get('assignedTo')
    if (assignedTo === 'me') where.assignedTo = user.id
    else if (assignedTo === 'unassigned') where.assignedTo = null
    else if (assignedTo) where.assignedTo = assignedTo

    const search = searchParams.get('search')
    // SQLite `contains` matching is case-insensitive for ASCII text.
    if (search) where.title = { contains: search }

    if (searchParams.get('overdue') === 'true') {
      where.dueDate = { lt: new Date() }
      where.status = { not: 'COMPLETED' }
    }

    const tasks = await db.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: taskInclude,
    })
    return ok({ tasks: tasks.map(serializeTask) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await parseBody(request, createTaskSchema)

    const event = await db.event.findUnique({ where: { id: body.eventId } })
    if (!event) throw new ApiError(404, 'Event not found')
    assertAccess(
      canManageEvents(user, event.teamId),
      'Only event managers or the owning team leader can create tasks for this event'
    )

    if (body.assignedTo) {
      const assignee = await db.user.findUnique({ where: { id: body.assignedTo } })
      if (!assignee) throw new ApiError(404, 'Assignee not found')
    }

    const created = await db.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        priority: body.priority,
        status: body.status,
        eventId: body.eventId,
        assignedTo: body.assignedTo ?? null,
        createdBy: user.id,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        estimatedHours: body.estimatedHours ?? null,
      },
    })

    if (body.assignedTo) {
      await notifyUser(
        body.assignedTo,
        'TASK_ASSIGNED',
        `You were assigned "${body.title}" (${body.priority} priority)`
      )
      await logActivity(user.id, ACTIVITY_ACTIONS.TASK_ASSIGNED, {
        taskId: created.id,
        title: body.title,
        assignedTo: body.assignedTo,
      })
    }
    await logActivity(user.id, ACTIVITY_ACTIONS.TASK_CREATED, {
      taskId: created.id,
      title: body.title,
    })

    const task = await db.task.findUniqueOrThrow({
      where: { id: created.id },
      include: taskInclude,
    })
    // The full DTO rides the realtime broadcast so other clients can add the
    // task optimistically without refetching.
    emitBoardChange(body.eventId, 'task:created', user.id, { taskId: created.id, task: serializeTask(task) })

    return ok({ task: serializeTask(task) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
