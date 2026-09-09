'use client'

/**
 * Calendar — month grid of task due dates + event spans.
 * Server-month query (`/api/calendar?month=YYYY-MM`), client-side day grouping.
 * Click a day (or a chip) for the day agenda; quick status changes are
 * optimistic with server-side permission enforcement.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarArrowDown,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Move,
  RefreshCw,
} from 'lucide-react'
import { format, isSameMonth, isToday } from 'date-fns'
import type { CalendarResponseDTO, TaskDTO, TeamDTO } from '@/types'
import { EVENT_STATUS_CLASSES, EVENT_STATUS_LABELS, PRIORITY_CLASSES, PRIORITY_LABELS, ROUTES, TASK_STATUSES, TASK_STATUS_LABELS } from '@/lib/constants'
import { api, ApiClientError, qs } from '@/lib/api-client'
import { buildIcs, downloadIcs } from '@/lib/ics'
import { navigate } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Max chips shown in a day cell before "+N more". */
const MAX_CHIPS = 3

const STATUS_DOT_CLASSES: Record<string, string> = {
  NOT_STARTED: 'bg-stone-400 dark:bg-stone-500',
  IN_PROGRESS: 'bg-amber-500',
  BLOCKED: 'bg-red-500',
  COMPLETED: 'bg-emerald-500',
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Monday-start offset of the 1st of the given month. */
function firstWeekdayOffset(year: number, monthIndex: number): number {
  return (new Date(year, monthIndex, 1).getDay() + 6) % 7
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return monthKeyOf(d)
}

/**
 * Who may drag-reschedule a task: the assignee, the creator, event managers,
 * or the owning team's leader — mirrors the server's edit rules (dates are a
 * full-manage field, so the server has the final word on 403s).
 */
function canEditTask(
  task: Pick<TaskDTO, 'assignedTo' | 'createdBy' | 'event'>,
  user: { id: string; role: string; teamId: string | null } | null
): boolean {
  if (!user) return false
  if (user.role === 'EVENT_MANAGER') return true
  if (task.assignedTo === user.id) return true
  if (task.createdBy === user.id) return true
  return user.role === 'TEAM_LEADER' && user.teamId !== null && task.event?.teamId === user.teamId
}

export function CalendarPage() {
  const { toast } = useToast()

  const initialMonthRaw = typeof window !== 'undefined' ? window.location.hash : ''
  const initialMonth = useMemo(() => {
    const match = /[?&]month=(\d{4}-\d{2})/.exec(initialMonthRaw)
    return match ? match[1] : monthKeyOf(new Date())
  }, [initialMonthRaw])

  const [monthKey, setMonthKey] = useState(initialMonth)
  const [direction, setDirection] = useState(0)
  const [data, setData] = useState<CalendarResponseDTO | null>(null)
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [teamFilter, setTeamFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'me' | 'unassigned'>('all')
  const [agendaDate, setAgendaDate] = useState<Date | null>(null)

  // Drag-to-reschedule: the chip being dragged + the cell currently hovered.
  const user = useAuthStore((s) => s.user)
  const dragTaskRef = useRef<TaskDTO | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const loadRef = useRef<AbortController | null>(null)

  // Keep the hash query in sync so months are deep-linkable.
  // Skips rewriting when the user has already navigated to another page.
  useEffect(() => {
    const currentPath = window.location.hash.replace(/^#/, '').split('?')[0] || ROUTES.CALENDAR
    if (currentPath !== ROUTES.CALENDAR) return
    if (!window.location.hash.includes(`month=${monthKey}`)) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${ROUTES.CALENDAR}?month=${monthKey}`)
    }
  }, [monthKey])

  const load = useCallback(async () => {
    loadRef.current?.abort()
    const controller = new AbortController()
    loadRef.current = controller
    setLoading(true)
    try {
      const query = qs({ month: monthKey, teamId: teamFilter !== 'all' ? teamFilter : undefined, assignedTo: assigneeFilter !== 'all' ? assigneeFilter : undefined })
      const result = await api.get<CalendarResponseDTO>(`/calendar${query}`, controller.signal)
      setData(result)
      setError(null)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof ApiClientError ? err.message : 'Failed to load the calendar.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [monthKey, teamFilter, assigneeFilter])

  useEffect(() => {
    void load()
    return () => loadRef.current?.abort()
  }, [load])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const teamsData = await api.get<{ teams: TeamDTO[] }>('/teams')
        if (!cancelled) setTeams(teamsData.teams)
      } catch {
        // Non-fatal — the team filter simply stays empty.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- grid math ----------------------------------------------------------
  const [year, monthIndex] = useMemo(() => monthKey.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)), [monthKey])

  const gridDays = useMemo<Date[]>(() => {
    const offset = firstWeekdayOffset(year, monthIndex)
    return Array.from({ length: 42 }, (_, i) => new Date(year, monthIndex, 1 - offset + i))
  }, [year, monthIndex])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDTO[]>()
    for (const task of data?.tasks ?? []) {
      if (!task.dueDate) continue
      const key = dayKeyOf(new Date(task.dueDate))
      const list = map.get(key) ?? []
      list.push(task)
      map.set(key, list)
    }
    // Sort within a day: blocked → in-progress → not-started → completed, then priority.
    const rank: Record<string, number> = { BLOCKED: 0, IN_PROGRESS: 1, NOT_STARTED: 2, COMPLETED: 3 }
    for (const list of map.values()) {
      list.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))
    }
    return map
  }, [data])

  /** Events anchored on a given day = starts that day, or ongoing when the day is the grid start. */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarResponseDTO['events']>()
    const gridStart = gridDays[0]
    for (const event of data?.events ?? []) {
      const start = new Date(event.startDate)
      const anchor = start < gridStart && gridStart <= new Date(event.endDate) ? gridStart : start
      const key = dayKeyOf(anchor)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [data, gridDays])

  const summary = data?.summary ?? { dueTasks: 0, completed: 0, overdue: 0, events: 0 }

  const quickStatusChange = useCallback(
    async (task: TaskDTO, status: string) => {
      const previous = data
      setData((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((t) => (t.id === task.id ? { ...t, status: status as TaskDTO['status'] } : t)),
            }
          : current
      )
      try {
        await api.patch(`/tasks/${task.id}`, { status })
        toast({ title: `Moved to ${TASK_STATUS_LABELS[status] ?? status}`, description: task.title })
      } catch (err) {
        setData(previous)
        toast({
          title: 'Could not update task',
          description: err instanceof ApiClientError ? err.message : 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [data, toast]
  )

  const monthLabel = format(new Date(year, monthIndex, 1), 'MMMM yyyy')
  const todayKey = dayKeyOf(new Date())

  // ---- drag-to-reschedule -------------------------------------------------
  const handleDragStart = useCallback(
    (task: TaskDTO) => (event: React.DragEvent) => {
      dragTaskRef.current = task
      setDraggingTaskId(task.id)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', task.id)
    },
    []
  )

  const handleDragEnd = useCallback(() => {
    dragTaskRef.current = null
    setDraggingTaskId(null)
    setDragOverKey(null)
  }, [])

  const handleCellDragOver = useCallback(
    (key: string) => (event: React.DragEvent) => {
      if (!dragTaskRef.current) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (dragOverKey !== key) setDragOverKey(key)
    },
    [dragOverKey]
  )

  const rescheduleTask = useCallback(
    async (task: TaskDTO, day: Date) => {
      const currentKey = task.dueDate ? dayKeyOf(new Date(task.dueDate)) : null
      const targetKey = dayKeyOf(day)
      dragTaskRef.current = null
      setDraggingTaskId(null)
      setDragOverKey(null)
      if (currentKey === targetKey) return

      const previous = data
      // Keep the original time-of-day; default to noon for tasks without a due date.
      const base = task.dueDate ? new Date(task.dueDate) : null
      const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base?.getHours() ?? 12, base?.getMinutes() ?? 0)
      setData((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((t) => (t.id === task.id ? { ...t, dueDate: next.toISOString() } : t)),
            }
          : current
      )
      try {
        await api.patch(`/tasks/${task.id}`, { dueDate: next.toISOString() })
        toast({ title: 'Task rescheduled', description: `“${task.title}” is now due ${format(day, 'MMM d')}.` })
      } catch (err) {
        setData(previous)
        toast({
          title: 'Could not reschedule',
          description: err instanceof ApiClientError ? err.message : 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [data, toast]
  )

  const handleExportIcs = () => {
    const events = data?.events ?? []
    if (events.length === 0) {
      toast({ title: 'Nothing to export', description: `No events overlap ${monthLabel}.` })
      return
    }
    const ics = buildIcs(
      events.map((event) => ({
        uid: event.id,
        title: event.name,
        description: event.description,
        location: event.location,
        start: event.startDate,
        end: event.endDate,
        status: event.status === 'CANCELLED' ? 'CANCELLED' : event.status === 'DRAFT' ? 'TENTATIVE' : 'CONFIRMED',
        url: `${window.location.origin}/#/events/${event.id}`,
      })),
      `EventFlow — ${monthLabel}`
    )
    downloadIcs(`eventflow-${monthKey}.ics`, ics)
    toast({ title: 'Calendar exported', description: `${events.length} event(s) exported for ${monthLabel}.` })
  }

  const goMonth = (delta: number) => {
    setDirection(delta)
    setMonthKey((key) => shiftMonth(key, delta))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar"
        subtitle="Every deadline and event on one month grid."
        className="mb-0"
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-11">
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setDirection(monthKey < monthKeyOf(new Date()) ? 1 : -1)
                setMonthKey(monthKeyOf(new Date()))
              }}
            >
              Today
            </Button>
            <Button variant="outline" onClick={handleExportIcs} disabled={!data || data.events.length === 0} className="min-h-11">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export .ics
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <Card className="py-0">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Previous month" onClick={() => goMonth(-1)}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={monthKey}
                initial={{ opacity: 0, y: direction * -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction * 8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="min-w-44 text-center text-lg font-bold tracking-tight text-foreground"
                aria-live="polite"
              >
                {monthLabel}
              </motion.h2>
            </AnimatePresence>
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Next month" onClick={() => goMonth(1)}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>

          {/* Month summary chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-border bg-muted/50 text-xs text-muted-foreground">
              {summary.dueTasks} task{summary.dueTasks === 1 ? '' : 's'} due
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
              {summary.completed} completed
            </Badge>
            <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {summary.overdue} overdue
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
              {summary.events} event{summary.events === 1 ? '' : 's'}
            </Badge>
          </div>

          <div className="flex gap-2 lg:ml-auto">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Filter by team">
                <SelectValue />
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
            <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v as typeof assigneeFilter)}>
              <SelectTrigger className="h-10 w-full sm:w-40" aria-label="Filter by assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="me">My tasks</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
        {TASK_STATUSES.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', STATUS_DOT_CLASSES[status])} aria-hidden="true" />
            {TASK_STATUS_LABELS[status]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-500/20" aria-hidden="true" />
          Event span
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Move className="h-3 w-3" aria-hidden="true" />
          Drag a chip to another day to reschedule
        </span>
      </div>

      {error ? (
        <EmptyState
          icon={CalendarDays}
          title="Could not load the calendar"
          hint={error}
          action={
            <Button onClick={() => void load()} className="bg-emerald-600 text-white hover:bg-emerald-700">
              Try again
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0 sm:p-2">
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-border max-sm:hidden">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>

            {loading && !data ? (
              <div className="grid grid-cols-7 gap-px p-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-md" />
                ))}
              </div>
            ) : (
              <div className="relative">
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <motion.div
                    key={monthKey}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 48 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -48 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="grid grid-cols-7 gap-px bg-border sm:gap-px"
                    role="grid"
                    aria-label={`Calendar for ${monthLabel}`}
                  >
                    {gridDays.map((day) => {
                      const key = dayKeyOf(day)
                      const inMonth = isSameMonth(day, new Date(year, monthIndex, 1))
                      const tasks = tasksByDay.get(key) ?? []
                      const dayEvents = eventsByDay.get(key) ?? []
                      const weekend = day.getDay() === 0 || day.getDay() === 6
                      const openCount = tasks.filter((t) => t.status !== 'COMPLETED').length
                      const isDropTarget = dragOverKey === key && draggingTaskId !== null
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAgendaDate(day)}
                          role="gridcell"
                          aria-label={`${format(day, 'EEEE, MMMM d')}${tasks.length ? `, ${tasks.length} task${tasks.length === 1 ? '' : 's'} due` : ''}`}
                          onDragOver={handleCellDragOver(key)}
                          onDragLeave={() => setDragOverKey((current) => (current === key ? null : current))}
                          onDrop={(event) => {
                            event.preventDefault()
                            const task = dragTaskRef.current
                            if (task) void rescheduleTask(task, day)
                          }}
                          className={cn(
                            'group relative flex min-h-16 flex-col gap-1 p-1.5 text-left transition-all focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-emerald-600 sm:min-h-28 sm:p-2',
                            inMonth ? 'bg-card' : 'bg-muted/40',
                            weekend && inMonth && 'bg-muted/25',
                            'hover:bg-accent/50',
                            isDropTarget &&
                              'z-10 scale-[1.03] bg-emerald-50 ring-2 ring-inset ring-emerald-500 dark:bg-emerald-500/15'
                          )}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                                isToday(day)
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : inMonth
                                    ? 'text-foreground'
                                    : 'text-muted-foreground/50'
                              )}
                            >
                              {format(day, 'd')}
                            </span>
                            {openCount > 0 ? (
                              <span
                                className={cn(
                                  'text-[10px] font-bold',
                                  tasks.some((t) => t.status === 'BLOCKED')
                                    ? 'text-red-600 dark:text-red-300'
                                    : 'text-muted-foreground/70'
                                )}
                              >
                                {openCount}
                              </span>
                            ) : null}
                          </span>

                          {/* Event spans */}
                          <span className="max-sm:hidden">
                            {dayEvents.slice(0, 1).map((event) => (
                              <span
                                key={event.id}
                                className="mb-0.5 flex items-center gap-1 truncate rounded-sm border border-emerald-300 bg-emerald-500/10 px-1 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-300"
                                title={event.name}
                              >
                                <CalendarRange className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{event.name}</span>
                              </span>
                            ))}
                            {dayEvents.length > 1 ? (
                              <span className="block text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                +{dayEvents.length - 1} event{dayEvents.length - 1 === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </span>

                          {/* Task chips */}
                          <span className="space-y-0.5 max-sm:hidden">
                            {tasks.slice(0, MAX_CHIPS).map((task) => {
                              const overdue = task.status !== 'COMPLETED' && task.dueDate !== null && new Date(task.dueDate) < new Date()
                              const editable = canEditTask(task, user)
                              return (
                                <span
                                  key={task.id}
                                  draggable={editable}
                                  onDragStart={editable ? handleDragStart(task) : undefined}
                                  onDragEnd={editable ? handleDragEnd : undefined}
                                  className={cn(
                                    'flex items-center gap-1 truncate rounded-sm border-l-2 bg-muted/60 px-1 py-0.5 text-[10px] leading-tight transition-colors group-hover:bg-muted',
                                    overdue && 'bg-red-50 dark:bg-red-500/10',
                                    editable && 'cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-emerald-400/60',
                                    draggingTaskId === task.id && 'opacity-40'
                                  )}
                                  title={`${task.title} · ${TASK_STATUS_LABELS[task.status]}${editable ? ' · drag to reschedule' : ''}`}
                                >
                                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_CLASSES[task.status])} aria-hidden="true" />
                                  <span className={cn('truncate', task.status === 'COMPLETED' ? 'text-muted-foreground line-through' : 'text-foreground/90')}>
                                    {task.title}
                                  </span>
                                </span>
                              )
                            })}
                            {tasks.length > MAX_CHIPS ? (
                              <span className="block pl-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                +{tasks.length - MAX_CHIPS} more
                              </span>
                            ) : null}
                          </span>

                          {/* Mobile: status dots only */}
                          <span className="flex flex-wrap gap-0.5 sm:hidden">
                            {tasks.slice(0, 4).map((task) => (
                              <span key={task.id} className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_CLASSES[task.status])} aria-hidden="true" />
                            ))}
                            {tasks.length > 4 ? <span className="text-[9px] font-bold text-muted-foreground">+{tasks.length - 4}</span> : null}
                          </span>
                        </button>
                      )
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Day agenda */}
      <AgendaDialog
        date={agendaDate}
        tasks={agendaDate ? tasksByDay.get(dayKeyOf(agendaDate)) ?? [] : []}
        events={agendaDate ? eventsByDay.get(dayKeyOf(agendaDate)) ?? [] : []}
        loading={loading}
        onClose={() => setAgendaDate(null)}
        onStatusChange={(task, status) => void quickStatusChange(task, status)}
        onReschedule={(task, day) => void rescheduleTask(task, day)}
        canEditTask={(task) => canEditTask(task, user)}
        onOpenEvent={(id) => {
          setAgendaDate(null)
          navigate(`${ROUTES.EVENTS}/${id}`)
        }}
        todayKey={todayKey}
      />
    </div>
  )
}

