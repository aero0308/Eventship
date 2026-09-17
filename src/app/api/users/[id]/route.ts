import { db } from '@/lib/db'
import { assertAccess, isEventManager } from '@/lib/permissions'
import { ApiError, handleApiError, logActivity, notifyUser, ok, parseBody } from '@/lib/api-utils'
import { updateUserSchema } from '@/lib/schemas'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { toPublicUser } from '@/lib/auth'
import { requireRoomUser } from '@/lib/room'

type RouteContext = { params: Promise<{ id: string }> }

/** True when this PATCH transitions the target from active → deactivated. */
function deactivatingTarget(next: boolean | undefined, current: boolean): boolean {
  return next === false && current
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user: admin, roomId } = await requireRoomUser()
    assertAccess(isEventManager(admin), 'Only event managers can manage user accounts')

    const { id } = await context.params
    const body = await parseBody(request, updateUserSchema)

    // Tenant isolation: admins manage only users inside their own room.
    const target = await db.user.findFirst({
      where: { id, roomId },
      include: { team: { select: { id: true, name: true } } },
    })
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
      // Demoting a manager: make sure at least one ACTIVE manager remains in the room.
      const activeManagers = await db.user.count({ where: { role: 'EVENT_MANAGER', isActive: true, roomId } })
      if (activeManagers <= 1) {
        throw new ApiError(400, 'At least one active event manager is required — promote someone else first')
      }
    }

    // The room owner cannot be deactivated — they hold the room credentials
    // and the only delete/regenerate powers. Transfer ownership first.
    const owningRoom = await db.room.findFirst({ where: { id: roomId } })
    if (deactivatingTarget(body.isActive, target.isActive) && owningRoom?.ownerId === target.id) {
      throw new ApiError(400, "The room owner's account cannot be deactivated")
    }

    // Deactivating the last active manager would orphan the workspace —
    // same guard as demotion, mirrored for the isActive flag.
    if (deactivatingTarget(body.isActive, target.isActive) && target.role === 'EVENT_MANAGER') {
      const remainingManagers = await db.user.count({
        where: { role: 'EVENT_MANAGER', isActive: true, roomId, id: { not: target.id } },
      })
      if (remainingManagers === 0) {
        throw new ApiError(400, 'At least one active event manager is required — promote someone else first')
      }
    }

    if (body.teamId) {
      const team = await db.team.findFirst({ where: { id: body.teamId, roomId } })
      if (!team) throw new ApiError(404, 'Team not found in your event room')
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
        // Deactivation removes the account from the workspace: the user keeps
        // their credentials but loses room access entirely. On their next
        // sign-in they land on onboarding and must create a room or join one
        // with a Room ID + password (which re-activates the account).
        ...(deactivating ? { roomId: null, teamId: null } : {}),
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
      }, roomId)
      await notifyUser(id, 'TASK_ASSIGNED', `Your role was changed to ${updated.role.replace(/_/g, ' ').toLowerCase()} by an administrator`)
    }
    if (deactivating) {
      await logActivity(admin.id, ACTIVITY_ACTIONS.USER_DEACTIVATED, detailBase, roomId)
    }
    if (reactivating) {
      await logActivity(admin.id, ACTIVITY_ACTIONS.USER_REACTIVATED, detailBase, roomId)
    }
    if (body.teamId !== undefined && body.teamId !== target.teamId) {
      await logActivity(admin.id, ACTIVITY_ACTIONS.USER_UPDATED, {
        ...detailBase,
        from: target.team?.name ?? null,
        to: updated.team?.name ?? null,
      }, roomId)
    }

    return ok({ user: toPublicUser(updated) })
  } catch (error) {
    return handleApiError(error)
  }
}
