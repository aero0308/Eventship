import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody, requireUser } from '@/lib/api-utils'
import { emitTeamChange } from '@/lib/realtime'
import { updateTeamSchema } from '@/lib/schemas'
import { canManageTeams, assertAccess } from '@/lib/permissions'
import {
  computeTeamStats,
  serializeTeamDetail,
  teamDetailInclude,
  type TeamWithMembers,
} from '../../_lib/teams'

async function fetchTeamDetail(id: string): Promise<TeamWithMembers | null> {
  const team = await db.team.findUnique({ where: { id }, include: teamDetailInclude })
  return team
}

/** Serialized detail + aggregated task stats, in parallel. */
async function serializeDetailWithStats(team: TeamWithMembers) {
  const [stats, serialized] = await Promise.all([
    computeTeamStats(team.events.map((event) => event.id)),
    Promise.resolve(serializeTeamDetail(team)),
  ])
  return { ...serialized, stats }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const team = await fetchTeamDetail(id)
    if (!team) throw new ApiError(404, 'Team not found')
    return ok({ team: await serializeDetailWithStats(team) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/teams/[id] — event managers only.
 *
 * WARNING: Event.teamId is onDelete: Cascade, so deleting a team also deletes
 * its events (and their tasks). The client confirms with explicit cascade
 * counts before calling this endpoint.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    assertAccess(canManageTeams(user), 'Only event managers can delete teams')
    const { id } = await params

    const existing = await fetchTeamDetail(id)
    if (!existing) throw new ApiError(404, 'Team not found')

    const deleted = await db.team.delete({ where: { id }, select: { id: true, name: true } })

    await logActivity(user.id, ACTIVITY_ACTIONS.TEAM_DELETED, {
      teamId: deleted.id,
      name: deleted.name,
      eventCount: existing.events.length,
    })

    return ok({ deleted: true, id: deleted.id })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    assertAccess(canManageTeams(user), 'Only event managers can edit teams')
    const { id } = await params
    const existing = await fetchTeamDetail(id)
    if (!existing) throw new ApiError(404, 'Team not found')

    const body = await parseBody(request, updateTeamSchema)

    if (body.managerId) {
      const manager = await db.user.findUnique({ where: { id: body.managerId } })
      if (!manager) throw new ApiError(404, 'Manager not found')
    }

    let memberIds: string[] | null = null
    if (body.memberIds !== undefined) {
      memberIds = [...new Set(body.memberIds)]
      if (memberIds.length > 0) {
        const found = await db.user.findMany({
          where: { id: { in: memberIds } },
          select: { id: true },
        })
        if (found.length !== memberIds.length) {
          throw new ApiError(404, 'One or more team members not found')
        }
      }
    }

    await db.team.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.managerId !== undefined ? { managerId: body.managerId } : {}),
        ...(memberIds !== null
          ? { members: { set: memberIds.map((memberId) => ({ id: memberId })) } }
          : {}),
      },
    })

    await logActivity(user.id, ACTIVITY_ACTIONS.TEAM_UPDATED, { teamId: id, name: body.name ?? existing.name })

    // Phase 7 team rooms: roster/settings changes push live to subscribers
    // (e.g. the teams page refreshes without a manual reload).
    emitTeamChange(id, 'team:updated', { actorId: user.id, name: body.name ?? existing.name })

    const team = await fetchTeamDetail(id)
    if (!team) throw new ApiError(404, 'Team not found')
    return ok({ team: await serializeDetailWithStats(team) })
  } catch (error) {
    return handleApiError(error)
  }
}
