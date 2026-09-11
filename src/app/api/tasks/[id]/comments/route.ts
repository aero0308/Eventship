import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, notifyUser, ok, parseBody, requireUser } from '@/lib/api-utils'
import { createCommentSchema } from '@/lib/schemas'
import { emitTaskBoardChange } from '@/lib/realtime'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id: taskId } = await params
    const body = await parseBody(request, createCommentSchema)

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { event: { select: { teamId: true } } },
    })
    if (!task) throw new ApiError(404, 'Task not found')

    const comment = await db.taskComment.create({
      data: { content: body.content, taskId, userId: user.id },
      include: { user: { select: { id: true, fullName: true, role: true } } },
    })

    // Notify assignee and task creator, but never the commenting user.
    const recipients = new Set<string>()
    if (task.assignedTo) recipients.add(task.assignedTo)
    recipients.add(task.createdBy)
    recipients.delete(user.id)
    for (const recipientId of recipients) {
      await notifyUser(
        recipientId,
        'COMMENT_ADDED',
        `"${user.fullName}" commented on "${task.title}"`
      )
    }

    await logActivity(user.id, ACTIVITY_ACTIONS.COMMENT_ADDED, {
      taskId,
      taskTitle: task.title,
    })
    // The serialized comment rides the broadcast so open task dialogs on other
    // clients can append it live (plus a typing indicator beforehand).
    emitTaskBoardChange(task.eventId, task.event.teamId, 'comment:added', user.id, {
      taskId,
      taskTitle: task.title,
      comment: {
        id: comment.id,
        content: comment.content,
        taskId: comment.taskId,
        userId: comment.userId,
        user: comment.user ?? null,
        createdAt: comment.createdAt.toISOString(),
      },
    })

    return ok(
      {
        comment: {
          id: comment.id,
          content: comment.content,
          taskId: comment.taskId,
          userId: comment.userId,
          user: comment.user ?? null,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
