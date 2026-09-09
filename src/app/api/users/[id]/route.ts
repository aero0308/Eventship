import { db } from '@/lib/db'
import { assertAccess, isEventManager } from '@/lib/permissions'
import { ApiError, handleApiError, logActivity, notifyUser, ok, parseBody, requireUser } from '@/lib/api-utils'
import { updateUserSchema } from '@/lib/schemas'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { toPublicUser } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireUser()
    assertAccess(isEventManager(admin), 'Only event managers can manage user accounts')

    const { id } = await context.params
    const body = await parseBody(request, updateUserSchema)

    const target = await db.user.findUnique({ where: { id }, include: { team: { select: { id: true, name: true } } } })
    if (!target) throw new ApiError(404, 'User not found')

    // ---- guardrails -------------------------------------------------------
    if (target.id === admin.id) {
      if (body.role !== undefined && body.role !== target.role) {
        throw new ApiError(400, 'You cannot change your own role')
      }
      if (body.isActive === false) {
        throw new ApiError(400, 'You cannot deactivate your own account')
      }
    }

    if (body.role !== undefined && body.role !== target.role && target.role === 'EVENT_MANAGER') {
      // Demoting a manager: make sure at least one ACTIVE manager remains.
      const activeManagers = await db.user.count({ where: { role: 'EVENT_MANAGER', isActive: true } })
      if (activeManagers <= 1) {
        throw new ApiError(400, 'At least one active event manager is required — promote someone else first')
      }
    }

    if (body.teamId) {
      const team = await db.team.findUnique({ where: { id: body.teamId } })
      if (!team) throw new ApiError(404, 'Team not found')
    }

    // ---- apply ------------------------------------------------------------
    const deactivating = body.isActive === false && target.isActive
    const reactivating = body.isActive === true && !target.isActive

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.teamId !== undefined ? { teamId: body.teamId } : {}),
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      },
      include: { team: { select: { id: true, name: true } } },
    })

    // Deactivating kills every live session — the next API call 401s and the
    // client auto-signs-out (existing ems:unauthorized recovery path).
    if (deactivating) {
      await db.session.deleteMany({ where: { userId: id } })
    }

    // ---- activity + notifications -----------------------------------------
    const detailBase = { userId: target.id, email: target.email, fullName: updated.fullName }

    if (body.role !== undefined && body.role !== target.role) {
      await logActivity(admin.id, ACTIVITY_ACTIONS.USER_ROLE_CHANGED, {
        ...detailBase,
        from: target.role,
        to: updated.role,
      })
      await notifyUser(id, 'TASK_ASSIGNED', `Your role was changed to ${updated.role.replace(/_/g, ' ').toLowerCase()} by an administrator`)
    }
    if (deactivating) {
      await logActivity(admin.id, ACTIVITY_ACTIONS.USER_DEACTIVATED, detailBase)
    }
    if (reactivating) {
      await logActivity(admin.id, ACTIVITY_ACTIONS.USER_REACTIVATED, detailBase)
    }
    if (body.teamId !== undefined && body.teamId !== target.teamId) {
      await logActivity(admin.id, ACTIVITY_ACTIONS.USER_UPDATED, {
        ...detailBase,
        from: target.team?.name ?? null,
        to: updated.team?.name ?? null,
      })
    }

    return ok({ user: toPublicUser(updated) })
  } catch (error) {
    return handleApiError(error)
  }
}
