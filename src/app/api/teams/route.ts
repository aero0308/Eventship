import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody, requireUser } from '@/lib/api-utils'
import { createTeamSchema } from '@/lib/schemas'
import { canManageTeams, assertAccess } from '@/lib/permissions'
import {
  serializeTeamDetail,
  teamDetailInclude,
  teamListInclude,
  serializeTeamList,
} from '../_lib/teams'

export async function GET() {
  try {
    await requireUser()
    const teams = await db.team.findMany({
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
    const user = await requireUser()
    assertAccess(canManageTeams(user), 'Only event managers can create teams')
    const body = await parseBody(request, createTeamSchema)

    if (body.managerId) {
      const manager = await db.user.findUnique({ where: { id: body.managerId } })
      if (!manager) throw new ApiError(404, 'Manager not found')
    }

    const memberIds = [...new Set(body.memberIds ?? [])]
    if (memberIds.length > 0) {
      const found = await db.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true },
      })
      if (found.length !== memberIds.length) {
        throw new ApiError(404, 'One or more team members not found')
      }
    }

    const created = await db.team.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        managerId: body.managerId ?? null,
        ...(memberIds.length > 0
          ? { members: { connect: memberIds.map((id) => ({ id })) } }
          : {}),
      },
    })

    await logActivity(user.id, ACTIVITY_ACTIONS.TEAM_CREATED, { teamName: created.name })

    const team = await db.team.findUniqueOrThrow({
      where: { id: created.id },
      include: teamDetailInclude,
    })
    return ok({ team: serializeTeamDetail(team) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
