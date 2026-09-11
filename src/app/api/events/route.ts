import { db } from '@/lib/db'
import { EVENT_STATUSES, ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody, requireUser } from '@/lib/api-utils'
import { canManageEvents, assertAccess } from '@/lib/permissions'
import { createEventSchema } from '@/lib/schemas'
import {
  computeTaskStatsMap,
  emptyTaskStats,
  eventInclude,
  serializeEvent,
} from '../_lib/events'
import type { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(request.url)

    const where: Prisma.EventWhereInput = {}
    const status = searchParams.get('status')
    if (status && (EVENT_STATUSES as readonly string[]).includes(status)) where.status = status
    const teamId = searchParams.get('teamId')
    if (teamId) where.teamId = teamId
    const search = searchParams.get('search')
    // SQLite `contains` matching is case-insensitive for ASCII text.
    if (search) where.name = { contains: search }

    // Date-range filter on the event's start date (inclusive). `startDateTo`
    // is expanded to the end of that UTC day so same-day events match.
    // Unparseable values are ignored rather than erroring the whole request.
    const fromParam = searchParams.get('startDateFrom')
    const toParam = searchParams.get('startDateTo')
    const fromDate = fromParam ? new Date(fromParam) : null
    const toDate = toParam ? new Date(`${toParam}T23:59:59.999Z`) : null
    const startDate = {
      ...(fromDate && !Number.isNaN(fromDate.getTime()) ? { gte: fromDate } : {}),
      ...(toDate && !Number.isNaN(toDate.getTime()) ? { lte: toDate } : {}),
    }
    if (Object.keys(startDate).length > 0) where.startDate = startDate

    const events = await db.event.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: eventInclude,
    })
    const statsMap = await computeTaskStatsMap(events.map((event) => event.id))
    return ok({
      events: events.map((event) => serializeEvent(event, statsMap.get(event.id) ?? emptyTaskStats())),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await parseBody(request, createEventSchema)

    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)
    if (endDate.getTime() < startDate.getTime()) {
      throw new ApiError(400, 'End date must be on or after start date')
    }

    const team = await db.team.findUnique({ where: { id: body.teamId } })
    if (!team) throw new ApiError(404, 'Team not found')
    assertAccess(
      canManageEvents(user, team.id),
      'Only event managers or the owning team leader can create events for this team'
    )

    const created = await db.event.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        location: body.location ?? null,
        startDate,
        endDate,
        status: body.status,
        teamId: body.teamId,
        createdBy: user.id,
      },
    })

    await logActivity(user.id, ACTIVITY_ACTIONS.EVENT_CREATED, {
      eventId: created.id,
      name: created.name,
    })

    const event = await db.event.findUniqueOrThrow({
      where: { id: created.id },
      include: eventInclude,
    })
    return ok({ event: serializeEvent(event, emptyTaskStats()) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