// ============ Day agenda dialog ============

interface AgendaDialogProps {
  date: Date | null
  tasks: TaskDTO[]
  events: CalendarResponseDTO['events']
  loading: boolean
  onClose: () => void
  onStatusChange: (task: TaskDTO, status: string) => void
  /** Move a task's due date to another day (optimistic, server-enforced). */
  onReschedule: (task: TaskDTO, day: Date) => void
  /** Whether the signed-in user may edit this task's dates. */
  canEditTask: (task: TaskDTO) => boolean
  onOpenEvent: (eventId: string) => void
  todayKey: string
}

function AgendaDialog({ date, tasks, events, loading, onClose, onStatusChange, onReschedule, canEditTask, onOpenEvent }: AgendaDialogProps) {
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            {date ? format(date, 'EEEE, MMMM d') : ''}
            {date && isToday(date) ? (
              <Badge className="bg-emerald-600 text-white">Today</Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {tasks.length === 0 && events.length === 0
              ? 'Nothing scheduled for this day.'
              : `${tasks.length} task${tasks.length === 1 ? '' : 's'} due · ${events.length} event${events.length === 1 ? '' : 's'}`}
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {events.length > 0 ? (
            <section aria-label="Events on this day">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Events</p>
              <ul className="space-y-1.5">
                {events.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => onOpenEvent(event.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <CalendarRange className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{event.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {format(new Date(event.startDate), 'MMM d')} – {format(new Date(event.endDate), 'MMM d')}
                          {event.team ? ` · ${event.team.name}` : ''}
                        </span>
                      </span>
                      <Badge variant="outline" className={cn('shrink-0 text-[10px]', EVENT_STATUS_CLASSES[event.status] ?? '')}>
                        {EVENT_STATUS_LABELS[event.status] ?? event.status}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tasks.length > 0 ? (
            <section aria-label="Tasks due this day">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tasks due</p>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: Math.min(tasks.length, 3) }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((task) => {
                    const editable = canEditTask(task)
                    return (
                      <li key={task.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start gap-2.5">
                          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_DOT_CLASSES[task.status])} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className={cn('truncate text-sm font-semibold text-foreground', task.status === 'COMPLETED' && 'text-muted-foreground line-through')}>
                              {task.title}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="max-w-40 truncate">{task.event?.name ?? 'Unknown event'}</span>
                              <span>·</span>
                              <span>{task.assignee?.fullName ?? 'Unassigned'}</span>
                              <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', PRIORITY_CLASSES[task.priority])}>
                                {PRIORITY_LABELS[task.priority]}
                              </Badge>
                            </p>
                            {editable ? (
                              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <CalendarArrowDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                <span className="sr-only">Due date for {task.title}</span>
                                <input
                                  type="date"
                                  value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (!value) return
                                    const [y, m, d] = value.split('-').map(Number)
                                    onReschedule(task, new Date(y, m - 1, d, 12, 0))
                                  }}
                                  className="h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 [&::-webkit-calendar-picker-indicator]:cursor-pointer dark:[color-scheme:dark]"
                                  aria-label={`Reschedule ${task.title}`}
                                />
                              </label>
                            ) : null}
                          </div>
                          <Select value={task.status} onValueChange={(status) => onStatusChange(task, status)}>
                            <SelectTrigger
                              aria-label={`Status for ${task.title}`}
                              className="h-8 w-32 shrink-0 text-xs"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {TASK_STATUS_LABELS[status]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {tasks.length === 0 && events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-muted/60 px-6 py-8 text-center dark:border-stone-600">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">Clear day</p>
              <p className="text-xs text-muted-foreground">No tasks due and no events scheduled.</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
