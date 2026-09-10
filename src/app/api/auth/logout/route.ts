import { handleApiError, ok } from '@/lib/api-utils'
import { destroySession } from '@/lib/auth'

export async function POST() {
  try {
    await destroySession()
    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
