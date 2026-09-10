'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  Globe,
  History,
  KeyRound,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  Monitor,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import type { ActivityLogDTO, TaskDTO, TeamDTO, UserDTO } from '@/types'
import { ROLE_BADGE_CLASSES, ROLE_LABELS, ROUTES } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import { scorePassword } from '@/lib/password-strength'
import { navigate } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { initialsOf } from '@/components/shared/ActivityFeed'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { PasswordStrength } from '@/components/shared/PasswordStrength'
import { EmptyState } from '@/components/shared/EmptyState'
import { ActivityItem } from '@/components/shared/ActivityFeed'

interface PasswordForm {
  current: string
  next: string
  confirm: string
}

const EMPTY_PASSWORD: PasswordForm = { current: '', next: '', confirm: '' }

/** Live session row as returned by GET /api/auth/sessions. */
interface SessionRow {
  id: string
  createdAt: string
  expiresAt: string
  lastSeenAt: string
  userAgent: string | null
  isCurrent: boolean
}

/** Map a stored User-Agent to a friendly "browser on OS" label + device icon. */
function describeDevice(ua: string | null): { label: string; icon: LucideIcon } {
  if (!ua) return { label: 'Unknown device', icon: Globe }
  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua)
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : 'Browser'
  const os = /iPhone|iPad/i.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /CrOS/.test(ua)
          ? 'ChromeOS'
          : /Mac OS/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : ''
  return {
    label: [browser, os ? `on ${os}` : null, mobile ? '(mobile)' : null].filter(Boolean).join(' '),
    icon: mobile ? Smartphone : Monitor,
  }
}

