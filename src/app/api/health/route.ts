import { handleApiError, ok } from '@/lib/api-utils'

export async function GET() {
  try {
    return ok({
      status: 'ok',
      service: 'event-management-api',
      time: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
