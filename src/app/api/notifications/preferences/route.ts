import { db } from '@/lib/db'
import { handleApiError, ok, parseBody, requireUser } from '@/lib/api-utils'
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_TYPES } from '@/lib/constants'
import { notificationPrefsSchema } from '@/lib/schemas'

function mergeDefaults(stored: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => [type, stored[type] !== false])
  )
}

/** GET — the caller's effective notification preferences (all types, defaulted on). */
export async function GET() {
  try {
    const user = await requireUser()
    let stored: Record<string, boolean> = {}
    if (user.notificationPrefs) {
      try {
        const parsed = JSON.parse(user.notificationPrefs)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          stored = parsed as Record<string, boolean>
        }
      } catch {
        stored = {}
      }
    }
    return ok({ prefs: mergeDefaults(stored), defaults: DEFAULT_NOTIFICATION_PREFS })
  } catch (error) {
    return handleApiError(error)
  }
}

/** PATCH — persist the full mute map for the caller. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const body = await parseBody(request, notificationPrefsSchema)
    await db.user.update({
      where: { id: user.id },
      data: { notificationPrefs: JSON.stringify(body.prefs) },
    })
    return ok({ prefs: mergeDefaults(body.prefs) })
  } catch (error) {
    return handleApiError(error)
  }
}