export function ProfilePage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)

  const [myTasks, setMyTasks] = useState<TaskDTO[]>([])
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [activity, setActivity] = useState<ActivityLogDTO[]>([])
  const [loading, setLoading] = useState(true)

  const [pwForm, setPwForm] = useState<PasswordForm>(EMPTY_PASSWORD)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaving, setPwSaving] = useState(false)

  const setUser = useAuthStore((s) => s.setUser)
  const [guardSaving, setGuardSaving] = useState(false)

  // ---- session manager -----------------------------------------------------
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const [revokingOthers, setRevokingOthers] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.get<{ sessions: SessionRow[] }>('/auth/sessions')
      setSessions(data.sessions)
    } catch {
      // Non-fatal — the card renders an explanatory empty state.
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const revokeSession = async (row: SessionRow) => {
    setBusySessionId(row.id)
    try {
      const data = await api.del<{ success: boolean; revokedCurrent: boolean }>(`/auth/sessions/${row.id}`)
      if (data.revokedCurrent) {
        // We just signed ourselves out — reset the store and bounce to login.
        setUser(null)
        navigate(ROUTES.LOGIN)
        toast({ title: 'Signed out', description: 'This device was signed out of EventFlow.' })
        return
      }
      toast({ title: 'Device signed out', description: 'That session can no longer access your account.' })
      await loadSessions()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to sign out the device.'
      toast({ title: 'Could not sign out the device', description: message, variant: 'destructive' })
    } finally {
      setBusySessionId(null)
    }
  }

  const revokeOtherSessions = async () => {
    setRevokingOthers(true)
    try {
      const data = await api.post<{ revoked: number }>('/auth/sessions/revoke-others')
      toast({
        title: data.revoked > 0 ? `Signed out ${data.revoked} other device${data.revoked === 1 ? '' : 's'}` : 'No other devices',
        description: data.revoked > 0 ? 'Only this device stays signed in.' : undefined,
      })
      await loadSessions()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to revoke other sessions.'
      toast({ title: 'Could not revoke sessions', description: message, variant: 'destructive' })
    } finally {
      setRevokingOthers(false)
    }
  }

  const handleGuardToggle = async (enabled: boolean) => {
    if (!user) return
    setGuardSaving(true)
    // Optimistic flip; revert on failure.
    setUser({ ...user, strictDependencyGuard: enabled })
    try {
      const data = await api.patch<{ user: UserDTO }>('/auth/me', { strictDependencyGuard: enabled })
      setUser(data.user)
      toast({
        title: enabled ? 'Dependency guard enabled' : 'Dependency guard disabled',
        description: enabled
          ? 'You can no longer mark tasks complete while their dependencies are unfinished.'
          : 'Tasks can be completed regardless of their dependencies again.',
      })
    } catch (error) {
      setUser(user)
      const message = error instanceof ApiClientError ? error.message : 'Failed to update the workflow preference.'
      toast({ title: 'Could not update preference', description: message, variant: 'destructive' })
    } finally {
      setGuardSaving(false)
    }
  }

  const loadAll = useCallback(async () => {
    try {
      const [tasksData, teamsData, activityData] = await Promise.all([
        api.get<{ tasks: TaskDTO[] }>('/tasks?assignedTo=me'),
        api.get<{ teams: TeamDTO[] }>('/teams'),
        api.get<{ activities: ActivityLogDTO[] }>('/activity?userId=me&limit=6'),
      ])
      setMyTasks(tasksData.tasks)
      setTeams(teamsData.teams)
      setActivity(activityData.activities)
    } catch {
      // Individual tiles render their empty states; nothing fatal.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
    void loadSessions()
  }, [loadAll, loadSessions])

  const taskStats = useMemo(() => {
    const now = Date.now()
    const open = myTasks.filter((t) => t.status !== 'COMPLETED')
    return {
      open: open.length,
      overdue: open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now).length,
      completed: myTasks.length - open.length,
    }
  }, [myTasks])

  const myTeams = useMemo(() => {
    if (!user) return []
    return teams.filter(
      (t) => t.manager?.id === user.id || (t.members ?? []).some((m) => m.id === user.id)
    )
  }, [teams, user])

  const recentLogins = useMemo(() => activity.filter((a) => a.action === 'USER_LOGIN').slice(0, 2), [activity])

  const handlePasswordChange = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPwError(null)

    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      setPwError('Please fill in all three fields.')
      return
    }
    // Same strong-password policy as registration and reset (server enforces too).
    const strength = scorePassword(pwForm.next)
    const unmet = strength.checks.filter((c) => !c.met)
    if (unmet.length > 0) {
      setPwError(`Password is too weak — missing: ${unmet.map((c) => c.label.toLowerCase()).join(', ')}.`)
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('The new passwords do not match.')
      return
    }
    if (pwForm.next === pwForm.current) {
      setPwError('The new password must be different from the current one.')
      return
    }

    setPwSaving(true)
    try {
      await api.patch('/auth/password', { currentPassword: pwForm.current, newPassword: pwForm.next })
      setPwForm(EMPTY_PASSWORD)
      toast({
        title: 'Password updated',
        description: 'Your password was changed and other sessions were signed out.',
      })
      // Other sessions were just revoked — refresh the device list.
      void loadSessions()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to change the password.'
      setPwError(message)
    } finally {
      setPwSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
        <Card className="overflow-hidden py-0">
          <div className="relative">
            <div className="h-24 w-full bg-gradient-to-r from-emerald-600/90 via-emerald-500/80 to-teal-500/90" aria-hidden="true" />
            <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <Avatar className="-mt-8 h-20 w-20 border-4 border-card shadow-md">
                  <AvatarFallback className="bg-emerald-600 text-2xl font-bold text-white">
                    {initialsOf(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="pb-1">
                  <h1 className="text-xl font-bold tracking-tight text-foreground">{user.fullName}</h1>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <Badge variant="outline" className={cn('text-xs', ROLE_BADGE_CLASSES[user.role])}>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
                {user.team ? (
                  <Badge variant="outline" className="border-border bg-muted/50 text-xs text-muted-foreground">
                    <Users className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    {user.team.name}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="border-border bg-muted/50 text-xs text-muted-foreground">
                  <Clock className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Joined {format(new Date(user.createdAt), 'MMM yyyy')}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* My work stats */}
          <section aria-label="My work summary">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Open tasks', value: taskStats.open, icon: Clock, classes: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
                { label: 'Overdue', value: taskStats.overdue, icon: History, classes: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300' },
                { label: 'Completed', value: taskStats.completed, icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
              ].map((chip) => (
                <Card key={chip.label} className="py-0">
                  <CardContent className={cn('rounded-xl px-4 py-4', chip.classes)}>
                    <chip.icon className="h-4 w-4 opacity-70" aria-hidden="true" />
                    <p className="mt-2 text-2xl font-bold leading-none">{loading ? '–' : chip.value}</p>
                    <p className="mt-1.5 text-xs font-medium opacity-80">{chip.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 h-9 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
              onClick={() => navigate(`${ROUTES.TASKS}?assignee=me`)}
            >
              View my tasks on the board →
            </Button>
          </section>

          {/* Change password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Change password
              </CardTitle>
              <CardDescription>Changing your password signs out every other device for safety.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
                {pwError ? (
                  <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                    {pwError}
                  </p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="pw-current">Current</Label>
                    <Input
                      id="pw-current"
                      type="password"
                      autoComplete="current-password"
                      value={pwForm.current}
                      onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-new">New</Label>
                    <Input
                      id="pw-new"
                      type="password"
                      autoComplete="new-password"
                      value={pwForm.next}
                      onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-confirm">Confirm new</Label>
                    <Input
                      id="pw-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={pwForm.confirm}
                      onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                </div>
                <PasswordStrength password={pwForm.next} hideWhenEmpty={false} />
                <div className="flex justify-end">
                  <Button type="submit" disabled={pwSaving} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
                    {pwSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Update password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* My recent activity */}
          <Card className="py-0">
            <CardContent className="px-6">
              <div className="flex items-center justify-between border-b border-border py-4">
                <h2 className="text-sm font-semibold text-foreground">My recent activity</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => navigate(ROUTES.ACTIVITY)}
                >
                  Full feed →
                </Button>
              </div>
              {loading ? (
                <div className="space-y-4 py-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : activity.length === 0 ? (
                <div className="py-6">
                  <EmptyState icon={History} title="No activity yet" hint="Your actions will appear here as you work." />
                </div>
              ) : (
                <ul className="py-5" aria-label="My recent activity">
                  {activity.map((a) => (
                    <ActivityItem key={a.id} activity={a} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Workflow preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Workflow preferences
              </CardTitle>
              <CardDescription>Guardrails that shape how you move work across the board.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'flex items-start justify-between gap-4 rounded-xl border p-3 transition-colors',
                  user.strictDependencyGuard
                    ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                    : 'border-border bg-muted/40'
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Strict dependency guard</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Stops you from marking a task “Completed” while any task it depends on is still open. Applies to
                    drag-and-drop, the task dialog and bulk actions.
                  </p>
                </div>
                <Switch
                  checked={user.strictDependencyGuard}
                  onCheckedChange={(checked) => void handleGuardToggle(checked)}
                  disabled={guardSaving}
                  aria-label="Toggle strict dependency guard"
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                The guard is personal — it only constrains your own actions, never your teammates’.
              </p>
            </CardContent>
          </Card>

          {/* My teams */}
          <Card className="py-0">
            <CardContent className="px-6">
              <h2 className="border-b border-border py-4 text-sm font-semibold text-foreground">My teams</h2>
              {loading ? (
                <div className="space-y-3 py-5">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : myTeams.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={Users}
                    title="No teams yet"
                    hint="You haven't been added to a team. Ask your manager to add you."
                    action={
                      <Button variant="outline" onClick={() => navigate(ROUTES.TEAMS)}>
                        Browse teams
                      </Button>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border/60 py-2">
                  {myTeams.map((team) => (
                    <li key={team.id} className="flex items-center gap-3 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                        <Users className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{team.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.manager?.id === user.id ? 'You are the manager' : `Managed by ${team.manager?.fullName ?? '—'}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={() => navigate(ROUTES.TEAMS)}>
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent sign-ins */}
          <Card className="py-0">
            <CardContent className="px-6">
              <h2 className="border-b border-border py-4 text-sm font-semibold text-foreground">Recent sign-ins</h2>
              {loading ? (
                <div className="space-y-3 py-5">
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ) : recentLogins.length === 0 ? (
                <p className="py-5 text-sm text-muted-foreground">No sign-in records found yet.</p>
              ) : (
                <ul className="py-3">
                  {recentLogins.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2.5 py-2 text-sm text-muted-foreground">
                      <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{format(new Date(entry.timestamp), 'EEE, MMM d, yyyy')}</span>
                      <span className="text-xs">{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Active sessions (device manager) */}
          <Card className="py-0">
            <CardContent className="px-6">
              <div className="flex items-center justify-between gap-2 border-b border-border py-4">
                <h2 className="text-sm font-semibold text-foreground">Active sessions</h2>
                {!sessionsLoading && sessions.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                    onClick={() => void revokeOtherSessions()}
                    disabled={revokingOthers}
                  >
                    {revokingOthers ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <MonitorSmartphone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Sign out others
                  </Button>
                ) : null}
              </div>

              {sessionsLoading ? (
                <div className="space-y-3 py-5">
                  <Skeleton className="h-11 w-full rounded-lg" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={MonitorSmartphone}
                    title="No active sessions"
                    hint="Sign in on this device to see it listed here."
                  />
                </div>
              ) : (
                <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto py-2" aria-label="Active sessions">
                  {sessions.map((row) => {
                    const device = describeDevice(row.userAgent)
                    return (
                      <li
                        key={row.id}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-1 py-3 transition-colors',
                          row.isCurrent
                            ? 'bg-emerald-50/50 dark:bg-emerald-500/[0.07]'
                            : 'hover:bg-muted/40'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                            row.isCurrent
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300'
                          )}
                        >
                          <device.icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                            {device.label}
                            {row.isCurrent ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-100/60 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                              >
                                This device
                              </Badge>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            Last active {formatDistanceToNow(new Date(row.lastSeenAt), { addSuffix: true })} · expires{' '}
                            {format(new Date(row.expiresAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-8 shrink-0 text-xs',
                            row.isCurrent
                              ? 'text-muted-foreground'
                              : 'text-red-600 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 dark:text-red-400'
                          )}
                          onClick={() => void revokeSession(row)}
                          disabled={busySessionId === row.id}
                          aria-label={
                            row.isCurrent ? 'Sign out of this device' : `Sign out ${device.label}`
                          }
                        >
                          {busySessionId === row.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {row.isCurrent ? 'Sign out' : 'Revoke'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {!sessionsLoading && sessions.length > 1 ? (
                <p className="border-t border-border/60 py-3 text-[11px] text-muted-foreground/70">
                  {sessions.length} devices are signed into your account. Signing out others keeps this device active.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
