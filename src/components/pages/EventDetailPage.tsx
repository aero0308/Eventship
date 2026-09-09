'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowDownUp,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import type { EventDTO, EventStatus, TaskDTO, TaskStatus, UserDTO } from '@/types'
import {
  EVENT_STATUSES,
  EVENT_STATUS_CLASSES,
  EVENT_STATUS_LABELS,
  TASK_PRIORITIES,
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  ROUTES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '@/lib/constants'
import { api, ApiClientError, qs } from '@/lib/api-client'
import { downloadCsv, csvDateStamp } from '@/lib/csv'
import { navigate } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { StatusBadge } from '@/components/shared/StatusBadge'

export interface EventDetailPageProps {
  eventId: string
}

interface EditFormState {
  name: string
  description: string
  startDate: string
  endDate: string
}

interface TaskFormState {
  title: string
  description: string
  priority: string
  assignedTo: string
  dueDate: string
  estimatedHours: string
}

const EMPTY_EDIT: EditFormState = { name: '', description: '', startDate: '', endDate: '' }
const EMPTY_TASK: TaskFormState = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  assignedTo: '__unassigned__',
  dueDate: '',
  estimatedHours: '',
}

const UNASSIGNED = '__unassigned__'

const TASK_SORTS = [
  { value: 'due-asc', label: 'Due soonest' },
  { value: 'due-desc', label: 'Due latest' },
  { value: 'priority', label: 'Priority (high → low)' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'newest', label: 'Newest first' },
] as const

type TaskSort = (typeof TASK_SORTS)[number]['value']

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const STATUS_ORDER: Record<string, number> = { NOT_STARTED: 0, IN_PROGRESS: 1, BLOCKED: 2, COMPLETED: 3 }

function byDue(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return 1 // no due date sinks to the bottom
  if (!b) return -1
  return new Date(a).getTime() - new Date(b).getTime()
}

