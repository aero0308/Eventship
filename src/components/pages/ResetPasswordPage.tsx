'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, KeyRound, LinkIcon, Loader2, LogIn } from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import { scorePassword } from '@/lib/password-strength'
import { navigate, useHashRoute } from '@/hooks/use-hash-route'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { PasswordMatchHint, PasswordStrength } from '@/components/shared/PasswordStrength'

/**
 * Step 2 of the reset flow: reached from the emailed (or demo-inbox) link as
 * #/reset-password?token=…. Consumes the single-use token, then requires a
 * fresh sign-in — every existing session was revoked.
 */
export function ResetPasswordPage() {
  const hashRoute = useHashRoute()
  const { toast } = useToast()

  const token = useMemo(() => {
    const query = hashRoute.split('?')[1] ?? ''
    return new URLSearchParams(query).get('token')
  }, [hashRoute])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [focusedConfirm, setFocusedConfirm] = useState(false)

  // No token (or a mangled link) → explain instead of rendering a dead form.
  if (!token) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50/70 p-5 text-center dark:border-red-500/25 dark:bg-red-500/10">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300">
            <LinkIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="font-semibold text-red-900 dark:text-red-200">This link is missing its reset token</p>
          <p className="text-sm text-red-800/80 dark:text-red-300/80">
            Open the password reset link from your email — or start a new request below.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
        >
          Request a new reset link
        </Button>
      </div>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const strength = scorePassword(password)
    const unmet = strength.checks.filter((c) => !c.met)
    if (unmet.length > 0) {
      setError(`Password is too weak — missing: ${unmet.map((c) => c.label.toLowerCase()).join(', ')}.`)
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: password })
      setDone(true)
      toast({
        title: 'Password updated',
        description: 'All devices were signed out — sign in with your new password.',
      })
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Unable to reset the password. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="space-y-4"
      >
        <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 text-center dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">Your password has been reset</p>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80">
            Every active session was signed out for safety. Use your new password to sign in.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => navigate(ROUTES.LOGIN)}
        >
          <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
          Continue to sign in
        </Button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="reset-password">New password</Label>
        <PasswordInput
          id="reset-password"
          autoComplete="new-password"
          placeholder="Min 8 chars with upper, lower, number & symbol"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <PasswordStrength password={password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-confirm">Confirm new password</Label>
        <PasswordInput
          id="reset-confirm"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onFocus={() => setFocusedConfirm(true)}
          required
        />
        <PasswordMatchHint password={password} confirm={confirmPassword} visible={focusedConfirm} />
      </div>

      <Button type="submit" className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {loading ? 'Updating…' : 'Reset password'}
      </Button>
    </form>
  )
}
