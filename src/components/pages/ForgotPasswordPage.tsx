'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Inbox, LifeBuoy, Loader2, MailCheck, KeyRound } from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import { navigate } from '@/hooks/use-hash-route'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Step 1 of the reset flow: request a reset link. The sandbox has no SMTP
 * provider, so when the API returns a `demoResetUrl` it is surfaced in a
 * "demo inbox" card that hands the user straight to the reset page — the
 * production equivalent is an emailed link.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [demoResetUrl, setDemoResetUrl] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const data = await api.post<{ success: boolean; demoResetUrl?: string }>('/auth/forgot-password', {
        email: email.trim(),
      })
      setDemoResetUrl(data.demoResetUrl ?? null)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to send the reset request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="space-y-4"
      >
        <div className="flex flex-col items-center gap-2 rounded-xl border border-fora-border bg-fora-surface-2 p-5 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <MailCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="font-semibold text-white">Check your inbox</p>
          <p className="text-sm leading-relaxed text-fora-text-2">
            If an account exists for <span className="font-medium text-white">{email.trim()}</span>, a password reset link is on
            its way. The link expires after 30 minutes.
          </p>
        </div>

        {demoResetUrl ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4" data-testid="demo-inbox">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <Inbox className="h-4 w-4" aria-hidden="true" />
              Demo inbox
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/70">
              This sandbox has no email provider, so the reset link that would normally be emailed is delivered here:
            </p>
            <Button
              type="button"
              className="mt-3 h-11 w-full bg-fora-accent text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] hover:bg-fora-accent-hover"
              onClick={() => {
                // demoResetUrl is shaped like a pastable URL suffix ("/#/reset-
                // password?token=…"); navigate() adds the "#", so strip it first.
                const route = demoResetUrl.split('#').pop() ?? demoResetUrl
                navigate(route)
              }}
            >
              <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              Open password reset page
            </Button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => navigate(ROUTES.LOGIN)}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to sign in
        </button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form space-y-4" noValidate>
      {error ? (
        <Alert variant="destructive" role="alert">
          <LifeBuoy className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm leading-relaxed text-muted-foreground">
        Enter the email address you registered with and we&apos;ll create a password reset link for you.
      </p>

      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
          required
        />
      </div>

      <Button
        type="submit"
        className="h-11 w-full bg-fora-accent text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] transition-shadow hover:bg-fora-accent-hover hover:shadow-[0_0_36px_rgba(99,102,241,0.5)]"
        disabled={loading}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>

      <button
        type="button"
        onClick={() => navigate(ROUTES.LOGIN)}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to sign in
      </button>
    </form>
  )
}
