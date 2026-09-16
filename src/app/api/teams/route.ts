import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody } from '@/lib/api-utils'
import { createTeamSchema } from '@/lib/schemas'
import { canManageTeams, assertAccess } from '@/lib/permissions'
import { requireRoomUser } from '@/lib/room'
import {
  computeTeamStats,
  serializeTeamDetail,
  teamDetailInclude,
  teamListInclude,
  serializeTeamList,
} from '../_lib/teams'

export async function GET() {
  try {
    const { roomId } = await requireRoomUser()
    // Tenant isolation: only teams inside the caller's room.
    const teams = await db.team.findMany({
      where: { roomId },
      orderBy: { name: 'asc' },
      include: teamListInclude,
    })
    return ok({ teams: teams.map(serializeTeamList) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { user, roomId } = await requireRoomUser()
    assertAccess(canManageTeams(user), 'Only event managers can create teams')
    const body = await parseBody(request, createTeamSchema)

    if (body.managerId) {
      const manager = await db.user.findFirst({ where: { id: body.managerId, roomId } })
      if (!manager) throw new ApiError(404, 'Manager not found in your event room')
    }

    const memberIds = [...new Set(body.memberIds ?? [])]
    if (memberIds.length > 0) {
      const found = await db.user.findMany({
        where: { id: { in: memberIds }, roomId },
        select: { id: true },
      })
      if (found.length !== memberIds.length) {
        throw new ApiError(404, 'One or more team members are not in your event room')
      }
    }

    const created = await db.team.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        roomId,
        managerId: body.managerId ?? null,
        ...(memberIds.length > 0
          ? { members: { connect: memberIds.map((id) => ({ id })) } }
          : {}),
      },
    })

    await logActivity(user.id, ACTIVITY_ACTIONS.TEAM_CREATED, { teamName: created.name }, roomId)

    const team = await db.team.findUniqueOrThrow({
      where: { id: created.id },
      include: teamDetailInclude,
    })
    const stats = await computeTeamStats(team.events.map((event) => event.id))
    return ok({ team: { ...serializeTeamDetail(team), stats } }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
