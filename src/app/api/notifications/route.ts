import { db } from '@/lib/db'
import { ApiError, handleApiError, ok, parseBody, requireUser } from '@/lib/api-utils'
import { scanDeadlineApproaching } from '@/lib/deadlines'
import { notificationPatchSchema } from '@/lib/schemas'

export async function GET() {
  try {
    const user = await requireUser()
    // Best-effort enrichment: remind about tasks due within 48h (deduped per day).
    await scanDeadlineApproaching(user.id)
    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      db.notification.count({ where: { userId: user.id, read: false } }),
    ])
    return ok({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        message: notification.message,
        type: notification.type,
        read: notification.read,
        createdAt: notification.createdAt.toISOString(),
      })),
      unreadCount,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const body = await parseBody(request, notificationPatchSchema)

    if (body.id) {
      const result = await db.notification.updateMany({
        where: { id: body.id, userId: user.id },
        data: { read: true },
      })
      if (result.count === 0) throw new ApiError(404, 'Notification not found')
    } else if (body.markAll) {
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      })
    }

    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
