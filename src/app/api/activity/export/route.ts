import { db } from '@/lib/db'
import { ApiError, handleApiError } from '@/lib/api-utils'
import { requireRoomUser } from '@/lib/room'

const MAX_ROWS = 5000

/**
 * GET /api/activity/export[?action=A,B][&userId=<id|me>][&from=ISO][&to=ISO]
 * EVENT_MANAGER-only audit trail export as CSV (RFC 4180, BOM for Excel).
 * Caps at 5000 rows (newest first) to keep responses bounded.
 */
export async function GET(request: Request) {
  try {
    const { user, roomId } = await requireRoomUser()
    if (user.role !== 'EVENT_MANAGER') {
      throw new ApiError(403, 'Only event managers can export the audit log')
    }

    const { searchParams } = new URL(request.url)

    const actions = (searchParams.get('action') ?? '')
      .split(',')
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean)

    const rawUserId = (searchParams.get('userId') ?? '').trim()
    const userId = rawUserId === 'me' ? user.id : rawUserId || undefined

    const fromRaw = searchParams.get('from')
    const toRaw = searchParams.get('to')
    const from = fromRaw && !Number.isNaN(Date.parse(fromRaw)) ? new Date(fromRaw) : undefined
    const to = toRaw && !Number.isNaN(Date.parse(toRaw)) ? new Date(toRaw) : undefined

    const logs = await db.activityLog.findMany({
      where: {
        // Tenant isolation: the export only ever contains this room's audit trail.
        roomId,
        ...(actions.length > 0 ? { action: { in: actions } } : {}),
        ...(userId ? { userId } : {}),
        ...(from || to
          ? { timestamp: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: MAX_ROWS,
      include: { user: { select: { fullName: true, email: true, role: true } } },
    })

    const escape = (value: string): string => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
    const cell = (value: string | number | null | undefined): string => escape(value === null || value === undefined ? '' : String(value))

    const header = 'timestamp,actor_name,actor_email,actor_role,action,details'
    const rows = logs.map((log) =>
      [
        cell(log.timestamp.toISOString()),
        cell(log.user?.fullName ?? 'Unknown'),
        cell(log.user?.email ?? ''),
        cell(log.user?.role ?? ''),
        cell(log.action),
        cell(log.details ?? ''),
      ].join(',')
    )

    const csv = '\uFEFF' + [header, ...rows].join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="eventflow-audit-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