function toDateInput(iso: string | null | undefined): string {
  return iso ? format(new Date(iso), 'yyyy-MM-dd') : ''
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function EventDetailPage({ eventId }: EventDetailPageProps) {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)

  const [event, setEvent] = useState<EventDTO | null>(null)
  const [tasks, setTasks] = useState<TaskDTO[]>([])
  const [users, setUsers] = useState<UserDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [rowUpdatingId, setRowUpdatingId] = useState<string | null>(null)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<EditFormState>(EMPTY_EDIT)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Add-task dialog
  const [taskOpen, setTaskOpen] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_TASK)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskSaving, setTaskSaving] = useState(false)

  // Task list toolbar: search / status filter / sorting
  const [taskQuery, setTaskQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<TaskSort>('due-asc')

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canManage = useMemo(() => {
    if (!user || !event) return false
    if (user.role === 'EVENT_MANAGER') return true
    return user.role === 'TEAM_LEADER' && user.teamId === event.teamId
  }, [user, event])

  const loadEvent = useCallback(async () => {
    try {
      const data = await api.get<{ event: EventDTO }>(`/events/${eventId}`)
      setEvent(data.event)
      setLoadError(null)
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to load the event.'
      setLoadError(message)
    }
  }, [eventId])

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.get<{ tasks: TaskDTO[] }>(`/tasks${qs({ eventId })}`)
      setTasks(data.tasks)
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to load tasks.'
      toast({ title: 'Could not load tasks', description: message, variant: 'destructive' })
    }
  }, [eventId, toast])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [usersData] = await Promise.all([
          api.get<{ users: UserDTO[] }>('/users'),
          loadEvent(),
          loadTasks(),
        ])
        if (!cancelled) setUsers(usersData.users.filter((u) => u.isActive))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadEvent, loadTasks])

  const stats = useMemo(() => {
    const s = event?.taskStats ?? { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0 }
    const percent = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
    return { ...s, percent }
  }, [event])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length, NOT_STARTED: 0, IN_PROGRESS: 0, BLOCKED: 0, COMPLETED: 0 }
    for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1
    return counts
  }, [tasks])

  const visibleTasks = useMemo(() => {
    const q = taskQuery.trim().toLowerCase()
    const filtered = tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      return true
    })
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'due-asc':
          return byDue(a.dueDate, b.dueDate)
        case 'due-desc':
          return byDue(b.dueDate, a.dueDate)
        case 'priority': {
          const p = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
          return p !== 0 ? p : byDue(a.dueDate, b.dueDate)
        }
        case 'status': {
          const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
          return s !== 0 ? s : byDue(a.dueDate, b.dueDate)
        }
        case 'title':
          return a.title.localeCompare(b.title)
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return 0
      }
    })
    return sorted
  }, [tasks, taskQuery, statusFilter, sortBy])

  const openEdit = () => {
    if (!event) return
    setEdit({
      name: event.name,
      description: event.description ?? '',
      startDate: toDateInput(event.startDate),
      endDate: toDateInput(event.endDate),
    })
    setEditError(null)
    setEditOpen(true)
  }

  const handleEditSave = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    if (!event) return
    setEditError(null)

    if (!edit.name.trim()) {
      setEditError('Please give the event a name.')
      return
    }
    if (!edit.startDate || !edit.endDate) {
      setEditError('Please pick both a start and end date.')
      return
    }
    if (new Date(edit.endDate) < new Date(edit.startDate)) {
      setEditError('The end date cannot be before the start date.')
      return
    }

    setEditSaving(true)
    try {
      const data = await api.patch<{ event: EventDTO }>(`/events/${event.id}`, {
        name: edit.name.trim(),
        description: edit.description.trim() || undefined,
        startDate: new Date(`${edit.startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${edit.endDate}T23:59:59`).toISOString(),
      })
      setEvent(data.event)
      setEditOpen(false)
      toast({ title: 'Event updated', description: `“${data.event.name}” was saved.` })
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to update the event.'
      setEditError(message)
    } finally {
      setEditSaving(false)
    }
  }

  const handleStatusChange = async (next: EventStatus) => {
    if (!event || event.status === next) return
    const previous = event
    setStatusUpdating(true)
    setEvent({ ...event, status: next })
    try {
      const data = await api.patch<{ event: EventDTO }>(`/events/${event.id}`, { status: next })
      setEvent(data.event)
      toast({ title: 'Status updated', description: `“${data.event.name}” is now ${EVENT_STATUS_LABELS[next] ?? next}.` })
    } catch (error) {
      setEvent(previous)
      const message = error instanceof ApiClientError ? error.message : 'Failed to update the status.'
      toast({ title: 'Update failed', description: message, variant: 'destructive' })
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleAddTask = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    if (!event) return
    setTaskError(null)

    if (!taskForm.title.trim()) {
      setTaskError('Please give the task a title.')
      return
    }

    setTaskSaving(true)
    try {
      const data = await api.post<{ task: TaskDTO }>('/tasks', {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        priority: taskForm.priority as TaskDTO['priority'],
        eventId: event.id,
        assignedTo: taskForm.assignedTo === '__unassigned__' ? undefined : taskForm.assignedTo,
        dueDate: taskForm.dueDate ? new Date(`${taskForm.dueDate}T17:00:00`).toISOString() : undefined,
        estimatedHours: taskForm.estimatedHours ? Number(taskForm.estimatedHours) : undefined,
      })
      setTaskOpen(false)
      setTaskForm(EMPTY_TASK)
      toast({ title: 'Task created', description: `“${data.task.title}” was added to the event.` })
      void loadTasks()
      void loadEvent()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to create the task.'
      setTaskError(message)
    } finally {
      setTaskSaving(false)
    }
  }

  const handleTaskStatusChange = async (task: TaskDTO, next: TaskStatus) => {
    if (task.status === next) return
    const previous = tasks
    setRowUpdatingId(task.id)
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await api.patch(`/tasks/${task.id}`, { status: next })
      toast({ title: 'Task updated', description: `“${task.title}” moved to ${TASK_STATUS_LABELS[next] ?? next}.` })
      void loadEvent()
    } catch (error) {
      setTasks(previous)
      const message = error instanceof ApiClientError ? error.message : 'Failed to update the task.'
      toast({ title: 'Update failed', description: message, variant: 'destructive' })
    } finally {
      setRowUpdatingId(null)
    }
  }

  const handleTaskAssigneeChange = async (task: TaskDTO, assigneeId: string) => {
    const nextUserId = assigneeId === UNASSIGNED ? null : assigneeId
    if ((task.assignedTo ?? null) === nextUserId) return
    const previous = tasks
    setRowUpdatingId(task.id)
    setTasks((list) =>
      list.map((t) =>
        t.id === task.id
          ? {
              ...t,
              assignedTo: nextUserId,
              assignee: nextUserId ? (users.find((u) => u.id === nextUserId) ?? null) : null,
            }
          : t
      )
    )
    try {
      await api.patch(`/tasks/${task.id}`, { assignedTo: nextUserId })
      toast({
        title: 'Assignee updated',
        description: `“${task.title}” → ${nextUserId ? (users.find((u) => u.id === nextUserId)?.fullName ?? 'member') : 'Unassigned'}`,
      })
    } catch (error) {
      setTasks(previous)
      const message = error instanceof ApiClientError ? error.message : 'Failed to update the assignee.'
      toast({ title: 'Update failed', description: message, variant: 'destructive' })
    } finally {
      setRowUpdatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!event) return
    setDeleting(true)
    try {
      await api.del(`/events/${event.id}`)
      toast({ title: 'Event deleted', description: `“${event.name}” has been removed.` })
      navigate(ROUTES.EVENTS)
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to delete the event.'
      toast({ title: 'Delete failed', description: message, variant: 'destructive' })
      setDeleting(false)
    }
  }

  const handleExportTasks = () => {
    const rows: (string | number | null)[][] = [
      ['Title', 'Status', 'Priority', 'Assignee', 'Due date', 'Estimated hours', 'Actual hours', 'Comments'],
      ...tasks.map((task) => [
        task.title,
        TASK_STATUS_LABELS[task.status] ?? task.status,
        PRIORITY_LABELS[task.priority] ?? task.priority,
        task.assignee?.fullName ?? 'Unassigned',
        task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
        task.estimatedHours ?? '',
        task.actualHours ?? '',
        task.commentCount ?? 0,
      ]),
    ]
    downloadCsv(`eventflow-tasks-${event?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? 'event'}-${csvDateStamp()}`, rows)
    toast({ title: 'Export ready', description: `${tasks.length} task(s) exported to CSV.` })
  }

  // ============ Loading / error states ============
  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (loadError || !event) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(ROUTES.EVENTS)} className="min-h-11 text-muted-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to events
        </Button>
        <EmptyState
          icon={CalendarDays}
          title="Event not found"
          hint={loadError ?? 'This event may have been deleted.'}
          action={
            <Button onClick={() => navigate(ROUTES.EVENTS)} className="bg-emerald-600 text-white hover:bg-emerald-700">
              All events
            </Button>
          }
        />
      </div>
    )
  }

  const dateLabel = format(new Date(event.startDate), 'MMM d, yyyy')
  const endDateLabel = format(new Date(event.endDate), 'MMM d, yyyy')
  const rangeLabel =
    dateLabel === endDateLabel ? dateLabel : `${format(new Date(event.startDate), 'MMM d')} – ${endDateLabel}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={() => navigate(ROUTES.EVENTS)} className="mb-3 min-h-11 px-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          All events
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="min-w-0"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{event.name}</h1>
              <StatusBadge
                label={EVENT_STATUS_LABELS[event.status] ?? event.status}
                className={EVENT_STATUS_CLASSES[event.status]}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {rangeLabel}
              </span>
              {event.team ? (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {event.team.name}
                </span>
              ) : null}
              {event.creator ? <span>Created by {event.creator.fullName}</span> : null}
            </div>
            {event.description ? (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{event.description}</p>
            ) : null}
          </motion.div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <>
                <Select value={event.status} onValueChange={(value) => void handleStatusChange(value as EventStatus)} disabled={statusUpdating}>
                  <SelectTrigger className="h-11 w-40" aria-label="Change event status">
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
                <Button variant="outline" onClick={openEdit} className="min-h-11">
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </>
            ) : null}
            <Button onClick={() => setTaskOpen(true)} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
              <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add task
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Event task statistics">
        {[
          { label: 'Total tasks', value: stats.total, classes: 'bg-muted/50 text-foreground' },
          { label: 'Completed', value: stats.completed, classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
          { label: 'In progress', value: stats.inProgress, classes: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
          { label: 'Blocked', value: stats.blocked, classes: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300' },
        ].map((chip) => (
          <Card key={chip.label} className="py-0">
            <CardContent className={cn('rounded-xl px-4 py-4', chip.classes)}>
              <p className="text-2xl font-bold leading-none">{chip.value}</p>
              <p className="mt-1.5 text-xs font-medium opacity-80">{chip.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Progress */}
      <Card className="py-4">
        <CardContent className="px-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Completion</p>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{stats.percent}%</p>
          </div>
          <Progress value={stats.percent} className="mt-2 h-2" aria-label={`${stats.percent}% of tasks completed`} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {stats.completed} of {stats.total} tasks done
              {stats.notStarted > 0 ? ` · ${stats.notStarted} not started` : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={handleExportTasks} disabled={tasks.length === 0}>
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Export tasks CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                onClick={() => navigate(`${ROUTES.TASKS}?event=${event.id}`)}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Open board
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task list */}
      <Card className="py-0">
        <CardContent className="px-0 pb-2">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Tasks <span className="ml-1 text-muted-foreground">({statusCounts.all})</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
                  <Input
                    value={taskQuery}
                    onChange={(e) => setTaskQuery(e.target.value)}
                    placeholder="Filter by title…"
                    className="h-9 w-40 pl-8 text-xs sm:w-48"
                    aria-label="Filter tasks by title"
                  />
                </div>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as TaskSort)}>
                  <SelectTrigger className="h-9 w-44 text-xs" aria-label="Sort tasks">
                    <ArrowDownUp className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_SORTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Status filter chips */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter tasks by status">
              {(['all', ...TASK_STATUSES] as const).map((status) => {
                const active = statusFilter === status
                const label = status === 'all' ? 'All' : (TASK_STATUS_LABELS[status] ?? status)
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-border bg-background text-muted-foreground hover:border-emerald-300 hover:text-foreground dark:hover:border-emerald-500/40'
                    )}
                  >
                    {label}
                    <span className={cn('rounded-full px-1.5 text-[10px] font-semibold', active ? 'bg-white/20' : 'bg-muted text-muted-foreground')}>
                      {statusCounts[status] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                icon={CalendarPlus}
                title="No tasks yet"
                hint="Break this event down into tasks so the team can start executing."
                action={
                  <Button onClick={() => setTaskOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Add the first task
                  </Button>
                }
              />
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                icon={Search}
                title="No matching tasks"
                hint="No tasks match the current search and status filter."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTaskQuery('')
                      setStatusFilter('all')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {visibleTasks.map((task, index) => {
                const due = task.dueDate ? new Date(task.dueDate) : null
                const overdue = due !== null && due.getTime() < Date.now() && task.status !== 'COMPLETED'
                return (
                  <motion.li
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.25), ease: 'easeOut' }}
                    className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border', PRIORITY_CLASSES[task.priority])}
                        aria-hidden="true"
                        title={`${PRIORITY_LABELS[task.priority] ?? task.priority} priority`}
                      />
                      <div className="min-w-0">
                        <p className={cn('truncate text-sm font-medium text-foreground', task.status === 'COMPLETED' && 'text-muted-foreground line-through')}>
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className={cn('font-medium', PRIORITY_CLASSES[task.priority])}>
                            {PRIORITY_LABELS[task.priority] ?? task.priority}
                          </span>
                          {due ? (
                            <span className={cn('inline-flex items-center gap-1', overdue && 'font-semibold text-red-600 dark:text-red-400')}>
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              {overdue ? 'Overdue ' : 'Due '}
                              {format(due, 'MMM d')}
                            </span>
                          ) : null}
                          {task.assignee ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Avatar className="h-4.5 w-4.5">
                                <AvatarFallback className="text-[8px]">{initialsOf(task.assignee.fullName)}</AvatarFallback>
                              </Avatar>
                              {task.assignee.fullName}
                            </span>
                          ) : (
                            <span>Unassigned</span>
                          )}
                          {(task.commentCount ?? 0) > 0 ? <span>{task.commentCount} 💬</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                      {rowUpdatingId === task.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" aria-hidden="true" />
                      ) : null}
                      {canManage ? (
                        <Select
                          value={task.assignedTo ?? UNASSIGNED}
                          onValueChange={(value) => void handleTaskAssigneeChange(task, value)}
                        >
                          <SelectTrigger className="h-9 w-36 text-xs" aria-label={`Change assignee for ${task.title}`}>
                            {task.assignee ? (
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback className="text-[7px]">{initialsOf(task.assignee.fullName)}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{task.assignee.fullName}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      <Select value={task.status} onValueChange={(value) => void handleTaskStatusChange(task, value as TaskStatus)}>
                        <SelectTrigger
                          className="h-9 w-36 text-xs"
                          aria-label={`Change status for ${task.title}`}
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
                  </motion.li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => !open && setEditOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleEditSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit event</DialogTitle>
              <DialogDescription>Update the event details, dates or description.</DialogDescription>
            </DialogHeader>

            {editError ? (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={edit.name}
                onChange={(e) => setEdit((f) => ({ ...f, name: e.target.value }))}
                className="h-11"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Start date</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={edit.startDate}
                  onChange={(e) => setEdit((f) => ({ ...f, startDate: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">End date</Label>
                <Input
                  id="edit-end"
                  type="date"
                  value={edit.endDate}
                  onChange={(e) => setEdit((f) => ({ ...f, endDate: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={edit.description}
                onChange={(e) => setEdit((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="What is this event about?"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="min-h-11">
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
                {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add task dialog */}
      <Dialog open={taskOpen} onOpenChange={(open) => !open && setTaskOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleAddTask} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add a task</DialogTitle>
              <DialogDescription>It will be attached to “{event.name}”.</DialogDescription>
            </DialogHeader>

            {taskError ? (
              <Alert variant="destructive">
                <AlertDescription>{taskError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                className="h-11"
                placeholder="e.g. Confirm catering headcount"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={taskForm.priority} onValueChange={(value) => setTaskForm((f) => ({ ...f, priority: value }))}>
                  <SelectTrigger id="task-priority" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assignee</Label>
                <Select value={taskForm.assignedTo} onValueChange={(value) => setTaskForm((f) => ({ ...f, assignedTo: value }))}>
                  <SelectTrigger id="task-assignee" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-hours">Estimated hours</Label>
                <Input
                  id="task-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={taskForm.estimatedHours}
                  onChange={(e) => setTaskForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                  className="h-11"
                  placeholder="e.g. 8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Details, links, acceptance criteria…"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTaskOpen(false)} className="min-h-11">
                Cancel
              </Button>
              <Button type="submit" disabled={taskSaving} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
                {taskSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Create task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              “{event.name}” and its {stats.total} task(s) with all comments will be permanently removed. This action cannot be
              undone.
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
