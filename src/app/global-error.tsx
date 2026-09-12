'use client'

/**
 * Root error boundary — last resort when the document shell itself fails to
 * render (global-error.tsx replaces <html>/<body>, so it must be self-contained
 * and cannot rely on the app's fonts or theme provider).
 */

import { useEffect } from 'react'
import { describeError } from '@/lib/describe-error'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafaf9',
          color: '#1c1917',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          padding: '1.5rem',
        }}
      >
        <div
          role="alert"
          style={{
            width: '100%',
            maxWidth: 420,
            textAlign: 'center',
            border: '1px solid #e7e5e4',
            borderRadius: 12,
            background: '#ffffff',
            padding: '2rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>EventFlow hit a snag</h1>
          <p style={{ margin: '0.75rem 0 0', fontSize: 14, color: '#78716c' }}>
            {describeError(error)}
          </p>
          {error.digest ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: 12, color: '#a8a29e' }}>
              error id: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: 44,
              padding: '0 1.25rem',
              borderRadius: 10,
              border: 'none',
              background: '#059669',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
