'use client'

/**
 * Admin · User management (EVENT_MANAGER only).
 * Role changes, team assignment, activate/deactivate — server enforces the
 * same guardrails (no self-demotion, sessions revoked on deactivation).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CircleUser,
  ListChecks,
  RefreshCw,
  SearchX,
  Search,
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
  UserCheck,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { TeamDTO, UpdateUserPayload, UserWithStatsDTO } from '@/types'
import { ROLE_BADGE_CLASSES, ROLE_LABELS, ROLES } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { initialsOf } from '@/components/layout/Layout'

type RoleFilter = 'ALL' | 'EVENT_MANAGER' | 'TEAM_LEADER' | 'EMPLOYEE'
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function AdminPage() {
  const viewer = useAuthStore((s) => s.user)
  const { toast } = useToast()

  const [users, setUsers] = useState<UserWithStatsDTO[]>([])
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [deactivateTarget, setDeactivateTarget] = useState<UserWithStatsDTO | null>(null)

  const load = useCallback(async () => {
    try {
      const [usersData, teamsData] = await Promise.all([
        api.get<{ users: UserWithStatsDTO[] }>('/users'),
        api.get<{ teams: TeamDTO[] }>('/teams'),
      ])
      setUsers(usersData.users)
      setTeams(teamsData.teams)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patchUser = useCallback(
    async (target: UserWithStatsDTO, payload: UpdateUserPayload, successTitle: string) => {
      setBusyIds((prev) => new Set(prev).add(target.id))
      const previous = users
      // Optimistic update
      setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, ...payload } : u)))
      try {
        const data = await api.patch<{ user: UserWithStatsDTO }>(`/users/${target.id}`, payload)
        setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, ...data.user } : u)))
        toast({ title: successTitle, description: `${data.user.fullName} updated.` })
      } catch (err) {
        setUsers(previous)
        toast({
          title: 'Update failed',
          description: err instanceof ApiClientError ? err.message : 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev)
          next.delete(target.id)
          return next
        })
      }
    },
    [users, toast]
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((u) => {
      if (term && !u.fullName.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) return false
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
      if (statusFilter === 'ACTIVE' && !u.isActive) return false
      if (statusFilter === 'INACTIVE' && u.isActive) return false
      return true
    })
  }, [users, search, roleFilter, statusFilter])

  const summary = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      managers: users.filter((u) => u.role === 'EVENT_MANAGER').length,
      inactive: users.filter((u) => !u.isActive).length,
    }),
    [users]
  )

  if (viewer?.role !== 'EVENT_MANAGER') {
    return (
      <div className="py-10">
        <EmptyState
          icon={ShieldOff}
          title="Access restricted"
          hint="User management is only available to event managers. If you believe this is a mistake, ask an administrator."
          action={
            <Button onClick={() => window.history.back()} variant="outline" className="min-h-11">
              Go back
            </Button>
          }
        />
      </div>
    )
  }

  const isFiltered = search.trim() !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL'

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        subtitle="Roles, team assignments and account access across the workspace."
        className="mb-0"
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-11">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={summary.total} sub="workspace accounts" tint="stone" />
        <StatCard icon={UserCheck} label="Active" value={summary.active} sub="can sign in now" tint="emerald" />
        <StatCard icon={ShieldCheck} label="Event managers" value={summary.managers} sub="full workspace control" tint="amber" />
        <StatCard icon={ShieldOff} label="Deactivated" value={summary.inactive} sub="sessions revoked" tint="red" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
            className="h-11 pl-9"
          />
        </div>
        <div className="flex gap-3">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="h-11 w-full sm:w-44" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-11 w-full sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground lg:ml-auto">
          {loading ? 'Loading…' : `${filtered.length} of ${users.length} users`}
        </p>
      </div>

      {/* Directory */}
      <Card className="py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-28" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <EmptyState
                icon={SearchX}
                title="Could not load users"
                hint={error}
                action={
                  <Button onClick={() => void load()} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    Try again
                  </Button>
                }
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CircleUser}
                title={isFiltered ? 'No matching users' : 'No users yet'}
                hint={isFiltered ? 'Try clearing the search or filters.' : 'Invite your team by sharing the register link.'}
                action={
                  isFiltered ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('')
                        setRoleFilter('ALL')
                        setStatusFilter('ALL')
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <TooltipProvider delayDuration={250}>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">Tasks</TableHead>
                      <TableHead>Last sign-in</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-6 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => {
                      const isSelf = u.id === viewer?.id
                      const busy = busyIds.has(u.id)
                      return (
                        <TableRow key={u.id} className={cn(!u.isActive && 'opacity-60')}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-border">
                                <AvatarFallback
                                  className={cn(
                                    'text-xs font-semibold text-white',
                                    u.isActive ? 'bg-emerald-600' : 'bg-stone-400'
                                  )}
                                >
                                  {initials(u.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                                  {u.fullName}
                                  {isSelf ? (
                                    <Badge variant="outline" className="border-border bg-muted/60 px-1.5 py-0 text-[10px] text-muted-foreground">
                                      you
                                    </Badge>
                                  ) : null}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Select
                                    value={u.role}
                                    disabled={isSelf || busy}
                                    onValueChange={(role) =>
                                      void patchUser(u, { role: role as UserWithStatsDTO['role'] }, 'Role updated')
                                    }
                                  >
                                    <SelectTrigger
                                      aria-label={`Role for ${u.fullName}`}
                                      className={cn(
                                        'h-9 w-40 border-transparent bg-transparent text-xs font-medium shadow-none hover:border-border',
                                        ROLE_BADGE_CLASSES[u.role]
                                      )}
                                    >
                                      <ShieldQuestion className="mr-1 h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ROLES.map((role) => (
                                        <SelectItem key={role} value={role} disabled={role === u.role}>
                                          {ROLE_LABELS[role]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </span>
                              </TooltipTrigger>
                              {isSelf ? <TooltipContent>You cannot change your own role</TooltipContent> : null}
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={u.teamId ?? 'none'}
                              disabled={busy}
                              onValueChange={(teamId) =>
                                void patchUser(u, { teamId: teamId === 'none' ? null : teamId }, 'Team updated')
                              }
                            >
                              <SelectTrigger
                                aria-label={`Team for ${u.fullName}`}
                                className="h-9 w-36 border-transparent bg-transparent text-xs shadow-none hover:border-border"
                              >
                                <Users className="mr-1 h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No team</SelectItem>
                                {teams.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                                  <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                  {u.stats.openTasks}
                                  {u.stats.overdueTasks > 0 ? (
                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1 text-[10px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                                      {u.stats.overdueTasks}
                                    </span>
                                  ) : null}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {u.stats.openTasks} open · {u.stats.overdueTasks} overdue · {u.stats.completedTasks} completed
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                              {u.lastLoginAt
                                ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true })
                                : 'Never signed in'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                'gap-1.5',
                                u.isActive
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300'
                              )}
                            >
                              <span
                                className={cn('h-1.5 w-1.5 rounded-full', u.isActive ? 'bg-emerald-500' : 'bg-red-500')}
                                aria-hidden="true"
                              />
                              {u.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            {u.isActive ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={cn('inline-block', isSelf && 'cursor-not-allowed')}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/25 dark:hover:bg-red-500/10"
                                      disabled={isSelf || busy}
                                      onClick={() => setDeactivateTarget(u)}
                                    >
                                      <ShieldOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                      Deactivate
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {isSelf ? <TooltipContent>You cannot deactivate yourself</TooltipContent> : null}
                              </Tooltip>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/25 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                                disabled={busy}
                                onClick={() => void patchUser(u, { isActive: true }, 'Account reactivated')}
                              >
                                <UserCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Reactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-border md:hidden">
                {filtered.map((u) => {
                  const isSelf = u.id === viewer?.id
                  const busy = busyIds.has(u.id)
                  return (
                    <li key={u.id} className={cn('space-y-3 p-4', !u.isActive && 'opacity-60')}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarFallback
                            className={cn('text-xs font-semibold text-white', u.isActive ? 'bg-emerald-600' : 'bg-stone-400')}
                          >
                            {initialsOf(u.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                            {u.fullName}
                            {isSelf ? <span className="text-[10px] font-normal text-muted-foreground">(you)</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0',
                            u.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300'
                          )}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
                          <Select
                            value={u.role}
                            disabled={isSelf || busy}
                            onValueChange={(role) => void patchUser(u, { role: role as UserWithStatsDTO['role'] }, 'Role updated')}
                          >
                            <SelectTrigger aria-label={`Role for ${u.fullName}`} className="h-10 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role} value={role} disabled={role === u.role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Team</p>
                          <Select
                            value={u.teamId ?? 'none'}
                            disabled={busy}
                            onValueChange={(teamId) =>
                              void patchUser(u, { teamId: teamId === 'none' ? null : teamId }, 'Team updated')
                            }
                          >
                            <SelectTrigger aria-label={`Team for ${u.fullName}`} className="h-10 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No team</SelectItem>
                              {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                          {u.stats.openTasks} open
                          {u.stats.overdueTasks > 0 ? (
                            <span className="font-semibold text-red-600 dark:text-red-300">· {u.stats.overdueTasks} overdue</span>
                          ) : null}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                          {u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true }) : 'never'}
                        </span>
                      </div>
                      {u.isActive ? (
                        <Button
                          variant="outline"
                          className="h-10 w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/25 dark:hover:bg-red-500/10"
                          disabled={isSelf || busy}
                          onClick={() => setDeactivateTarget(u)}
                        >
                          <ShieldOff className="mr-1.5 h-4 w-4" aria-hidden="true" />
                          {isSelf ? 'You cannot deactivate yourself' : 'Deactivate account'}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="h-10 w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/25 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                          disabled={busy}
                          onClick={() => void patchUser(u, { isActive: true }, 'Account reactivated')}
                        >
                          <UserCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                          Reactivate account
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Deactivate confirmation */}
      <AlertDialog open={deactivateTarget !== null} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out immediately and removed from this room — they lose access to all workspace data.
              They can still sign in, but must create a new room or join one with a Room ID and password. Their tasks and
              history here stay intact — nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deactivateTarget) void patchUser(deactivateTarget, { isActive: false }, 'Account deactivated')
                setDeactivateTarget(null)
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
