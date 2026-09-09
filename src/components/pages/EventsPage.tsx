'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  CalendarPlus,
  Loader2,
  Plus,
  Search,
  SquarePen,
  Trash2,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import type { EventDTO, EventStatus, TeamDTO } from '@/types'
import {
  EVENT_STATUSES,
  EVENT_STATUS_CLASSES,
  EVENT_STATUS_LABELS,
  ROUTES,
} from '@/lib/constants'
import { api, ApiClientError, qs } from '@/lib/api-client'
import { navigate } from '@/hooks/use-hash-route'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'

const NO_TEAM = '__no_team__'

interface EventsPageProps {
  searchPlaceholder?: string
}

interface EventFormState {
  name: string
  description: string
  startDate: string
  endDate: string
  teamId: string
  status: EventStatus
}

const EMPTY_FORM: EventFormState = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  teamId: '',
  status: 'PLANNING',
}

function formatRange(startISO: string, endISO: string): string {
  const start = new Date(startISO)
  const end = new Date(endISO)
  if (start.getFullYear() === end.getFullYear()) {
    if (format(start, 'MMM d, yyyy') === format(end, 'MMM d, yyyy')) return format(start, 'MMM d, yyyy')
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

export function EventsPage({ searchPlaceholder }: EventsPageProps) {
  const { toast } = useToast()

  const [events, setEvents] = useState<EventDTO[]>([])
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Detail dialog
  const [detail, setDetail] = useState<EventDTO | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<EventDTO | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadTeams = useCallback(async () => {
    try {
      const data = await api.get<{ teams: TeamDTO[] }>('/teams')
      setTeams(data.teams)
    } catch {
      // Team filter will just be empty.
    }
  }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ events: EventDTO[] }>(
        `/events${qs({ status: statusFilter === 'all' ? undefined : statusFilter, teamId: teamFilter === 'all' ? undefined : teamFilter, search: search.trim() || undefined })}`
      )
      setEvents(data.events)
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to load events.'
      toast({ title: 'Could not load events', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, teamFilter, search, toast])

  useEffect(() => {
    void loadTeams()
  }, [loadTeams])

  // Debounced fetch on filter changes.
  useEffect(() => {
    const timer = setTimeout(() => void loadEvents(), 250)
    return () => clearTimeout(timer)
  }, [loadEvents])

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>()
    teams.forEach((team) => map.set(team.id, team.name))
    return map
  }, [teams])

  const refreshAfterMutation = (updated: EventDTO) => {
    setEvents((list) => list.map((event) => (event.id === updated.id ? { ...event, ...updated } : event)))
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setCreateOpen(true)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!form.name.trim()) {
      setFormError('Please give the event a name.')
      return
    }
    if (!form.startDate || !form.endDate) {
      setFormError('Please pick both a start and end date.')
      return
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setFormError('The end date cannot be before the start date.')
      return
    }
    if (!form.teamId) {
      setFormError('Please choose a team responsible for this event.')
      return
    }

    setSaving(true)
    try {
      const data = await api.post<{ event: EventDTO }>('/events', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        startDate: new Date(`${form.startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${form.endDate}T23:59:59`).toISOString(),
        teamId: form.teamId,
        status: form.status,
      })
      setCreateOpen(false)
      toast({ title: 'Event created', description: `“${data.event.name}” is ready to plan.` })
      void loadEvents()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to create the event.'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDetailStatusChange = async (next: EventStatus) => {
    if (!detail) return
    const previous = detail
    setStatusUpdating(true)
    setDetail({ ...detail, status: next })
    try {
      const data = await api.patch<{ event: EventDTO }>(`/events/${detail.id}`, { status: next })
      refreshAfterMutation(data.event)
      toast({ title: 'Status updated', description: `“${data.event.name}” is now ${EVENT_STATUS_LABELS[next] ?? next}.` })
    } catch (error) {
      setDetail(previous)
      const message = error instanceof ApiClientError ? error.message : 'Failed to update the status.'
      toast({ title: 'Update failed', description: message, variant: 'destructive' })
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.del(`/events/${deleteTarget.id}`)
      setEvents((list) => list.filter((event) => event.id !== deleteTarget.id))
      setDetail(null)
      setDeleteTarget(null)
      toast({ title: 'Event deleted', description: `“${deleteTarget.name}” has been removed.` })
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to delete the event.'
      toast({ title: 'Delete failed', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Plan, track and complete every event your teams run."
        actions={
          <Button onClick={openCreate} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Event
          </Button>
        }
      />

      {/* Filter bar */}
      <section className="mb-6 flex flex-col gap-3 sm:flex-row" aria-label="Event filters">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder ?? 'Search events by name or description…'}
            className="h-11 pl-9"
            aria-label="Search events"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-full sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {EVENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {EVENT_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="h-11 w-full sm:w-48" aria-label="Filter by team">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Events grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events found"
          hint="Try adjusting the filters, or create your first event to get planning."
          action={
            <Button onClick={openCreate} className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Event
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event, index) => {
            const total = event.taskStats?.total ?? event.taskCount ?? 0
            const completed = event.taskStats?.completed ?? 0
            const blocked = event.taskStats?.blocked ?? 0
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3), ease: 'easeOut' }}
              >
                <Card
                  className="h-full cursor-pointer gap-3 py-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => setDetail(event)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDetail(event)
                    }
                  }}
                  aria-label={`Open details for ${event.name}`}
                >
                  <CardContent className="flex h-full flex-col px-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-stone-900">{event.name}</h3>
                      <StatusBadge label={EVENT_STATUS_LABELS[event.status] ?? event.status} className={EVENT_STATUS_CLASSES[event.status]} />
                    </div>

                    {event.description ? (
                      <p className="mt-1.5 line-clamp-2 min-h-10 text-sm text-stone-500">{event.description}</p>
                    ) : (
                      <p className="mt-1.5 min-h-10 text-sm italic text-stone-400">No description</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-2 py-1 font-medium text-stone-700">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatRange(event.startDate, event.endDate)}
                      </span>
                      {event.team ? (
                        <Badge variant="outline" className="border-stone-200 bg-stone-50 font-normal text-stone-600">
                          <Users className="mr-1 h-3 w-3" aria-hidden="true" />
                          {teamNameById.get(event.team.id) ?? event.team.name}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <span>
                          <span className="font-semibold text-stone-700">{completed}</span> of{' '}
                          <span className="font-semibold text-stone-700">{total}</span> tasks done
                        </span>
                        <span>{percent}%</span>
                      </div>
                      <Progress value={percent} className="mt-1.5 h-1.5" aria-label={`${percent}% of tasks completed`} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="border-stone-200 bg-white text-[11px] font-normal text-stone-600">
                        {total} tasks
                      </Badge>
                      {blocked > 0 ? (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] font-normal text-red-700">
                          {blocked} blocked
                        </Badge>
                      ) : null}
                      {event.creator ? (
                        <span className="ml-auto text-[11px] text-stone-400">by {event.creator.fullName}</span>
                      ) : null}
                    </div>
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
            <DialogTitle>Create a new event</DialogTitle>
            <DialogDescription>Give the event a name, dates and the team that owns it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4" noValidate>
            {formError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="event-name">Name</Label>
              <Input
                id="event-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Launch Night Gala"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is this event about?"
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-start">Start date</Label>
                <Input
                  id="event-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">End date</Label>
                <Input
                  id="event-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="h-11"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-team">Team</Label>
                <Select
                  value={form.teamId || NO_TEAM}
                  onValueChange={(value) => setForm((f) => ({ ...f, teamId: value === NO_TEAM ? '' : value }))}
                >
                  <SelectTrigger id="event-team" className="h-11 w-full" aria-label="Team">
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM} disabled className="text-stone-400">
                      Choose a team…
                    </SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value as EventStatus }))}>
                  <SelectTrigger id="event-status" className="h-11 w-full" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {EVENT_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />}
                {saving ? 'Creating…' : 'Create event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ Detail dialog ============ */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-lg">{detail.name}</DialogTitle>
                  <StatusBadge label={EVENT_STATUS_LABELS[detail.status] ?? detail.status} className={EVENT_STATUS_CLASSES[detail.status]} />
                </div>
                <DialogDescription>
                  {formatRange(detail.startDate, detail.endDate)}
                  {detail.team ? ` · ${teamNameById.get(detail.team.id) ?? detail.team.name}` : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {detail.description ? (
                  <p className="text-sm leading-relaxed text-stone-600">{detail.description}</p>
                ) : null}

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Tasks', value: detail.taskStats?.total ?? detail.taskCount ?? 0, classes: 'bg-stone-50 text-stone-700' },
                    { label: 'Completed', value: detail.taskStats?.completed ?? 0, classes: 'bg-emerald-50 text-emerald-700' },
                    { label: 'Blocked', value: detail.taskStats?.blocked ?? 0, classes: 'bg-red-50 text-red-600' },
                  ].map((chip) => (
                    <div key={chip.label} className={cn('rounded-lg px-3 py-2', chip.classes)}>
                      <p className="text-lg font-bold leading-none">{chip.value}</p>
                      <p className="mt-1 text-[11px] font-medium">{chip.label}</p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="detail-status" className="text-sm text-stone-600">
                    Status
                  </Label>
                  <Select value={detail.status} onValueChange={(value) => void handleDetailStatusChange(value as EventStatus)} disabled={statusUpdating}>
                    <SelectTrigger id="detail-status" className="h-10 w-44" aria-label="Change event status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {EVENT_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {statusUpdating ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" aria-hidden="true" /> : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
                  <span>Created {detail.creator ? `by ${detail.creator.fullName}` : ''} · {format(new Date(detail.createdAt), 'MMM d, yyyy')}</span>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2 sm:justify-between">
                <Button
                  variant="outline"
                  className="min-h-11 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setDeleteTarget(detail)}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
                <Button
                  className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    setDetail(null)
                    navigate(`${ROUTES.TASKS}?event=${detail.id}`)
                  }}
                >
                  <SquarePen className="mr-2 h-4 w-4" aria-hidden="true" />
                  View tasks
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ============ Delete confirm ============ */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” and its related tasks will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
              {deleting ? 'Deleting…' : 'Delete event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
