'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, UserPlus } from 'lucide-react'
import type { TeamDTO, UserDTO } from '@/types'
import { ROLES, ROLE_LABELS, ROUTES } from '@/lib/constants'
import type { Role } from '@/types'
import { api, ApiClientError } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { navigate } from '@/hooks/use-hash-route'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const NO_TEAM = '__none__'

export function RegisterPage() {
  const register = useAuthStore((s) => s.register)
  const loading = useAuthStore((s) => s.loading)
  const { toast } = useToast()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('EMPLOYEE')
  const [teamId, setTeamId] = useState<string>(NO_TEAM)
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ teams: TeamDTO[] }>('/teams')
      .then((data) => {
        if (!cancelled) setTeams(data.teams)
      })
      .catch(() => {
        // Non-fatal — registration can continue without a team.
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    try {
      const user: UserDTO = await register({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        role,
        teamId: teamId === NO_TEAM ? undefined : teamId,
      })
      toast({ title: `Welcome, ${user.fullName}!`, description: 'Your account has been created.' })
      navigate(ROUTES.DASHBOARD)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Unable to create your account. Please try again.'
      setError(message)
    }
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

      <div className="space-y-2">
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
          required
          minLength={6}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="register-role">Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as Role)}>
            <SelectTrigger id="register-role" className="h-11 w-full" aria-label="Account role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-team">Team</Label>
          <Select value={teamId} onValueChange={setTeamId} disabled={teamsLoading}>
            <SelectTrigger id="register-team" className="h-11 w-full" aria-label="Team">
              <SelectValue placeholder={teamsLoading ? 'Loading teams…' : 'Choose a team'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TEAM}>No team</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />}
        {loading ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => navigate(ROUTES.LOGIN)}
          className="min-h-11 font-semibold text-emerald-700 underline-offset-4 hover:underline sm:min-h-0"
        >
          Sign in
        </button>
      </p>
    </form>
  )
}
