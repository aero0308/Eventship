'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useHashRoute, navigate } from '@/hooks/use-hash-route'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  CalendarPlus,
  Download,
  Loader2,
  MapPin,
  Plus,
  Search,
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
import { downloadCsv, csvDateStamp } from '@/lib/csv'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  location: string
  startDate: string
  endDate: string
  teamId: string
  status: EventStatus
}

const EMPTY_FORM: EventFormState = {
  name: '',
  description: '',
  location: '',
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
  const path = useHashRoute()

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

  // ?new=1 hash query (e.g. from the command palette) auto-opens the create dialog.
  useEffect(() => {
    const query = path.split('?')[1] ?? ''
    if (new URLSearchParams(query).get('new') === '1') {
      setForm({ ...EMPTY_FORM })
      setFormError(null)
      setCreateOpen(true)
      navigate(ROUTES.EVENTS, true)
    }
  }, [path])

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
        location: form.location.trim() || undefined,
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

  const handleExport = () => {
    const rows: (string | number | null)[][] = [
      ['Name', 'Status', 'Team', 'Location', 'Start date', 'End date', 'Tasks', 'Completed', 'In progress', 'Blocked', 'Not started', 'Created by'],
      ...events.map((event) => [
        event.name,
        EVENT_STATUS_LABELS[event.status] ?? event.status,
        event.team?.name ?? teamNameById.get(event.teamId) ?? '',
        event.location ?? '',
        format(new Date(event.startDate), 'yyyy-MM-dd'),
        format(new Date(event.endDate), 'yyyy-MM-dd'),
        event.taskStats?.total ?? event.taskCount ?? 0,
        event.taskStats?.completed ?? 0,
        event.taskStats?.inProgress ?? 0,
        event.taskStats?.blocked ?? 0,
        event.taskStats?.notStarted ?? 0,
        event.creator?.fullName ?? '',
      ]),
    ]
    downloadCsv(`eventflow-events-${csvDateStamp()}`, rows)
    toast({ title: 'Export ready', description: `${events.length} event(s) exported to CSV.` })
  }

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Plan, track and complete every event your teams run."
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={events.length === 0} className="min-h-11">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button onClick={openCreate} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Event
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <section className="mb-6 flex flex-col gap-3 sm:flex-row" aria-label="Event filters">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden="true" />
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
                  onClick={() => navigate(`${ROUTES.EVENTS}/${event.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`${ROUTES.EVENTS}/${event.id}`)
                    }
                  }}
                  aria-label={`Open details for ${event.name}`}
                >
                  <CardContent className="flex h-full flex-col px-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{event.name}</h3>
                      <StatusBadge label={EVENT_STATUS_LABELS[event.status] ?? event.status} className={EVENT_STATUS_CLASSES[event.status]} />
                    </div>

                    {event.description ? (
                      <p className="mt-1.5 line-clamp-2 min-h-10 text-sm text-muted-foreground">{event.description}</p>
                    ) : (
                      <p className="mt-1.5 min-h-10 text-sm italic text-muted-foreground/70">No description</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatRange(event.startDate, event.endDate)}
                      </span>
                      {event.team ? (
                        <Badge variant="outline" className="border-border bg-muted/50 font-normal text-muted-foreground">
                          <Users className="mr-1 h-3 w-3" aria-hidden="true" />
                          {teamNameById.get(event.team.id) ?? event.team.name}
                        </Badge>
                      ) : null}
                    </div>

                    {event.location ? (
                      <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground" title={event.location}>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        <span className="truncate">{event.location}</span>
                      </p>
                    ) : null}

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          <span className="font-semibold text-foreground">{completed}</span> of{' '}
                          <span className="font-semibold text-foreground">{total}</span> tasks done
                        </span>
                        <span>{percent}%</span>
                      </div>
                      <Progress value={percent} className="mt-1.5 h-1.5" aria-label={`${percent}% of tasks completed`} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="border-border bg-card text-[11px] font-normal text-muted-foreground">
                        {total} tasks
                      </Badge>
                      {blocked > 0 ? (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] font-normal text-red-700">
                          {blocked} blocked
                        </Badge>
                      ) : null}
                      {event.creator ? (
                        <span className="ml-auto text-[11px] text-muted-foreground/70">by {event.creator.fullName}</span>
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

            <div className="space-y-2">
              <Label htmlFor="event-location" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Location
                <span className="text-xs font-normal text-muted-foreground">(optional — included in calendar exports)</span>
              </Label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Grand Hall downtown or a video link"
                className="h-11"
                maxLength={200}
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
                    <SelectItem value={NO_TEAM} disabled className="text-muted-foreground/70">
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

    </div>
  )
}
