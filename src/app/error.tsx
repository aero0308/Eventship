'use client'

/**
 * Route-level error boundary (Next.js App Router).
 * Catches uncaught render/data errors inside the SPA shell and offers a
 * recovery path, matching the app's stone/emerald design language.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { describeError } from '@/lib/describe-error'
import { navigate, useHashRoute } from '@/hooks/use-hash-route'
import { ROUTES } from '@/lib/constants'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [message, setMessage] = useState('Something went wrong while rendering this page.')
  const path = useHashRoute()

  useEffect(() => {
    // Surface the real error in the console for debugging; the UI stays friendly.
    console.error('[app-error]', error)
    setMessage(describeError(error))
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div
        role="alert"
        aria-live="assertive"
        className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {path ? (
          <p className="mt-1 text-xs text-muted-foreground/70">
            while viewing <code className="rounded bg-muted px-1.5 py-0.5">{path}</code>
          </p>
        ) : null}
        {error.digest ? (
          <p className="mt-1 text-xs text-muted-foreground/70">
            error id: <code className="rounded bg-muted px-1.5 py-0.5">{error.digest}</code>
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={reset}
            className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => navigate(ROUTES.DASHBOARD, true)}
          >
            <Home className="mr-2 h-4 w-4" aria-hidden="true" />
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
