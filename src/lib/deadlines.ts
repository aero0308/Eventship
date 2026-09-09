import 'server-only'
import { db } from '@/lib/db'

const WINDOW_MS = 48 * 60 * 60 * 1000 // tasks due within 48h
const DEDUPE_MS = 24 * 60 * 60 * 1000 // at most one reminder per task per day
const MAX_PER_SCAN = 5

/**
 * Create DEADLINE_APPROACHING notifications for the given user's active tasks
 * that are due within the next 48 hours. De-duplicated: one notification per
 * task per 24h window (matched by task title inside the message).
 * Never throws — best-effort enrichment called from GET /api/notifications.
 */
export async function scanDeadlineApproaching(userId: string): Promise<void> {
  try {
    const now = new Date()
    const tasks = await db.task.findMany({
      where: {
        assignedTo: userId,
        status: { not: 'COMPLETED' },
        dueDate: { not: null, gte: now, lte: new Date(now.getTime() + WINDOW_MS) },
      },
      orderBy: { dueDate: 'asc' },
      take: MAX_PER_SCAN,
      select: { id: true, title: true, dueDate: true },
    })
    if (tasks.length === 0) return

    const since = new Date(now.getTime() - DEDUPE_MS)
    const recent = await db.notification.findMany({
      where: { userId, type: 'DEADLINE_APPROACHING', createdAt: { gte: since } },
      select: { message: true },
    })
    const recentMessages = new Set(recent.map((n) => n.message))

    for (const task of tasks) {
      const due = task.dueDate
      if (!due) continue
      const hoursLeft = Math.max(0, Math.round((due.getTime() - now.getTime()) / (60 * 60 * 1000)))
      const when = hoursLeft <= 1 ? 'due within the hour' : `due in ${hoursLeft}h`
      const message = `"${task.title}" is ${when} — due ${due.toISOString().slice(0, 10)}`
      if (recentMessages.has(message)) continue
      const duplicate = [...recentMessages].some((m) => m.includes(`"${task.title}" is`))
      if (duplicate) continue
      await db.notification.create({
        data: { userId, type: 'DEADLINE_APPROACHING', message },
      })
    }
  } catch (error) {
    console.error('[deadline-scan]', error)
  }
}
