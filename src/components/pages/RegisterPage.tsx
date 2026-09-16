'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, UserPlus } from 'lucide-react'
import type { UserDTO } from '@/types'
import { ROUTES } from '@/lib/constants'
import { ApiClientError } from '@/lib/api-client'
import { scorePassword } from '@/lib/password-strength'
import { useAuthStore } from '@/stores/auth-store'
import { navigate } from '@/hooks/use-hash-route'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { PasswordMatchHint, PasswordStrength } from '@/components/shared/PasswordStrength'

/*
 * Sign-up form. Multi-tenant contract: self-registered accounts are members
 * pending onboarding — the next step is the mandatory "join or create an
 * event room" gate, which is where roles are granted (create → manager,
 * join → member). No role/team selection happens here anymore.
 */
export function RegisterPage() {
  const register = useAuthStore((s) => s.register)
  const loading = useAuthStore((s) => s.loading)
  const { toast } = useToast()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [focusedConfirm, setFocusedConfirm] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    // Mirrors the shared strong-password policy enforced server-side.
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

    try {
      const user: UserDTO = await register({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
      })
      toast({ title: `Welcome, ${user.fullName}!`, description: 'Your account has been created.' })
      // Mandatory onboarding: join an existing room or create a new one.
      navigate(ROUTES.ONBOARDING)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Unable to create your account. Please try again.'
      setError(message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form space-y-4" noValidate>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Name + email share a row on wide screens so the form fits short
          viewports without scrolling (stacks on mobile). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="register-name">Full name</Label>
          <Input
            id="register-name"
            type="text"
            autoComplete="name"
            placeholder="Alex Morgan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password">Password</Label>
        <PasswordInput
          id="register-password"
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
        <Label htmlFor="register-confirm">Confirm password</Label>
        <PasswordInput
          id="register-confirm"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onFocus={() => setFocusedConfirm(true)}
          required
        />
        <PasswordMatchHint password={password} confirm={confirmPassword} visible={focusedConfirm} />
      </div>

      {/* Next-step teaser: role and team are decided at the room gate. */}
      <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Next, you&apos;ll <span className="text-foreground">create a new event room</span> (you become the manager) or{' '}
        <span className="text-foreground">join one</span> with a Room ID + password.
      </p>

      <Button
        type="submit"
        className="h-11 w-full bg-fora-accent text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] transition-shadow hover:bg-fora-accent-hover hover:shadow-[0_0_36px_rgba(99,102,241,0.5)]"
        disabled={loading}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />}
        {loading ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => navigate(ROUTES.LOGIN)}
          className="min-h-11 font-semibold text-fora-glow underline-offset-4 hover:underline sm:min-h-0"
        >
          Sign in
        </button>
      </p>
    </form>
  )
}
