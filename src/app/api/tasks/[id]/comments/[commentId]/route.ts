import { db } from '@/lib/db'
import { ApiError, handleApiError, ok, requireUser } from '@/lib/api-utils'
import { emitBoardChange } from '@/lib/realtime'

/**
 * DELETE /api/tasks/[id]/comments/[commentId] — remove a comment.
 * Phase 5 delete_comment: owner-only (the author must be the requester).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const user = await requireUser()
    const { id: taskId, commentId } = await params

    const comment = await db.taskComment.findUnique({
      where: { id: commentId },
      select: { id: true, taskId: true, userId: true, task: { select: { id: true, eventId: true } } },
    })
    if (!comment || comment.taskId !== taskId) throw new ApiError(404, 'Comment not found')
    if (comment.userId !== user.id) {
      throw new ApiError(403, 'You can only delete your own comments')
    }

    await db.taskComment.delete({ where: { id: commentId } })
    emitBoardChange(comment.task.eventId, 'comment:deleted', user.id, { taskId, commentId })
    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
