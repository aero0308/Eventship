import { db } from '@/lib/db'
import { handleApiError, ok, requireUser } from '@/lib/api-utils'
import { toPublicUser } from '@/lib/auth'

export async function GET() {
  try {
    await requireUser()
    // Contract: return ALL users (frontend filters inactive ones where needed).
    const users = await db.user.findMany({
      orderBy: { fullName: 'asc' },
      include: { team: { select: { id: true, name: true } } },
    })
    return ok({ users: users.map(toPublicUser) })
  } catch (error) {
    return handleApiError(error)
  }
}
