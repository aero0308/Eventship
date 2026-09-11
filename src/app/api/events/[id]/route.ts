import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody, requireUser } from '@/lib/api-utils'
import { canManageEvents, assertAccess } from '@/lib/permissions'
import { updateEventSchema } from '@/lib/schemas'
import {
  computeTaskStatsMap,
  emptyTaskStats,
  eventInclude,
  serializeEvent,
  type EventWithRelations,
} from '../../_lib/events'
import { emitBoardChange, emitRealtime } from '@/lib/realtime'
import type { Prisma } from '@prisma/client'

async function fetchEventWithStats(id: string) {
  const event: EventWithRelations | null = await db.event.findUnique({
    where: { id },
    include: eventInclude,
  })
  if (!event) return null
  const statsMap = await computeTaskStatsMap([id])
  return serializeEvent(event, statsMap.get(id) ?? emptyTaskStats())
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const event = await fetchEventWithStats(id)
    if (!event) throw new ApiError(404, 'Event not found')
    return ok({ event })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const existing = await db.event.findUnique({ where: { id } })
    if (!existing) throw new ApiError(404, 'Event not found')
    assertAccess(
      canManageEvents(user, existing.teamId),
      'Only event managers or the owning team leader can edit this event'
    )

    const body = await parseBody(request, updateEventSchema)

    const nextStart = body.startDate ? new Date(body.startDate) : existing.startDate
    const nextEnd = body.endDate ? new Date(body.endDate) : existing.endDate
    if (nextEnd.getTime() < nextStart.getTime()) {
      throw new ApiError(400, 'End date must be on or after start date')
    }

    if (body.teamId && body.teamId !== existing.teamId) {
      const team = await db.team.findUnique({ where: { id: body.teamId } })
      if (!team) throw new ApiError(404, 'Team not found')
    }

    const data: Prisma.EventUpdateInput = {}
    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description
    if (body.location !== undefined) data.location = body.location
    if (body.startDate !== undefined) data.startDate = nextStart
    if (body.endDate !== undefined) data.endDate = nextEnd
    if (body.teamId !== undefined) data.team = { connect: { id: body.teamId } }
    if (body.status !== undefined) data.status = body.status

    const statusChanged = body.status !== undefined && body.status !== existing.status
    const otherChanged =
      (body.name !== undefined && body.name !== existing.name) ||
      (body.description !== undefined && body.description !== existing.description) ||
      (body.location !== undefined && body.location !== existing.location) ||
      body.startDate !== undefined ||
      body.endDate !== undefined ||
      (body.teamId !== undefined && body.teamId !== existing.teamId)
    const eventName = body.name ?? existing.name

    if (Object.keys(data).length > 0) {
      await db.event.update({ where: { id }, data })
      emitBoardChange(id, 'event:updated', user.id, { eventId: id })
      // Phase 7 team rooms: the owning team's subscribers hear it too.
      const targetTeamId = body.teamId ?? existing.teamId
      if (targetTeamId) {
        void emitRealtime({
          room: `team:${targetTeamId}`,
          event: 'board:changed',
          data: { type: 'event:updated', eventId: id, actorId: user.id, at: new Date().toISOString() },
        })
      }
    }

    if (statusChanged) {
      // Contract: status change wins — log EVENT_STATUS_CHANGED with {eventName, from, to}.
      await logActivity(user.id, ACTIVITY_ACTIONS.EVENT_STATUS_CHANGED, {
        eventName,
        from: existing.status,
        to: body.status,
      })
    } else if (otherChanged) {
      await logActivity(user.id, ACTIVITY_ACTIONS.EVENT_UPDATED, { eventName })
    }

    const event = await fetchEventWithStats(id)
    if (!event) throw new ApiError(404, 'Event not found')
    return ok({ event })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const existing = await db.event.findUnique({ where: { id }, select: { id: true, teamId: true } })
    if (!existing) throw new ApiError(404, 'Event not found')
    assertAccess(
      canManageEvents(user, existing.teamId),
      'Only event managers or the owning team leader can delete this event'
    )

    // Tasks (and their comments/dependencies) cascade-delete via schema relations.
    await db.event.delete({ where: { id } })
    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
