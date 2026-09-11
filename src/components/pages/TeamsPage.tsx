'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CircleCheck,
  Clock3,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import type { EventDTO, TeamDTO, UserDTO } from '@/types'
import { EVENT_STATUS_CLASSES, EVENT_STATUS_LABELS, ROLE_BADGE_CLASSES, ROLE_LABELS } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import {
  clearRealtimeRooms,
  getRealtimeSocket,
  setRealtimeRooms,
  type RealtimeDataEcho,
} from '@/lib/realtime-client'
import { useAuthStore } from '@/stores/auth-store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { initialsOf } from '@/components/layout/Layout'

/** Team detail with members + events included (GET /api/teams/[id]). */
type TeamDetail = TeamDTO

const NO_MANAGER = '__none__'

type TeamSort = 'name' | 'members' | 'events' | 'created'

const TEAM_SORT_LABELS: Record<TeamSort, string> = {
  name: 'Name A–Z',
  members: 'Most members',
  events: 'Most events',
  created: 'Newest first',
}

interface TeamFormState {
  name: string
  description: string
  managerId: string
  memberIds: string[]
}

export function TeamsPage() {
  const { toast } = useToast()
  const viewer = useAuthStore((s) => s.user)
  const canManage = viewer?.role === 'EVENT_MANAGER'

  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [users, setUsers] = useState<UserDTO[]>([])
  const [loading, setLoading] = useState(true)

  // Search + sort toolbar
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<TeamSort>('name')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<TeamFormState>({ name: '', description: '', managerId: NO_MANAGER, memberIds: [] })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Detail dialog
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<TeamFormState>({ name: '', description: '', managerId: NO_MANAGER, memberIds: [] })
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Quick member management (detail dialog, manager-only)
  const [addOpen, setAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [memberBusy, setMemberBusy] = useState<string | null>(null)

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true)
      try {
        const [teamsData, usersData] = await Promise.all([
          api.get<{ teams: TeamDTO[] }>('/teams'),
          api.get<{ users: UserDTO[] }>('/users'),
        ])
        setTeams(teamsData.teams)
        setUsers(usersData.users)
      } catch (error) {
        const message = error instanceof ApiClientError ? error.message : 'Failed to load teams.'
        if (!options?.silent) {
          toast({ title: 'Could not load teams', description: message, variant: 'destructive' })
        }
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    void loadData()
  }, [loadData])

  const userById = useMemo(() => {
    const map = new Map<string, UserDTO>()
    users.forEach((user) => map.set(user.id, user))
    return map
  }, [users])

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? teams.filter(
          (team) =>
            team.name.toLowerCase().includes(q) ||
            (team.description ?? '').toLowerCase().includes(q) ||
            (team.manager?.fullName ?? '').toLowerCase().includes(q)
        )
      : teams
    const sorted = [...list]
    switch (sortBy) {
      case 'members':
        sorted.sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0) || a.name.localeCompare(b.name))
        break
      case 'events':
        sorted.sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0) || a.name.localeCompare(b.name))
        break
      case 'created':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        break
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }, [teams, query, sortBy])

  /** Push a fresh team detail into both the list cache and the open dialog. */
  const applyTeamDetail = useCallback((team: TeamDTO) => {
    setTeams((list) => list.map((t) => (t.id === team.id ? { ...t, ...team } : t)))
    setDetail((prev) => (prev && prev.id === team.id ? { ...prev, ...team } : prev))
  }, [])

  const availableUsers = useMemo(() => {
    const memberIds = new Set((detail?.members ?? []).map((m) => m.id))
    const q = addQuery.trim().toLowerCase()
    return users.filter(
      (user) =>
        !memberIds.has(user.id) &&
        (!q || user.fullName.toLowerCase().includes(q) || user.email.toLowerCase().includes(q))
    )
  }, [users, detail, addQuery])

  // ============ Create ============
  const openCreate = () => {
    setForm({ name: '', description: '', managerId: NO_MANAGER, memberIds: [] })
    setFormError(null)
    setCreateOpen(true)
  }

  const toggleMember = (userId: string) => {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(userId) ? f.memberIds.filter((id) => id !== userId) : [...f.memberIds, userId],
    }))
  }

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) {
      setFormError('Please give the team a name.')
      return
    }
    setSaving(true)
    try {
      const data = await api.post<{ team: TeamDTO }>('/teams', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        managerId: form.managerId === NO_MANAGER ? null : form.managerId,
        memberIds: form.memberIds,
      })
      setCreateOpen(false)
      toast({ title: 'Team created', description: `“${data.team.name}” is ready for members and events.` })
      void loadData()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to create the team.'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  // ============ Detail ============
  // Phase 7: remote team edits bump this key to refetch the open dialog live.
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      setEditing(false)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    api
      .get<{ team: TeamDetail }>(`/teams/${detailId}`)
      .then((data) => {
        if (cancelled) return
        setDetail(data.team)
        setEditForm({
          name: data.team.name,
          description: data.team.description ?? '',
          managerId: data.team.managerId ?? NO_MANAGER,
          memberIds: (data.team.members ?? []).map((m) => m.id),
        })
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof ApiClientError ? error.message : 'Failed to load the team.'
          toast({ title: 'Could not open team', description: message, variant: 'destructive' })
          setDetailId(null)
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailId, detailRefreshKey, toast])

  // ============ Realtime (Phase 7) ============
  // Spec 7.6: auto-join the team room while a team detail dialog is open, so
  // roster/board activity for that team arrives live (silent — no presence).
  useEffect(() => {
    if (!detailId) return
    setRealtimeRooms('team-detail', [`team:${detailId}`], { presenceRooms: [] })
    return () => clearRealtimeRooms('team-detail')
  }, [detailId])

  // Remote team edit → refetch the open dialog.
  useEffect(() => {
    if (!detailId) return
    const socket = getRealtimeSocket()
    if (!socket) return
    const onTeamUpdated = (payload: { teamId?: string }) => {
      if (payload?.teamId === detailId) setDetailRefreshKey((key) => key + 1)
    }
    socket.on('team:updated', onTeamUpdated)
    return () => {
      socket.off('team:updated', onTeamUpdated)
    }
  }, [detailId])

  // Live list: team edits + board activity echo in as minimal hints and
  // refresh the grid's stats/member counts without a manual reload.
  useEffect(() => {
    const socket = getRealtimeSocket()
    if (!socket) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const onEcho = (payload: RealtimeDataEcho) => {
      if (payload.event !== 'team:updated' && !payload.event.startsWith('task:')) return
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        void loadData({ silent: true })
      }, 1200)
    }
    socket.on('data:echo', onEcho)
    return () => {
      socket.off('data:echo', onEcho)
      if (timer) clearTimeout(timer)
    }
  }, [loadData])

  const startEdit = () => {
    if (!detail) return
    setEditForm({
      name: detail.name,
      description: detail.description ?? '',
      managerId: detail.managerId ?? NO_MANAGER,
      memberIds: (detail.members ?? []).map((m) => m.id),
    })
    setEditing(true)
  }

  const handleEditSave = async () => {
    if (!detail || !editing) return
    if (!editForm.name.trim()) {
      toast({ title: 'Name required', description: 'The team name cannot be empty.', variant: 'destructive' })
      return
    }
    setEditSaving(true)
    try {
      const data = await api.patch<{ team: TeamDTO }>(`/teams/${detail.id}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        managerId: editForm.managerId === NO_MANAGER ? null : editForm.managerId,
        memberIds: editForm.memberIds,
      })
      applyTeamDetail(data.team)
      setEditing(false)
      toast({ title: 'Team updated', description: `“${data.team.name}” was saved.` })
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to save the team.'
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!detail) return
    setDeleting(true)
    try {
      await api.del(`/teams/${detail.id}`)
      setTeams((list) => list.filter((team) => team.id !== detail.id))
      setDetailId(null)
      setDeleteOpen(false)
      toast({ title: 'Team deleted', description: `“${detail.name}” has been removed.` })
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to delete the team.'
      toast({ title: 'Delete failed', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ============ Quick member management ============
  const memberIdsOf = (team: TeamDetail) => (team.members ?? []).map((m) => m.id)

  const removeMember = async (memberId: string, memberName: string) => {
    if (!detail) return
    setMemberBusy(memberId)
    try {
      const data = await api.patch<{ team: TeamDTO }>(`/teams/${detail.id}`, {
        memberIds: memberIdsOf(detail).filter((id) => id !== memberId),
      })
      applyTeamDetail(data.team)
      toast({ title: 'Member removed', description: `${memberName} is no longer part of “${data.team.name}”.` })
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to remove the member.'
      toast({ title: 'Could not remove member', description: message, variant: 'destructive' })
    } finally {
      setMemberBusy(null)
    }
  }

  const addMember = async (userId: string) => {
    if (!detail) return
    setMemberBusy(userId)
    try {
      const data = await api.patch<{ team: TeamDTO }>(`/teams/${detail.id}`, {
        memberIds: [...memberIdsOf(detail), userId],
      })
      applyTeamDetail(data.team)
      const added = userById.get(userId)
      toast({ title: 'Member added', description: `${added?.fullName ?? 'New member'} joined “${data.team.name}”.` })
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to add the member.'
      toast({ title: 'Could not add member', description: message, variant: 'destructive' })
    } finally {
      setMemberBusy(null)
    }
  }

  const memberStack = (team: TeamDTO) => {
    const members = team.members ?? []
    if (members.length === 0) return null
    const visible = members.slice(0, 5)
    const rest = members.length - visible.length
    return (
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {visible.map((member) => (
            <Avatar key={member.id} className="h-7 w-7 ring-2 ring-card">
              <AvatarFallback className="bg-teal-600 text-[9px] font-semibold text-white">
                {initialsOf(member.fullName)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        {rest > 0 ? <span className="ml-2 text-[11px] font-medium text-muted-foreground">+{rest} more</span> : null}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Teams"
        subtitle="Organize people into teams, assign leaders and connect events."
        actions={
          <Button onClick={openCreate} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Team
          </Button>
        }
      />

      {teams.length > 0 ? (
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams, descriptions, managers…"
              className="h-11 rounded-lg pl-9 pr-9"
              aria-label="Search teams"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as TeamSort)}>
            <SelectTrigger className="h-11 w-full sm:w-48" aria-label="Sort teams">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TEAM_SORT_LABELS) as TeamSort[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {TEAM_SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="hidden text-xs font-medium text-muted-foreground md:block md:ml-auto" aria-live="polite">
            {filteredTeams.length} of {teams.length} team{teams.length === 1 ? '' : 's'}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No teams yet"
          hint="Create your first team to start coordinating people and events."
          action={
            <Button onClick={openCreate} className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Team
            </Button>
          }
        />
      ) : filteredTeams.length === 0 ? (
        <EmptyState
          icon={Search}
          title={`No teams match “${query.trim()}”`}
          hint="Try a different name, manager, or clear the search to see every team."
          action={
            <Button variant="outline" onClick={() => setQuery('')} className="min-h-11">
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTeams.map((team, index) => {
            const manager = team.manager ?? null
            const events = team.events ?? []
            return (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3), ease: 'easeOut' }}
              >
                <Card
                  className="h-full cursor-pointer gap-3 py-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => setDetailId(team.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDetailId(team.id)
                    }
                  }}
                  aria-label={`Open details for ${team.name}`}
                >
                  <CardContent className="flex h-full flex-col px-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <UsersRound className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-foreground">{team.name}</h3>
                        <p className="line-clamp-2 min-h-8 text-sm text-muted-foreground">
                          {team.description ?? 'No description'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {team.memberCount ?? 0} members
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {team.eventCount ?? 0} events
                      </span>
                    </div>

                    <Separator className="my-3" />

                    {manager ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-emerald-600 text-[10px] font-semibold text-white">
                            {initialsOf(manager.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{manager.fullName}</span> · manager
                        </span>
                        <Badge variant="outline" className={cn('ml-auto shrink-0 text-[10px]', ROLE_BADGE_CLASSES.TEAM_LEADER)}>
                          Team Leader
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-xs italic text-muted-foreground/70">No manager assigned</p>
                    )}

                    <div className="mt-3">{memberStack(team)}</div>

                    {events.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {events.slice(0, 3).map((event: EventDTO) => (
                          <li key={event.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                              <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                              <span className="truncate">{event.name}</span>
                            </span>
                            <StatusBadge
                              label={EVENT_STATUS_LABELS[event.status] ?? event.status}
                              className={cn('shrink-0 text-[10px]', EVENT_STATUS_CLASSES[event.status])}
                            />
                          </li>
                        ))}
                        {events.length > 3 ? (
                          <li className="text-[11px] text-muted-foreground/70">+{events.length - 3} more events</li>
                        ) : null}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ============ Create dialog ============ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>Name the team, pick a leader and add members.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4" noValidate>
            {formError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="team-name">Name</Label>
              <Input
                id="team-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Operations"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is this team responsible for?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-manager">Manager</Label>
              <Select value={form.managerId} onValueChange={(value) => setForm((f) => ({ ...f, managerId: value }))}>
                <SelectTrigger id="team-manager" className="h-11 w-full" aria-label="Manager">
                  <SelectValue placeholder="Choose a manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>No manager</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName} ({ROLE_LABELS[user.role] ?? user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Members</Label>
              <div className="scrollbar-thin max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {users.length === 0 ? (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground/70">No users available yet.</p>
                ) : (
                  users.map((user) => (
                    <label
                      key={user.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={form.memberIds.includes(user.id)}
                        onCheckedChange={() => toggleMember(user.id)}
                        aria-label={`Add ${user.fullName} as member`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{user.fullName}</span>
                      <Badge variant="outline" className={cn('shrink-0 text-[10px]', ROLE_BADGE_CLASSES[user.role])}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground/70">{form.memberIds.length} member(s) selected</p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
                {saving ? 'Creating…' : 'Create team'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ Detail dialog ============ */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {detailLoading || !detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">Team details</DialogTitle>
                <DialogDescription>Loading team information…</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Skeleton className="h-7 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <UsersRound className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg">{detail.name}</DialogTitle>
                    <DialogDescription>
                      {detail.memberCount ?? detail.members?.length ?? 0} members · {detail.eventCount ?? detail.events?.length ?? 0} events
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {!editing ? (
                <div className="space-y-4">
                  {detail.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
                  ) : null}

                  {/* Task stats (Phase 3 TeamStats) */}
                  {detail.stats ? (
                    <section
                      aria-label="Team task stats"
                      className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-transparent to-transparent p-3.5 dark:border-emerald-500/20 dark:from-emerald-500/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Task progress
                        </p>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                            detail.stats.completionRate >= 75
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : detail.stats.completionRate > 0
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {detail.stats.completionRate}% complete
                        </span>
                      </div>
                      <div
                        className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={detail.stats.completionRate}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Task completion rate: ${detail.stats.completionRate}%`}
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-700 ease-out"
                          style={{ width: `${detail.stats.completionRate}%` }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-border bg-card px-2.5 py-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                            Tasks
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{detail.stats.totalTasks}</p>
                        </div>
                        <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-2.5 py-2 dark:border-amber-500/20 dark:bg-amber-500/5">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Active
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{detail.stats.inProgressTasks}</p>
                        </div>
                        <div className="rounded-lg border border-red-200/70 bg-red-50/60 px-2.5 py-2 dark:border-red-500/20 dark:bg-red-500/5">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-300">
                            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                            Blocked
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{detail.stats.blockedTasks}</p>
                        </div>
                        <div className="rounded-lg border border-red-200/70 bg-red-50/60 px-2.5 py-2 dark:border-red-500/20 dark:bg-red-500/5">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-300">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            Overdue
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{detail.stats.overdueTasks}</p>
                        </div>
                      </div>
                      {detail.stats.completedTasks > 0 ? (
                        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                          <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          {detail.stats.completedTasks} of {detail.stats.totalTasks} task
                          {detail.stats.totalTasks === 1 ? '' : 's'} completed
                        </p>
                      ) : null}
                    </section>
                  ) : null}

                  {/* Members */}
                  <section aria-label="Team members">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Members
                        <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/70">
                          ({(detail.members ?? []).length})
                        </span>
                      </p>
                      {canManage && !editing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/25 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                          onClick={() => {
                            setAddQuery('')
                            setAddOpen(true)
                          }}
                        >
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Add member
                        </Button>
                      ) : null}
                    </div>
                    <ul className="scrollbar-thin max-h-52 space-y-1 overflow-y-auto pr-1">
                      {(detail.members ?? []).length === 0 ? (
                        <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground/70">
                          No members yet.
                          {canManage ? ' Use “Add member” to invite the first one.' : ''}
                        </li>
                      ) : (
                        (detail.members ?? []).map((member) => (
                          <li
                            key={member.id}
                            className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-teal-600 text-[10px] font-semibold text-white">
                                {initialsOf(member.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{member.fullName}</p>
                              <p className="truncate text-xs text-muted-foreground/70">{member.email}</p>
                            </div>
                            <Badge variant="outline" className={cn('shrink-0 text-[10px]', ROLE_BADGE_CLASSES[member.role ?? ''])}>
                              {ROLE_LABELS[member.role ?? ''] ?? member.role ?? 'Member'}
                            </Badge>
                            {detail.managerId === member.id ? (
                              <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                                Manager
                              </Badge>
                            ) : null}
                            {canManage && !editing ? (
                              <button
                                type="button"
                                onClick={() => void removeMember(member.id, member.fullName)}
                                disabled={memberBusy === member.id}
                                className="ml-0.5 shrink-0 rounded-full p-1.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait dark:hover:bg-red-500/10 dark:hover:text-red-300"
                                aria-label={`Remove ${member.fullName} from ${detail.name}`}
                              >
                                {memberBusy === member.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                              </button>
                            ) : null}
                          </li>
                        ))
                      )}
                    </ul>
                  </section>

                  {/* Events */}
                  <section aria-label="Team events">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Events</p>
                    <ul className="space-y-1.5">
                      {(detail.events ?? []).length === 0 ? (
                        <li className="text-sm text-muted-foreground/70">No events assigned to this team.</li>
                      ) : (
                        (detail.events ?? []).map((event) => (
                          <li key={event.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">{event.name}</span>
                              <span className="text-xs text-muted-foreground/70">
                                {format(new Date(event.startDate), 'MMM d')} – {format(new Date(event.endDate), 'MMM d, yyyy')}
                              </span>
                            </span>
                            <StatusBadge
                              label={EVENT_STATUS_LABELS[event.status] ?? event.status}
                              className={cn('shrink-0 text-[10px]', EVENT_STATUS_CLASSES[event.status])}
                            />
                          </li>
                        ))
                      )}
                    </ul>
                  </section>
                </div>
              ) : (
                /* Edit mode */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-team-name">Name</Label>
                    <Input
                      id="edit-team-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-team-description">Description</Label>
                    <Textarea
                      id="edit-team-description"
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-team-manager">Manager</Label>
                    <Select value={editForm.managerId} onValueChange={(value) => setEditForm((f) => ({ ...f, managerId: value }))}>
                      <SelectTrigger id="edit-team-manager" className="h-10 w-full" aria-label="Manager">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_MANAGER}>No manager</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName} ({ROLE_LABELS[user.role] ?? user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Members</Label>
                    <div className="scrollbar-thin max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                      {users.map((user) => (
                        <label key={user.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent/50">
                          <Checkbox
                            checked={editForm.memberIds.includes(user.id)}
                            onCheckedChange={() =>
                              setEditForm((f) => ({
                                ...f,
                                memberIds: f.memberIds.includes(user.id)
                                  ? f.memberIds.filter((id) => id !== user.id)
                                  : [...f.memberIds, user.id],
                              }))
                            }
                            aria-label={`Toggle ${user.fullName}`}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{user.fullName}</span>
                          <Badge variant="outline" className={cn('shrink-0 text-[10px]', ROLE_BADGE_CLASSES[user.role])}>
                            {ROLE_LABELS[user.role] ?? user.role}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 border-t border-border/60 pt-3 sm:justify-between">
                {canManage ? (
                  <>
                    <Button
                      variant="outline"
                      className="min-h-11 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-700"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                    {editing ? (
                      <div className="flex gap-2">
                        <Button variant="ghost" className="min-h-11" onClick={() => setEditing(false)}>
                          Cancel
                        </Button>
                        <Button onClick={() => void handleEditSave()} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700" disabled={editSaving}>
                          {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
                          {editSaving ? 'Saving…' : 'Save changes'}
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={startEdit} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
                        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                        Edit team
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="mx-auto text-xs text-muted-foreground/70">
                    Only event managers can edit or delete teams.
                  </p>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ Delete confirm ============ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this team?</AlertDialogTitle>
            <AlertDialogDescription>
              “{detail?.name}” will be permanently removed. Members stay in the workspace but lose their team
              affiliation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(detail?.events?.length ?? 0) > 0 ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/25 dark:bg-amber-500/10" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This team owns{' '}
                <strong>
                  {detail?.events?.length} event{(detail?.events?.length ?? 0) === 1 ? '' : 's'}
                </strong>
                {detail?.stats?.totalTasks ? (
                  <>
                    {' '}
                    and <strong>{detail.stats.totalTasks} task{detail.stats.totalTasks === 1 ? '' : 's'}</strong>
                  </>
                ) : null}
                . Deleting the team also deletes them — move events to another team first if you want to keep them.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                No events are assigned to this team — nothing else will be removed.
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              className="min-h-11 bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />}
              {deleting ? 'Deleting…' : 'Delete team'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ============ Add member dialog (quick, manager-only) ============ */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) setAddQuery('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add members to “{detail?.name}”</DialogTitle>
            <DialogDescription>Pick a person to add them instantly. They keep all other team memberships.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden="true"
            />
            <Input
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="h-10 rounded-lg pl-9"
              aria-label="Search users to add"
            />
          </div>
          <ul className="scrollbar-thin max-h-64 space-y-1 overflow-y-auto" aria-label="Users available to add">
            {availableUsers.length === 0 ? (
              <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground/70">
                {users.length === 0 ? 'No users available yet.' : 'Everyone is already on this team.'}
              </li>
            ) : (
              availableUsers.map((user) => (
                <li key={user.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-emerald-600 text-[10px] font-semibold text-white">
                      {initialsOf(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{user.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground/70">{user.email}</p>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 text-[10px]', ROLE_BADGE_CLASSES[user.role])}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/25 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                    disabled={memberBusy === user.id}
                    onClick={() => void addMember(user.id)}
                    aria-label={`Add ${user.fullName} to ${detail?.name}`}
                  >
                    {memberBusy === user.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Add
                  </Button>
                </li>
              ))
            )}
          </ul>
          <p className="text-xs text-muted-foreground/70">
            {availableUsers.length} user{availableUsers.length === 1 ? '' : 's'} available
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
