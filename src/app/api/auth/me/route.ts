import { handleApiError, ok, requireUser } from '@/lib/api-utils'
import { toPublicUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireUser()
    return ok({ user: toPublicUser(user) })
  } catch (error) {
    return handleApiError(error)
  }
}
