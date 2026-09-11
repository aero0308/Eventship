'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { AlertCircle, Loader2, LogIn, TriangleAlert, Wand2 } from 'lucide-react'
import type { UserDTO } from '@/types'
import { ROUTES } from '@/lib/constants'
import { ApiClientError } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { navigate } from '@/hooks/use-hash-route'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/shared/PasswordInput'

const DEMO_EMAIL = 'admin@eventflow.io'
const DEMO_PASSWORD = 'password123'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const loading = useAuthStore((s) => s.loading)
  const { toast } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [capsLockOn, setCapsLockOn] = useState(false)

  const detectCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.')
      return
    }

    try {
      const user: UserDTO = await login({ email: email.trim(), password })
      toast({ title: `Welcome back, ${user.fullName}!`, description: 'You are now signed in.' })
      navigate(ROUTES.DASHBOARD)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Unable to sign in. Please try again.'
      setError(message)
    }
  }

  const fillDemo = () => {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form space-y-4" noValidate>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <button
            type="button"
            onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
            className="min-h-11 text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline sm:min-h-0"
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={detectCapsLock}
          onBlur={() => setCapsLockOn(false)}
          required
        />
        {capsLockOn ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" aria-live="polite">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Caps Lock is on.
          </p>
        ) : null}
      </div>

      <Button type="submit" className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />}
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm dark:border-emerald-500/25 dark:bg-emerald-500/10">
        <p className="font-medium text-emerald-900 dark:text-emerald-200">Demo account</p>
        <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-300/80">
          {DEMO_EMAIL} / {DEMO_PASSWORD}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-9 border-emerald-300 bg-card text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
          onClick={fillDemo}
        >
          <Wand2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Use demo account
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => navigate(ROUTES.REGISTER)}
          className="min-h-11 font-semibold text-emerald-700 underline-offset-4 hover:underline sm:min-h-0"
        >
          Create one
        </button>
      </p>
    </form>
  )
}
