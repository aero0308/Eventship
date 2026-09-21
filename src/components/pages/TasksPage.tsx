'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlarmClock,
  CheckCircle2,
  Clock,
  Columns3,
  Download,
  Layers,
  Link2,
  ListTodo,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Rows3,
  Save,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react'
import { differenceInCalendarDays, format, formatDistanceToNow, isSameDay } from 'date-fns'
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TaskCommentDTO, TaskDTO, TaskPriority, TaskStatsDTO, TaskStatus, UserDTO } from '@/types'
import type { EventDTO } from '@/types'
import {
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  ROUTES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_CLASSES,
  TASK_STATUS_LABELS,
} from '@/lib/constants'
import { api, ApiClientError, qs } from '@/lib/api-client'
import {
  clearRealtimeRooms,
  getRealtimeSocket,
  setRealtimeRooms,
  setRealtimeUser,
  type BoardChangePayload,
  type CommentTypingPayload,
  type PresencePayload,
  type PresenceUser,
} from '@/lib/realtime-client'
import { LiveBadge, PresenceStack } from '@/components/shared/RealtimeChrome'
import { DateInput } from '@/components/shared/DateInput'
import { DependencyChain } from '@/components/shared/DependencyChain'
import { downloadCsv, csvDateStamp } from '@/lib/csv'
import { useHashRoute, navigate } from '@/hooks/use-hash-route'
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

/** Task with the comments array included (GET /api/tasks/[id]). */
interface TaskDetail extends TaskDTO {
  comments?: TaskCommentDTO[]
}

const COLUMN_DOT: Record<string, string> = {
  NOT_STARTED: 'bg-stone-400',
  IN_PROGRESS: 'bg-amber-500',
  BLOCKED: 'bg-red-500',
  COMPLETED: 'bg-emerald-500',
}

const COLUMN_BORDER: Record<string, string> = {
  NOT_STARTED: 'border-t-stone-400',
  IN_PROGRESS: 'border-t-amber-500',
  BLOCKED: 'border-t-red-500',
  COMPLETED: 'border-t-emerald-500',
}

/** Status-tinted count pill shown in each column header. */
const COLUMN_COUNT_PILL: Record<string, string> = {
  NOT_STARTED: 'bg-stone-100 text-stone-600 ring-stone-200 dark:bg-stone-500/15 dark:text-stone-300 dark:ring-stone-500/25',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25',
  BLOCKED: 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25',
  COMPLETED: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
}

const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-stone-300',
}

const UNASSIGNED = '__unassigned__'

/** Runtime guards for realtime payloads (the server sends serialized DTOs). */
function isTaskDTO(value: unknown): value is TaskDTO {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { id?: unknown; title?: unknown; status?: unknown }
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.status === 'string'
  )
}

function isCommentDTO(value: unknown): value is TaskCommentDTO {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { id?: unknown; content?: unknown }
  return typeof candidate.id === 'string' && typeof candidate.content === 'string'
}
const NO_EVENT = '__no_event__'

interface TaskFormState {
  title: string
  description: string
  eventId: string
  priority: TaskPriority
  assignedTo: string
  startDate: string
  dueDate: string
  estimatedHours: string
}

interface EditFormState {
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  assignedTo: string
  startDate: string
  dueDate: string
  estimatedHours: string
  actualHours: string
}

function dueChip(task: TaskDTO): { label: string; classes: string } | null {
  if (!task.dueDate) return null
  const due = new Date(task.dueDate)
  const days = differenceInCalendarDays(due, new Date())
  const done = task.status === 'COMPLETED'
  if (done) {
    return { label: `Due ${format(due, 'MMM d')}`, classes: 'border-border bg-muted/50 text-muted-foreground/70' }
  }
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, classes: 'border-red-200 bg-red-50 text-red-700' }
  if (days === 0) return { label: 'Due today', classes: 'border-amber-200 bg-amber-50 text-amber-800' }
  if (days < 3) return { label: `${days}d left`, classes: 'border-amber-200 bg-amber-50 text-amber-800' }
  return { label: `Due ${format(due, 'MMM d')}`, classes: 'border-border bg-muted/50 text-muted-foreground' }
}

/**
 * Dependency health for a task, derived from the serialized dependency
 * statuses (dependsOnTaskStatus). A task is "blocked" while any dependency
 * is not COMPLETED; once all finish it becomes "ready".
 */
function dependencyHealth(task: TaskDTO): { hasDeps: boolean; blockedBy: number; ready: boolean } {
  const deps = task.dependencies ?? []
  const incomplete = deps.filter((dep) => dep.dependsOnTaskStatus !== 'COMPLETED').length
  return {
    hasDeps: deps.length > 0,
    blockedBy: task.status === 'COMPLETED' ? 0 : incomplete,
    ready: deps.length > 0 && incomplete === 0 && task.status !== 'COMPLETED',
  }
}

/**
 * Refresh the dependency health of every card that depends on `changed`, so
 * blocked/ready chips stay truthful the moment a dependency's status moves
 * (own DnD moves and realtime patches from other clients share this).
 */
function withDepStatusRefresh(list: TaskDTO[], changed: Pick<TaskDTO, 'id' | 'status'>): TaskDTO[] {
  return list.map((t) => {
    if (!(t.dependencies ?? []).some((dep) => dep.dependsOnTaskId === changed.id)) return t
    return {
      ...t,
      dependencies: (t.dependencies ?? []).map((dep) =>
        dep.dependsOnTaskId === changed.id ? { ...dep, dependsOnTaskStatus: changed.status } : dep
      ),
    }
  })
}

// ============ Draggable task card ============

interface TaskCardProps {
  task: TaskDTO
  canDrag: boolean
  mobileStatusSelect: React.ReactNode
  onOpen: (task: TaskDTO) => void
  selected: boolean
  onToggleSelect: (taskId: string, checked: boolean | 'indeterminate') => void
}

function DraggableTaskCard({ task, canDrag, mobileStatusSelect, onOpen, selected, onToggleSelect }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canDrag })
  const chip = dueChip(task)
  const startChip =
    task.startDate && (!task.dueDate || !isSameDay(new Date(task.startDate), new Date(task.dueDate)))
      ? format(new Date(task.startDate), 'MMM d')
      : null
  const assignee = task.assignee

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={cn(isDragging && 'z-20 opacity-60')}>
      <Card
        className={cn(
          'group cursor-pointer gap-2 border-l-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
          'border-l-red-500',
          task.priority === 'MEDIUM' && 'border-l-amber-500',
          task.priority === 'LOW' && 'border-l-stone-300',
          task.status === 'COMPLETED' && 'opacity-80',
          isDragging && 'ring-2 ring-emerald-500',
          selected && 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500 dark:bg-emerald-500/10',
          canDrag && 'active:cursor-grabbing'
        )}
        onClick={() => onOpen(task)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(task)
          }
        }}
        aria-label={`Open task ${task.title}`}
      >
        <CardContent className="px-3" {...(canDrag ? listeners : {})} {...attributes}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <span
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex shrink-0"
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => onToggleSelect(task.id, checked)}
                  className="mt-0.5 opacity-40 transition-opacity group-hover:opacity-100 data-[state=checked]:opacity-100"
                  aria-label={`Select task ${task.title}`}
                />
              </span>
              <p className={cn('line-clamp-2 text-sm font-semibold text-foreground', task.status === 'COMPLETED' && 'line-through decoration-stone-300')}>
                {task.title}
              </p>
            </div>
            <span
              className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority] ?? 'bg-stone-300')}
              title={`${PRIORITY_LABELS[task.priority] ?? task.priority} priority`}
              aria-label={`${PRIORITY_LABELS[task.priority] ?? task.priority} priority`}
            />
          </div>

          {task.event ? (
            <p className="mt-1 truncate text-[11px] text-muted-foreground/70">{task.event.name}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {chip ? (
              <Badge variant="outline" className={cn('gap-1 text-[10px] font-normal', chip.classes)}>
                <Clock className="h-3 w-3" aria-hidden="true" />
                {chip.label}
              </Badge>
            ) : null}
            {startChip ? (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] font-normal text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
                title={`Scheduled start: ${startChip}`}
              >
                <Play className="h-3 w-3" aria-hidden="true" />
                Starts {startChip}
              </Badge>
            ) : null}
            {task.priority ? (
              <StatusBadge label={PRIORITY_LABELS[task.priority] ?? task.priority} className={cn('text-[10px]', PRIORITY_CLASSES[task.priority])} />
            ) : null}
            {(task.commentCount ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                {task.commentCount}
              </span>
            ) : null}
            {(task.dependencies?.length ?? 0) > 0 ? (
              dependencyHealth(task).blockedBy > 0 ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-red-200 bg-red-50 text-[10px] font-normal text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
                  title={`Waiting on ${dependencyHealth(task).blockedBy} unfinished ${dependencyHealth(task).blockedBy === 1 ? 'dependency' : 'dependencies'}`}
                >
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                  </span>
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  Blocked by {dependencyHealth(task).blockedBy}
                </Badge>
              ) : dependencyHealth(task).ready ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] font-normal text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
                  title="All dependencies are complete — ready to work on"
                >
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Ready
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70" title={`${task.dependencies?.length ?? 0} dependencies (all complete)`}>
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  {task.dependencies?.length}
                </span>
              )
            ) : null}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className={cn('text-[9px] font-semibold', assignee ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground')}>
                {assignee ? initialsOf(assignee.fullName) : '—'}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-[11px] text-muted-foreground">{assignee ? assignee.fullName : 'Unassigned'}</span>
          </div>

          {mobileStatusSelect}
        </CardContent>
      </Card>
    </div>
  )
}

// ============ Droppable column ============

interface ColumnProps {
  status: TaskStatus
  count: number
  children: React.ReactNode
  highlight: boolean
}

function KanbanColumn({ status, count, children, highlight }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <section
      ref={setNodeRef}
      aria-label={`${TASK_STATUS_LABELS[status]} column`}
      className={cn(
        'flex min-h-40 flex-col rounded-xl border border-t-4 border-border bg-muted/80 shadow-sm transition-all duration-200',
        COLUMN_BORDER[status],
        highlight && 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-200',
        status === 'COMPLETED' && 'border-t-emerald-500'
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', COLUMN_DOT[status])} aria-hidden="true" />
          <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-foreground/90">{TASK_STATUS_LABELS[status]}</h3>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1 transition-colors',
            COLUMN_COUNT_PILL[status]
          )}
          aria-label={`${count} ${TASK_STATUS_LABELS[status]} tasks`}
        >
          {count}
        </span>
      </header>
      <div className="scrollbar-thin flex max-h-[34rem] flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {children}
        {isOver && count === 0 ? (
          <div
            className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-emerald-400/70 bg-emerald-50/50 py-6 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
            aria-hidden="true"
          >
            Drop here
          </div>
        ) : null}
      </div>
    </section>
  )
}

// ============ Stats cell (Phase 5 stats strip) ============

const STAT_TONES: Record<string, { icon: string; value: string }> = {
  stone: {
    icon: 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300',
    value: 'text-foreground',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    value: 'text-amber-700 dark:text-amber-300',
  },
  red: {
    icon: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    value: 'text-red-700 dark:text-red-300',
  },
  orange: {
    icon: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    value: 'text-orange-700 dark:text-orange-300',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
}

function StatCell({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  label: string
  value: number
  tone: keyof typeof STAT_TONES
}) {
  const tones = STAT_TONES[tone] ?? STAT_TONES.stone
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tones.icon)}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        {label}
      </div>
      <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', tones.value)}>{value}</p>
    </div>
  )
}

// ============ Main page ============

export function TasksPage({ scope = 'all' }: { scope?: 'all' | 'mine' }) {
  const path = useHashRoute()
  const { toast } = useToast()

  const queryEvent = useMemo(() => {
    const query = path.split('?')[1] ?? ''
    return new URLSearchParams(query).get('event') ?? ''
  }, [path])

  const queryAssignee = useMemo(() => {
    const query = path.split('?')[1] ?? ''
    return new URLSearchParams(query).get('assignee') ?? ''
  }, [path])

  // Phase 6: deep-linkable status/overdue presets (dashboard stat cards land here).
  const queryStatus = useMemo(() => {
    const query = path.split('?')[1] ?? ''
    return new URLSearchParams(query).get('status') ?? ''
  }, [path])

  const queryOverdue = useMemo(() => {
    const query = path.split('?')[1] ?? ''
    return new URLSearchParams(query).get('overdue') === 'true'
  }, [path])

  const [tasks, setTasks] = useState<TaskDTO[]>([])
  const [events, setEvents] = useState<EventDTO[]>([])
  const [users, setUsers] = useState<UserDTO[]>([])
  const [loading, setLoading] = useState(true)
  // Phase 5: role-scoped task statistics for the header strip.
  const [stats, setStats] = useState<TaskStatsDTO | null>(null)

  // Board vs list presentation (Phase 5 view toggle).
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkApplying, setBulkApplying] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  // Phase 6: status/overdue filters (feed from ?status= / ?overdue= deep links).
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  // Quick filter: only tasks waiting on unfinished dependencies.
  const [blockedOnly, setBlockedOnly] = useState(false)

  // Mobile detection (dnd disabled below md).
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Sync the ?event= / ?assignee= hash queries into their filters once they arrive.
  useEffect(() => {
    if (queryEvent) {
      setEventFilter(queryEvent)
    }
  }, [queryEvent])

  useEffect(() => {
    if (scope === 'all' && queryAssignee) {
      setAssigneeFilter(queryAssignee)
    }
  }, [queryAssignee, scope])

  // Phase 6: ?status=BLOCKED / ?overdue=true deep links (dashboard stat cards).
  useEffect(() => {
    if (queryStatus && TASK_STATUSES.includes(queryStatus as TaskStatus)) {
      setStatusFilter(queryStatus)
    }
  }, [queryStatus])

  useEffect(() => {
    if (queryOverdue) setOverdueOnly(true)
  }, [queryOverdue])

  const loadStats = useCallback(async () => {
    try {
      // "My Tasks" gets personal numbers (assigned to me) instead of the
      // role-wide scope — the two views must not share one stat strip.
      const data = await api.get<{ stats: TaskStatsDTO }>(
        `/tasks/stats${qs({ scope: scope === 'mine' ? 'mine' : undefined })}`
      )
      setStats(data.stats)
    } catch {
      // Stats are supplementary — a failed refresh just keeps the last values.
    }
  }, [scope])

  const loadTasks = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true)
      try {
        const data = await api.get<{ tasks: TaskDTO[] }>(
          `/tasks${qs({
            eventId: eventFilter !== 'all' ? eventFilter : undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            overdue: overdueOnly ? 'true' : undefined,
            priority: priorityFilter !== 'all' ? priorityFilter : undefined,
            assignedTo:
              scope === 'mine'
                ? 'me'
                : assigneeFilter !== 'all'
                  ? assigneeFilter === UNASSIGNED
                    ? 'unassigned'
                    : assigneeFilter
                  : undefined,
            search: search.trim() || undefined,
          })}`
        )
        setTasks(data.tasks)
        // Stats ride along so every board mutation/filter round keeps them live.
        void loadStats()
      } catch (error) {
        const message = error instanceof ApiClientError ? error.message : 'Failed to load tasks.'
        toast({ title: 'Could not load tasks', description: message, variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    },
    [eventFilter, priorityFilter, assigneeFilter, statusFilter, overdueOnly, search, scope, loadStats, toast]
  )

  // ---- Realtime: live board updates --------------------------------------
  // Subscribe to every event room (or just the filtered one); when someone
  // else changes a task/comment, refetch the board (debounced).
  const user = useAuthStore((s) => s.user)
  const boardRooms = useMemo(() => {
    // `board:tasks` is the presence room for the all-tasks kanban — it always
    // rides along so colleagues on the same board see each other, regardless
    // of which event rooms are subscribed for live updates.
    if (eventFilter !== 'all') return ['board:tasks', `event:${eventFilter}`]
    return ['board:tasks', ...events.map((event) => `event:${event.id}`)]
  }, [eventFilter, events])
  const roomsKey = boardRooms.join(',')

  const loadTasksRef = useRef(loadTasks)
  loadTasksRef.current = loadTasks

  // Phase 7: remote mutations refresh the stats strip via this ref (the
  // realtime effect subscribes once — the ref keeps the callback current).
  const loadStatsRef = useRef(loadStats)
  loadStatsRef.current = loadStats

  // Latest filter values for the realtime optimistic matcher — the socket
  // effect below subscribes once; refs keep the predicate current without
  // resubscribing on every keystroke.
  const filtersRef = useRef({ eventFilter, assigneeFilter, priorityFilter, statusFilter, overdueOnly, search })
  filtersRef.current = { eventFilter, assigneeFilter, priorityFilter, statusFilter, overdueOnly, search }

  // Events + users feed the filter dropdowns; refetched on event:updated.
  const loadMeta = useCallback(async () => {
    try {
      const [eventsData, usersData] = await Promise.all([
        api.get<{ events: EventDTO[] }>('/events'),
        api.get<{ users: UserDTO[] }>('/users'),
      ])
      setEvents(eventsData.events)
      setUsers(usersData.users)
    } catch {
      // Filter dropdowns stay empty; main list still works.
    }
  }, [])
  const loadMetaRef = useRef(loadMeta)
  loadMetaRef.current = loadMeta

  // ---- Realtime: board presence ------------------------------------------
  // Who else is looking at the tasks board right now (room `board:tasks`).
  const [viewers, setViewers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!user) return
    const socket = getRealtimeSocket()
    if (!socket) return
    const onPresence = (payload: PresencePayload) => {
      if (payload.room !== 'board:tasks') return
      setViewers(payload.viewers.filter((viewer) => viewer.id !== user.id))
    }
    socket.on('presence:updated', onPresence)
    return () => {
      socket.off('presence:updated', onPresence)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    setRealtimeUser({ id: user.id, fullName: user.fullName, role: user.role })
    // Presence only for `board:tasks` — the event rooms ride along for live
    // updates, but sitting on the global board must NOT mark you as viewing
    // every individual event (see the events-grid presence chips).
    setRealtimeRooms('board', roomsKey ? roomsKey.split(',') : [], {
      presenceRooms: ['board:tasks'],
    })
    return () => clearRealtimeRooms('board')
  }, [roomsKey, user])

  useEffect(() => {
    const timer = setTimeout(() => void loadTasks(), 250)
    return () => clearTimeout(timer)
  }, [loadTasks])

  // Prune selection when the visible task list changes (deletes, filter changes).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const alive = new Set(tasks.map((t) => t.id))
      const next = new Set([...prev].filter((id) => alive.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [tasks])

  const toggleTaskSelection = useCallback((taskId: string, checked: boolean | 'indeterminate') => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked === true) next.add(taskId)
      else next.delete(taskId)
      return next
    })
  }, [])

  // Escape clears the selection (unless the confirm dialog is open).
  useEffect(() => {
    if (selectedIds.size === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !bulkDeleteOpen) setSelectedIds(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds.size, bulkDeleteOpen])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  // ============ DnD ============
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  )
  const [activeTask, setActiveTask] = useState<TaskDTO | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const lastDragEndAt = useRef(0)

  // Phase 5: moving a task to BLOCKED asks for a reason (TaskStatusUpdateModal
  // from the spec). The pending move is held here until the modal submits.
  // `source` distinguishes board moves (optimistic moveTask) from detail-dialog
  // quick updates (minimal status+statusNote patch).
  const [pendingMove, setPendingMove] = useState<{ task: TaskDTO; status: TaskStatus; source: 'board' | 'detail' } | null>(null)
  const [moveNote, setMoveNote] = useState('')
  const [moveNoteError, setMoveNoteError] = useState<string | null>(null)
  const [moveNoteSaving, setMoveNoteSaving] = useState(false)

  const moveTask = useCallback(
    async (task: TaskDTO, nextStatus: TaskStatus, statusNote?: string) => {
      if (task.status === nextStatus) return
      // Strict dependency guard (client pre-check — the server 409s as well):
      // refuse to complete a task whose dependencies are unfinished.
      const health = dependencyHealth(task)
      if (
        user?.strictDependencyGuard &&
        nextStatus === 'COMPLETED' &&
        task.status !== 'COMPLETED' &&
        health.blockedBy > 0
      ) {
        toast({
          title: 'Dependency guard is on',
          description:
            `“${task.title}” still waits on ${health.blockedBy} unfinished ${health.blockedBy === 1 ? 'dependency' : 'dependencies'}. ` +
            `Finish ${health.blockedBy === 1 ? 'it' : 'them'} first — or relax the guard in your profile settings.`,
          variant: 'destructive',
        })
        return
      }
      const previous = tasks
      // Optimistic: move the task AND refresh the dependency health of any
      // card that depends on it, so its blocked/ready chip flips instantly.
      setTasks((list) => withDepStatusRefresh(
        list.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
        { id: task.id, status: nextStatus }
      ))
      try {
        await api.patch(`/tasks/${task.id}`, {
          status: nextStatus,
          ...(statusNote ? { statusNote } : {}),
        })
        // Heads-up when completing a task that still waits on dependencies —
        // allowed, but the mover should know.
        const completingWithOpenDeps = nextStatus === 'COMPLETED' && health.blockedBy > 0
        toast({
          title: completingWithOpenDeps ? 'Task moved — dependencies incomplete' : 'Task moved',
          description: completingWithOpenDeps
            ? `“${task.title}” is now Completed, but ${health.blockedBy} of its ${health.blockedBy === 1 ? 'dependency is' : 'dependencies are'} still unfinished.`
            : `“${task.title}” is now ${TASK_STATUS_LABELS[nextStatus]}.`,
        })
        void loadStats()
      } catch (error) {
        setTasks(previous)
        const message = error instanceof ApiClientError ? error.message : 'Failed to update the task status.'
        toast({ title: 'Could not move task', description: message, variant: 'destructive' })
      }
    },
    [tasks, user, loadStats, toast]
  )

  /** Entry point for every single-task status change — BLOCKED detours through the reason modal. */
  const requestMove = useCallback(
    (task: TaskDTO, nextStatus: TaskStatus) => {
      if (task.status === nextStatus) return
      if (nextStatus === 'BLOCKED') {
        setMoveNote('')
        setMoveNoteError(null)
        setPendingMove({ task, status: nextStatus, source: 'board' })
        return
      }
      void moveTask(task, nextStatus)
    },
    [moveTask]
  )

  /** Detail-dialog status field: picking BLOCKED opens the reason modal instead of editing the form. */
  const handleDetailStatusChange = (nextStatus: TaskStatus) => {
    if (!edit || edit.status === nextStatus) return
    if (nextStatus === 'BLOCKED' && detail) {
      setMoveNote('')
      setMoveNoteError(null)
      setPendingMove({ task: detail, status: nextStatus, source: 'detail' })
      return
    }
    setEdit((f) => (f ? { ...f, status: nextStatus } : f))
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === String(event.active.id)) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    lastDragEndAt.current = Date.now()
    const overId = event.over ? String(event.over.id) : null
    const task = tasks.find((t) => t.id === String(event.active.id))
    setActiveTask(null)
    setOverColumn(null)
    if (!task || !overId) return
    if ((TASK_STATUSES as readonly string[]).includes(overId)) {
      requestMove(task, overId as TaskStatus)
    }
  }

  const openTaskSafe = useCallback((task: TaskDTO) => {
    if (Date.now() - lastDragEndAt.current < 250) return
    setDetailId(task.id)
  }, [])

  // ============ New task dialog ============
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<TaskFormState>({
    title: '',
    description: '',
    eventId: '',
    priority: 'MEDIUM',
    assignedTo: UNASSIGNED,
    startDate: '',
    dueDate: '',
    estimatedHours: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setForm({
      title: '',
      description: '',
      eventId: eventFilter !== 'all' ? eventFilter : '',
      priority: 'MEDIUM',
      assignedTo: UNASSIGNED,
      startDate: '',
      dueDate: '',
      estimatedHours: '',
    })
    setFormError(null)
    setCreateOpen(true)
  }

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim()) {
      setFormError('Please give the task a title.')
      return
    }
    if (!form.eventId) {
      setFormError('Please choose the event this task belongs to.')
      return
    }
    if (form.startDate && form.dueDate && new Date(form.startDate) > new Date(form.dueDate)) {
      setFormError('The start date cannot be after the due date.')
      return
    }

    setSaving(true)
    try {
      const data = await api.post<{ task: TaskDTO }>('/tasks', {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        eventId: form.eventId,
        priority: form.priority,
        assignedTo: form.assignedTo === UNASSIGNED ? null : form.assignedTo,
        startDate: form.startDate ? new Date(`${form.startDate}T09:00:00`).toISOString() : null,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T23:59:59`).toISOString() : null,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
      })
      setCreateOpen(false)
      toast({ title: 'Task created', description: `“${data.task.title}” was added to the board.` })
      void loadTasks()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to create the task.'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  // ============ Detail dialog ============
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [edit, setEdit] = useState<EditFormState | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [comment, setComment] = useState('')
  const [commentSending, setCommentSending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      setEdit(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    api
      .get<{ task: TaskDetail }>(`/tasks/${detailId}`)
      .then((data) => {
        if (cancelled) return
        setDetail(data.task)
        setEdit({
          title: data.task.title,
          description: data.task.description ?? '',
          priority: data.task.priority,
          status: data.task.status,
          assignedTo: data.task.assignedTo ?? UNASSIGNED,
          startDate: data.task.startDate ? format(new Date(data.task.startDate), 'yyyy-MM-dd') : '',
          dueDate: data.task.dueDate ? format(new Date(data.task.dueDate), 'yyyy-MM-dd') : '',
          estimatedHours: data.task.estimatedHours !== null ? String(data.task.estimatedHours) : '',
          actualHours: data.task.actualHours !== null ? String(data.task.actualHours) : '',
        })
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof ApiClientError ? error.message : 'Failed to load the task.'
          toast({ title: 'Could not open task', description: message, variant: 'destructive' })
          setDetailId(null)
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailId, toast])

  const applyTaskUpdate = (updated: TaskDTO) => {
    setTasks((list) => list.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
  }

  // ---- Realtime typing indicator (comment composer) ------------------------
  // While someone else composes a comment on any task in this board's rooms,
  // the realtime service relays ephemeral `comment:typing` pings. We show the
  // indicator only inside the open task detail dialog.
  const [typers, setTypers] = useState<{ id: string; fullName: string; at: number }[]>([])

  useEffect(() => {
    if (!user) return
    const socket = getRealtimeSocket()
    if (!socket) return
    const onTyping = (payload: CommentTypingPayload) => {
      if (!payload?.user || payload.user.id === user.id) return
      setTypers((prev) => [
        ...prev.filter((t) => t.id !== payload.user.id && Date.now() - t.at < 4000),
        { id: payload.user.id, fullName: payload.user.fullName, at: Date.now() },
      ])
    }
    socket.on('comment:typing', onTyping)
    const prune = setInterval(() => {
      setTypers((prev) => {
        const next = prev.filter((t) => Date.now() - t.at < 4000)
        return next.length === prev.length ? prev : next
      })
    }, 1000)
    return () => {
      socket.off('comment:typing', onTyping)
      clearInterval(prune)
    }
  }, [user])

  // Switching tasks (or closing the dialog) clears the indicator.
  useEffect(() => {
    setTypers([])
  }, [detailId])

  const detailRef = useRef(detail)
  detailRef.current = detail
  const lastTypingSentRef = useRef(0)

  /** Throttled "I'm typing" ping for the open task's event room. */
  const notifyTyping = useCallback(() => {
    const current = detailRef.current
    if (!user || !current) return
    const socket = getRealtimeSocket()
    if (!socket?.connected) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < 1200) return
    lastTypingSentRef.current = now
    socket.emit('comment:typing', {
      room: `event:${current.eventId}`,
      user: { id: user.id, fullName: user.fullName },
    })
  }, [user])

  // ---- Realtime: optimistic board patching ---------------------------------
  // Someone else changed a task/comment. The full DTO rides the broadcast, so
  // we patch local state in place (no flicker, no refetch round-trip); any
  // ambiguous change (bulk ops, out-of-view moves, event edits) falls back to
  // the debounced silent refetch.
  useEffect(() => {
    if (!user) return
    const socket = getRealtimeSocket()
    if (!socket) return
    let timer: ReturnType<typeof setTimeout> | null = null

    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void loadTasksRef.current({ silent: true }), 400)
    }

    // Phase 7: remote task mutations should keep the stats strip honest too
    // (the board itself patches optimistically, the counters ride along).
    const scheduleStatsRefresh = () => {
      setTimeout(() => void loadStatsRef.current(), 500)
    }

    /** Would a remotely-changed task belong in the current (filtered) view? */
    const matchesFilters = (task: TaskDTO) => {
      const f = filtersRef.current
      if (f.eventFilter !== 'all' && task.eventId !== f.eventFilter) return false
      if (f.assigneeFilter !== 'all') {
        const okAssignee =
          f.assigneeFilter === UNASSIGNED ? task.assignedTo === null : task.assignedTo === f.assigneeFilter
        if (!okAssignee) return false
      }
      if (f.priorityFilter !== 'all' && task.priority !== f.priorityFilter) return false
      if (f.statusFilter !== 'all' && task.status !== f.statusFilter) return false
      if (f.overdueOnly && (task.status === 'COMPLETED' || !task.dueDate || new Date(task.dueDate) >= new Date())) return false
      const needle = f.search.trim().toLowerCase()
      if (needle) {
        const haystack = `${task.title} ${task.description ?? ''} ${task.event?.name ?? ''}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    }

    const handler = (payload: BoardChangePayload) => {
      if (payload.actorId === user.id) return // own change — optimistic UI already applied

      // Bulk ops carry no per-task payloads — one debounced refetch.
      if (payload.bulk) {
        scheduleRefetch()
        return
      }

      if (payload.type === 'task:updated' && isTaskDTO(payload.task)) {
        const task = payload.task
        scheduleStatsRefresh()
        if (matchesFilters(task)) {
          setTasks((list) =>
            withDepStatusRefresh(
              list.some((t) => t.id === task.id)
                ? list.map((t) => (t.id === task.id ? { ...t, ...task } : t))
                : [...list, task],
              task
            )
          )
          setDetail((prev) => (prev && prev.id === task.id ? { ...prev, ...task } : prev))
        } else {
          // No longer part of this view (moved to another event/assignee…).
          setTasks((list) => withDepStatusRefresh(list.filter((t) => t.id !== task.id), task))
          scheduleRefetch()
        }
        return
      }

      if (payload.type === 'task:created' && isTaskDTO(payload.task)) {
        const task = payload.task
        scheduleStatsRefresh()
        if (matchesFilters(task)) {
          setTasks((list) => (list.some((t) => t.id === task.id) ? list : [task, ...list]))
        } else {
          scheduleRefetch()
        }
        return
      }

      if (payload.type === 'task:deleted' && payload.taskId) {
        const taskId = payload.taskId
        scheduleStatsRefresh()
        setTasks((list) => list.filter((t) => t.id !== taskId))
        setDetailId((current) => (current === taskId ? null : current))
        return
      }

      if (payload.type === 'comment:added' && payload.taskId && isCommentDTO(payload.comment)) {
        const taskId = payload.taskId
        const comment = payload.comment
        setTypers((prev) => prev.filter((t) => t.id !== payload.actorId))
        setTasks((list) =>
          list.map((t) => (t.id === taskId ? { ...t, commentCount: (t.commentCount ?? 0) + 1 } : t))
        )
        setDetail((prev) =>
          prev && prev.id === taskId
            ? { ...prev, comments: [...(prev.comments ?? []).filter((c) => c.id !== comment.id), comment] }
            : prev
        )
        return
      }

      // Phase 5: someone removed a comment — drop it from the open dialog and
      // keep the card counter honest.
      if (payload.type === 'comment:deleted' && payload.taskId && payload.commentId) {
        const taskId = payload.taskId
        const commentId = payload.commentId
        setDetail((prev) =>
          prev && prev.id === taskId
            ? { ...prev, comments: (prev.comments ?? []).filter((c) => c.id !== commentId) }
            : prev
        )
        setTasks((list) =>
          list.map((t) =>
            t.id === taskId ? { ...t, commentCount: Math.max(0, (t.commentCount ?? 1) - 1) } : t
          )
        )
        return
      }

      // event:updated / unknown — refresh dropdown labels + board silently.
      scheduleRefetch()
      void loadMetaRef.current()
    }

    socket.on('board:changed', handler)
    return () => {
      socket.off('board:changed', handler)
      if (timer) clearTimeout(timer)
    }
  }, [user])

  const handleEditSave = async () => {
    if (!detail || !edit) return
    if (!edit.title.trim()) {
      toast({ title: 'Title required', description: 'The task title cannot be empty.', variant: 'destructive' })
      return
    }
    if (edit.startDate && edit.dueDate && new Date(edit.startDate) > new Date(edit.dueDate)) {
      toast({ title: 'Invalid dates', description: 'The start date cannot be after the due date.', variant: 'destructive' })
      return
    }
    // Strict dependency guard (client pre-check; the server 409s as well).
    if (
      user?.strictDependencyGuard &&
      edit.status === 'COMPLETED' &&
      detail.status !== 'COMPLETED' &&
      dependencyHealth(detail).blockedBy > 0
    ) {
      const n = dependencyHealth(detail).blockedBy
      toast({
        title: 'Dependency guard is on',
        description: `This task still waits on ${n} unfinished ${n === 1 ? 'dependency' : 'dependencies'}. Finish ${n === 1 ? 'it' : 'them'} first — or relax the guard in your profile settings.`,
        variant: 'destructive',
      })
      return
    }
    setEditSaving(true)
    try {
      let data: { task: TaskDTO }
      if (canDeleteTask) {
        // Full manager: persist the whole form.
        data = await api.patch<{ task: TaskDTO }>(`/tasks/${detail.id}`, {
          title: edit.title.trim(),
          description: edit.description.trim() || null,
          priority: edit.priority,
          status: edit.status,
          assignedTo: edit.assignedTo === UNASSIGNED ? null : edit.assignedTo,
          startDate: edit.startDate ? new Date(`${edit.startDate}T09:00:00`).toISOString() : null,
          dueDate: edit.dueDate ? new Date(`${edit.dueDate}T23:59:59`).toISOString() : null,
          estimatedHours: edit.estimatedHours ? Number(edit.estimatedHours) : null,
          actualHours: edit.actualHours ? Number(edit.actualHours) : null,
        })
      } else {
        // Assignee-restricted editor: the server only accepts status + actualHours
        // — sending the full form would always 403.
        data = await api.patch<{ task: TaskDTO }>(`/tasks/${detail.id}`, {
          status: edit.status,
          actualHours: edit.actualHours ? Number(edit.actualHours) : null,
        })
      }
      applyTaskUpdate(data.task)
      setDetail((prev) => (prev ? { ...prev, ...data.task } : prev))
      toast({ title: 'Task updated', description: `“${data.task.title}” was saved.` })
      void loadStats()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to save the task.'
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleAddComment = async () => {
    if (!detail || !comment.trim()) return
    setCommentSending(true)
    try {
      const data = await api.post<{ comment: TaskCommentDTO }>(`/tasks/${detail.id}/comments`, {
        content: comment.trim(),
      })
      setDetail((prev) => (prev ? { ...prev, comments: [...(prev.comments ?? []), data.comment] } : prev))
      setTasks((list) => list.map((t) => (t.id === detail.id ? { ...t, commentCount: (t.commentCount ?? 0) + 1 } : t)))
      setComment('')
      toast({ title: 'Comment added' })
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to add the comment.'
      toast({ title: 'Could not comment', description: message, variant: 'destructive' })
    } finally {
      setCommentSending(false)
    }
  }

  // ============ Comment deletion (Phase 5: owner-only) ============
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  const handleDeleteComment = async (commentId: string) => {
    if (!detail) return
    const previous = detail
    // Optimistic: drop the comment and decrement the card counter immediately.
    setDetail((prev) =>
      prev && prev.id === detail.id
        ? { ...prev, comments: (prev.comments ?? []).filter((c) => c.id !== commentId) }
        : prev
    )
    setTasks((list) =>
      list.map((t) =>
        t.id === detail.id ? { ...t, commentCount: Math.max(0, (t.commentCount ?? 1) - 1) } : t
      )
    )
    setDeletingCommentId(commentId)
    try {
      await api.del(`/tasks/${detail.id}/comments/${commentId}`)
      toast({ title: 'Comment deleted' })
    } catch (error) {
      // Roll back to the pre-delete snapshot so the comment never silently vanishes.
      setDetail((prev) => (prev && prev.id === previous.id ? previous : prev))
      setTasks((list) =>
        list.map((t) => (t.id === detail.id ? { ...t, commentCount: previous.commentCount ?? 0 } : t))
      )
      const message = error instanceof ApiClientError ? error.message : 'Failed to delete the comment.'
      toast({ title: 'Could not delete comment', description: message, variant: 'destructive' })
    } finally {
      setDeletingCommentId(null)
    }
  }

  // ============ Dependency management (Phase 5: add / remove) ============
  const canEditDeps = Boolean(
    user &&
      detail &&
      (user.role === 'EVENT_MANAGER' ||
        (user.role === 'TEAM_LEADER' && user.teamId !== null && detail.event?.teamId === user.teamId) ||
        detail.createdBy === user.id)
  )
  /** Mirrors the server's canFullyManageTask rule — hides Delete from users who would only get a 403. */
  const canDeleteTask = canEditDeps
  /** The assignee may still change status + actual hours (server-restricted editor). */
  const isAssignee = Boolean(user && detail && detail.assignedTo === user.id)
  const restrictedEditor = !canDeleteTask && isAssignee
  /** Neither manager nor assignee — the form is informational only. */
  const readOnlyEditor = !canDeleteTask && !isAssignee
  const [depDialogOpen, setDepDialogOpen] = useState(false)
  const [depCandidates, setDepCandidates] = useState<TaskDTO[] | null>(null)
  const [depCandidatesLoading, setDepCandidatesLoading] = useState(false)
  const [depSelected, setDepSelected] = useState('')
  const [depSaving, setDepSaving] = useState(false)
  const [removingDepId, setRemovingDepId] = useState<string | null>(null)

  const openDepDialog = async () => {
    if (!detail) return
    setDepSelected('')
    setDepDialogOpen(true)
    setDepCandidatesLoading(true)
    try {
      const data = await api.get<{ tasks: TaskDTO[] }>(`/tasks${qs({ eventId: detail.eventId })}`)
      const existing = new Set((detail.dependencies ?? []).map((dep) => dep.dependsOnTaskId))
      setDepCandidates(data.tasks.filter((t) => t.id !== detail.id && !existing.has(t.id)))
    } catch {
      setDepCandidates([])
    } finally {
      setDepCandidatesLoading(false)
    }
  }

  const handleAddDependency = async () => {
    if (!detail || !depSelected) return
    setDepSaving(true)
    try {
      const currentIds = (detail.dependencies ?? []).map((dep) => dep.dependsOnTaskId)
      const data = await api.patch<{ task: TaskDTO }>(`/tasks/${detail.id}`, {
        dependsOnTaskIds: [...currentIds, depSelected],
      })
      applyTaskUpdate(data.task)
      setDetail((prev) => (prev ? { ...prev, ...data.task } : prev))
      setDepDialogOpen(false)
      const added = depCandidates?.find((t) => t.id === depSelected)
      toast({ title: 'Dependency added', description: `Now waiting on “${added?.title ?? 'task'}”.` })
    } catch (error) {
      // Cycle / duplicate / self-dependency rejections arrive as 400s with a
      // human message — surface them verbatim.
      const message = error instanceof ApiClientError ? error.message : 'Failed to add the dependency.'
      toast({ title: 'Could not add dependency', description: message, variant: 'destructive' })
    } finally {
      setDepSaving(false)
    }
  }

  const handleRemoveDependency = async (dependsOnTaskId: string) => {
    if (!detail) return
    const previous = detail
    const nextDeps = (detail.dependencies ?? []).filter((dep) => dep.dependsOnTaskId !== dependsOnTaskId)
    // Optimistic removal; the response replaces the whole dependency list.
    setDetail((prev) => (prev ? { ...prev, dependencies: nextDeps } : prev))
    setRemovingDepId(dependsOnTaskId)
    try {
      const data = await api.patch<{ task: TaskDTO }>(`/tasks/${detail.id}`, {
        dependsOnTaskIds: nextDeps.map((dep) => dep.dependsOnTaskId),
      })
      applyTaskUpdate(data.task)
      setDetail((prev) => (prev ? { ...prev, ...data.task } : prev))
      toast({ title: 'Dependency removed' })
    } catch (error) {
      setDetail((prev) => (prev && prev.id === previous.id ? previous : prev))
      const message = error instanceof ApiClientError ? error.message : 'Failed to remove the dependency.'
      toast({ title: 'Could not remove dependency', description: message, variant: 'destructive' })
    } finally {
      setRemovingDepId(null)
    }
  }

  // ============ Reason-modal submit (Phase 5) ============
  const handleMoveNoteSubmit = async () => {
    if (!pendingMove) return
    const note = moveNote.trim()
    if (!note) {
      setMoveNoteError('A reason is required when marking a task as blocked.')
      return
    }
    setMoveNoteSaving(true)
    setMoveNoteError(null)
    try {
      if (pendingMove.source === 'detail' && detail) {
        // Minimal status+note patch — leaves the rest of the edit form untouched.
        const data = await api.patch<{ task: TaskDTO }>(`/tasks/${detail.id}`, {
          status: pendingMove.status,
          statusNote: note,
        })
        applyTaskUpdate(data.task)
        setDetail((prev) => (prev ? { ...prev, ...data.task } : prev))
        setEdit((f) => (f ? { ...f, status: pendingMove.status } : f))
        toast({ title: 'Task blocked', description: `“${data.task.title}” is now Blocked — reason posted as a comment.` })
        void loadStats()
      } else {
        await moveTask(pendingMove.task, pendingMove.status, note)
      }
      setPendingMove(null)
      setMoveNote('')
    } finally {
      setMoveNoteSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!detail) return
    setDeleting(true)
    try {
      await api.del(`/tasks/${detail.id}`)
      setTasks((list) => list.filter((t) => t.id !== detail.id))
      setDetailId(null)
      setDeleteOpen(false)
      toast({ title: 'Task deleted', description: `“${detail.title}” has been removed.` })
      void loadStats()
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to delete the task.'
      toast({ title: 'Delete failed', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ============ Bulk actions ============
  const runBulkAction = useCallback(
    async (
      action: 'status' | 'priority' | 'assign' | 'unassign' | 'delete',
      extra: { status?: TaskStatus; priority?: TaskPriority; assignedTo?: string } = {}
    ) => {
      if (selectedIds.size === 0) return
      setBulkApplying(true)
      try {
        const result = await api.post<{
          updated: number
          deleted: number
          failed: { id: string; title: string; reason: string }[]
          total: number
        }>('/tasks/bulk', { ids: [...selectedIds], action, ...extra })
        const changed = result.updated + result.deleted
        const verb = action === 'delete' ? 'deleted' : 'updated'
        if (result.failed.length > 0) {
          const firstReason = result.failed[0]?.reason ?? 'unknown error'
          toast({
            title: changed === 0 ? 'Nothing changed' : 'Completed with issues',
            description:
              `${changed} of ${result.total} task(s) ${verb}. ` +
              `${result.failed.length} failed: ${firstReason}${result.failed.length > 1 ? ` (+${result.failed.length - 1} more)` : ''}`,
            variant: changed === 0 ? 'destructive' : 'default',
          })
        } else {
          const what =
            action === 'status'
              ? `moved to ${TASK_STATUS_LABELS[extra.status ?? ''] ?? extra.status}`
              : action === 'priority'
                ? `set to ${PRIORITY_LABELS[extra.priority ?? ''] ?? extra.priority} priority`
                : action === 'assign'
                  ? `assigned to ${users.find((u) => u.id === extra.assignedTo)?.fullName ?? 'member'}`
                  : action === 'unassign'
                    ? 'unassigned'
                    : 'deleted'
          toast({
            title: action === 'delete' ? 'Tasks deleted' : 'Tasks updated',
            description: `${changed} task(s) ${what}.`,
          })
        }
        setSelectedIds(new Set())
        setBulkDeleteOpen(false)
        void loadTasks()
      } catch (error) {
        const message = error instanceof ApiClientError ? error.message : 'Bulk update failed.'
        toast({ title: 'Bulk update failed', description: message, variant: 'destructive' })
      } finally {
        setBulkApplying(false)
      }
    },
    [selectedIds, users, loadTasks, toast]
  )

  // ============ Derived ============
  const visibleTasks = useMemo(
    () => (blockedOnly ? tasks.filter((task) => dependencyHealth(task).blockedBy > 0) : tasks),
    [tasks, blockedOnly]
  )

  /** How many tasks on the board are currently waiting on dependencies. */
  const blockedTasksCount = useMemo(
    () => tasks.reduce((sum, task) => sum + (dependencyHealth(task).blockedBy > 0 ? 1 : 0), 0),
    [tasks]
  )

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskDTO[]>()
    TASK_STATUSES.forEach((status) => map.set(status, []))
    visibleTasks.forEach((task) => map.get(task.status)?.push(task))
    return map
  }, [visibleTasks])

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>()
    events.forEach((event) => map.set(event.id, event.name))
    return map
  }, [events])

  const mobileStatusSelectFor = (task: TaskDTO) =>
    isDesktop ? null : (
      <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
        <Select value={task.status} onValueChange={(value) => requestMove(task, value as TaskStatus)}>
          <SelectTrigger size="sm" className="h-9 w-full" aria-label={`Change status of ${task.title}`}>
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
    )

  const canCreate = user?.role === 'EVENT_MANAGER' || user?.role === 'TEAM_LEADER'

  return (
    <div>
      <PageHeader
        title={scope === 'mine' ? 'My Tasks' : 'Tasks'}
        subtitle={
          scope === 'mine'
            ? 'Everything assigned to you — update status inline, or drag cards between columns.'
            : 'Drag cards between columns to update status — the board is your source of truth.'
        }
        actions={
          <>
            <LiveBadge className="mr-1 hidden sm:inline-flex" />
            <PresenceStack viewers={viewers} context={scope === 'mine' ? 'your task list' : 'the tasks board'} />
            {/* Phase 5 view toggle — Kanban board or grouped list. */}
            <div className="flex items-center rounded-lg border border-border bg-muted/60 p-1" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                aria-pressed={viewMode === 'board'}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all duration-200',
                  viewMode === 'board'
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all duration-200',
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Rows3 className="h-4 w-4" aria-hidden="true" />
                List
              </button>
            </div>
            {visibleTasks.length > 0 ? (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  setSelectedIds(selectedIds.size === visibleTasks.length ? new Set() : new Set(visibleTasks.map((t) => t.id)))
                }
                aria-label={selectedIds.size === visibleTasks.length ? 'Deselect all tasks' : 'Select all tasks'}
              >
                <Layers className="mr-2 h-4 w-4" aria-hidden="true" />
                {selectedIds.size === visibleTasks.length ? 'Deselect all' : 'Select all'}
                {selectedIds.size > 0 ? (
                  <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{selectedIds.size}</span>
                ) : null}
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                const rows: (string | number | null)[][] = [
                  ['Title', 'Status', 'Priority', 'Event', 'Assignee', 'Due date', 'Estimated hours', 'Actual hours', 'Comments'],
                  ...tasks.map((task) => [
                    task.title,
                    TASK_STATUS_LABELS[task.status] ?? task.status,
                    PRIORITY_LABELS[task.priority] ?? task.priority,
                    task.event?.name ?? '',
                    task.assignee?.fullName ?? 'Unassigned',
                    task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
                    task.estimatedHours ?? '',
                    task.actualHours ?? '',
                    task.commentCount ?? 0,
                  ]),
                ]
                downloadCsv(scope === 'mine' ? `eventship-my-tasks-${csvDateStamp()}` : `eventship-tasks-${csvDateStamp()}`, rows)
                toast({ title: 'Export ready', description: `${tasks.length} task(s) exported to CSV.` })
              }}
              disabled={tasks.length === 0}
              className="min-h-11"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            {canCreate ? (
              <Button onClick={openCreate} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New Task
              </Button>
            ) : null}
          </>
        }
      />

      {/* Scope tabs — All tasks / My tasks (lives here instead of a separate navbar entry). */}
      <div role="tablist" aria-label="Task scope" className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-border">
        <button
          role="tab"
          type="button"
          aria-selected={scope === 'all'}
          onClick={() => {
            if (scope !== 'all') navigate(ROUTES.TASKS)
          }}
          className={cn(
            'relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-sm font-medium transition-colors sm:px-4',
            scope === 'all'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ListTodo className="h-4 w-4" aria-hidden="true" />
          All tasks
          {scope === 'all' ? (
            <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-emerald-600 dark:bg-emerald-400" />
          ) : null}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={scope === 'mine'}
          onClick={() => {
            if (scope !== 'mine') navigate(ROUTES.MY_TASKS)
          }}
          className={cn(
            'relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-sm font-medium transition-colors sm:px-4',
            scope === 'mine'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UserCheck className="h-4 w-4" aria-hidden="true" />
          My tasks
          {scope === 'mine' ? (
            <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-emerald-600 dark:bg-emerald-400" />
          ) : null}
        </button>
      </div>

      {/* Phase 5 stats strip — role-scoped totals with completion rate. */}
      {stats && stats.total > 0 ? (
        <section aria-label="Task statistics" className="mb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCell icon={ListTodo} label="Total" value={stats.total} tone="stone" />
            <StatCell icon={Play} label="In Progress" value={stats.inProgress} tone="amber" />
            <StatCell icon={ShieldAlert} label="Blocked" value={stats.blocked} tone="red" />
            <StatCell icon={AlarmClock} label="Overdue" value={stats.overdue} tone="orange" />
            <StatCell icon={CheckCircle2} label="Completed" value={stats.completed} tone="emerald" />
            <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-4 shadow-sm dark:border-emerald-500/20 dark:from-emerald-500/10 dark:via-transparent dark:to-emerald-500/5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                Completion
              </div>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{stats.completionRate}%</p>
              <div
                role="progressbar"
                aria-valuenow={stats.completionRate}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${stats.completionRate}% of tasks completed`}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-500/15"
              >
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.completionRate}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Filters */}
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Task filters">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-11 pl-9"
            aria-label="Search tasks"
          />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="h-11 w-full" aria-label="Filter by event">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-full" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {TASK_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {TASK_STATUS_LABELS[status] ?? status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter} disabled={scope === 'mine'}>
          <SelectTrigger className="h-11 w-full" aria-label="Filter by assignee">
            <SelectValue placeholder="Anyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-11 w-full" aria-label="Filter by priority">
            <SelectValue placeholder="Any priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any priority</SelectItem>
            {TASK_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          aria-pressed={overdueOnly}
          className={cn(
            'inline-flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-all duration-200',
            overdueOnly
              ? 'border-red-300 bg-red-50 text-red-700 shadow-sm ring-1 ring-red-200 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20'
              : 'border-input bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          )}
        >
          <Clock className={cn('h-4 w-4', overdueOnly && 'animate-pulse')} aria-hidden="true" />
          Overdue only
        </button>
        <button
          type="button"
          onClick={() => setBlockedOnly((v) => !v)}
          aria-pressed={blockedOnly}
          className={cn(
            'inline-flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-all duration-200',
            blockedOnly
              ? 'border-red-300 bg-red-50 text-red-700 shadow-sm ring-1 ring-red-200 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20'
              : 'border-input bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          )}
        >
          <ShieldAlert className={cn('h-4 w-4', blockedOnly && 'animate-pulse')} aria-hidden="true" />
          Blocked only
          {blockedTasksCount > 0 ? (
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px] font-bold tabular-nums ring-1',
                blockedOnly
                  ? 'bg-red-600 text-white ring-red-600'
                  : 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25'
              )}
            >
              {blockedTasksCount}
            </span>
          ) : null}
        </button>
      </section>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          icon={blockedOnly ? ShieldAlert : ListTodo}
          title={blockedOnly ? 'Nothing is blocked' : 'No tasks match your filters'}
          hint={
            blockedOnly
              ? 'Every task on this board has its dependencies satisfied — nice and unblocked.'
              : 'Adjust the filters above, or create a new task to get things moving.'
          }
          action={
            canCreate ? (
              <Button onClick={openCreate} className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New Task
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'list' ? (
        /* ============ List view (Phase 5): grouped by status, urgency first ============ */
        <div className="space-y-5">
          {(['IN_PROGRESS', 'BLOCKED', 'NOT_STARTED', 'COMPLETED'] as TaskStatus[]).map((status) => {
            const sectionTasks = byStatus.get(status) ?? []
            if (sectionTasks.length === 0) return null
            return (
              <section
                key={status}
                aria-label={`${TASK_STATUS_LABELS[status]} tasks`}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              >
                <header className="flex items-center justify-between gap-2 border-b border-border/80 bg-muted/50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', COLUMN_DOT[status])} aria-hidden="true" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">{TASK_STATUS_LABELS[status]}</h3>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1',
                      COLUMN_COUNT_PILL[status]
                    )}
                  >
                    {sectionTasks.length}
                  </span>
                </header>
                <ul className="divide-y divide-border/70">
                  {sectionTasks.map((task) => {
                    const chip = dueChip(task)
                    return (
                      <li
                        key={task.id}
                        className={cn(
                          'group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40',
                          task.status === 'COMPLETED' && 'opacity-75'
                        )}
                      >
                        <span
                          onClick={(e) => e.stopPropagation()}
                          className="flex shrink-0"
                        >
                          <Checkbox
                            checked={selectedIds.has(task.id)}
                            onCheckedChange={(checked) => toggleTaskSelection(task.id, checked)}
                            aria-label={`Select task ${task.title}`}
                          />
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetailId(task.id)}
                          className={cn(
                            'min-w-0 flex-1 basis-44 text-left text-sm font-semibold text-foreground hover:text-emerald-700 dark:hover:text-emerald-300',
                            task.status === 'COMPLETED' && 'line-through decoration-stone-300'
                          )}
                        >
                          <span className="line-clamp-1">{task.title}</span>
                          {task.event ? (
                            <span className="block text-[11px] font-normal text-muted-foreground/70">{task.event.name}</span>
                          ) : null}
                        </button>
                        <span className="flex min-w-0 flex-1 basis-44 flex-wrap items-center gap-x-2 gap-y-1.5 sm:basis-0 sm:flex-nowrap sm:justify-end">
                          {chip ? (
                            <Badge variant="outline" className={cn('gap-1 text-[10px] font-normal', chip.classes)}>
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {chip.label}
                            </Badge>
                          ) : null}
                          <StatusBadge label={PRIORITY_LABELS[task.priority] ?? task.priority} className={cn('text-[10px]', PRIORITY_CLASSES[task.priority])} />
                          {(task.commentCount ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
                              <MessageSquare className="h-3 w-3" aria-hidden="true" />
                              {task.commentCount}
                            </span>
                          ) : null}
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className={cn('text-[9px] font-semibold', task.assignee ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground')}>
                              {task.assignee ? initialsOf(task.assignee.fullName) : '—'}
                            </AvatarFallback>
                          </Avatar>
                          <Select value={task.status} onValueChange={(value) => requestMove(task, value as TaskStatus)}>
                            <SelectTrigger
                              size="sm"
                              className="h-9 w-full min-w-0 sm:h-8 sm:w-36"
                              aria-label={`Change status of ${task.title}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {TASK_STATUS_LABELS[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveTask(null)
            setOverColumn(null)
          }}
          onDragOver={(event) => setOverColumn(event.over ? String(event.over.id) : null)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {TASK_STATUSES.map((status) => {
              const columnTasks = byStatus.get(status) ?? []
              return (
                <KanbanColumn key={status} status={status} count={columnTasks.length} highlight={overColumn === status}>
                  {columnTasks.map((task) => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      canDrag={isDesktop}
                      mobileStatusSelect={mobileStatusSelectFor(task)}
                      onOpen={openTaskSafe}
                      selected={selectedIds.has(task.id)}
                      onToggleSelect={toggleTaskSelection}
                    />
                  ))}
                  {columnTasks.length === 0 ? (
                    <p className="rounded-md border border-dashed border-stone-300 px-3 py-4 text-center text-xs text-muted-foreground/70">
                      {isDesktop ? 'Drop tasks here' : 'No tasks'}
                    </p>
                  ) : null}
                </KanbanColumn>
              )
            })}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="w-64 rotate-2 rounded-xl border border-border bg-card p-3 opacity-90 shadow-xl">
                <p className="line-clamp-2 text-sm font-semibold text-foreground">{activeTask.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">{activeTask.event?.name ?? ''}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ============ New task dialog ============ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a task</DialogTitle>
            <DialogDescription>Tasks belong to an event — pick the event and who should do it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4" noValidate>
            {formError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Print attendee badges"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Add details, links or acceptance criteria…"
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-event">Event</Label>
                <Select value={form.eventId} onValueChange={(value) => setForm((f) => ({ ...f, eventId: value }))}>
                  <SelectTrigger id="task-event" className="h-11 w-full" aria-label="Event">
                    <SelectValue placeholder="Choose event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={form.priority} onValueChange={(value) => setForm((f) => ({ ...f, priority: value as TaskPriority }))}>
                  <SelectTrigger id="task-priority" className="h-11 w-full" aria-label="Priority">
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assignee</Label>
                <Select value={form.assignedTo} onValueChange={(value) => setForm((f) => ({ ...f, assignedTo: value }))}>
                  <SelectTrigger id="task-assignee" className="h-11 w-full" aria-label="Assignee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-estimate">Estimated hours</Label>
                <Input
                  id="task-estimate"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.estimatedHours}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                  placeholder="e.g. 4"
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-start" className="flex items-center gap-1.5">
                  <Play className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  Start date
                </Label>
                <DateInput
                  id="task-start"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  inputClassName="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due">Due date</Label>
                <DateInput
                  id="task-due"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  inputClassName="h-11"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
                {saving ? 'Creating…' : 'Create task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ Task detail dialog ============ */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {detailLoading || !detail || !edit ? (
            <div className="space-y-4 py-2">
              {/* Radix requires a DialogTitle at mount — hidden while loading. */}
              <DialogHeader className="sr-only">
                <DialogTitle>Loading task…</DialogTitle>
                <DialogDescription>Fetching the task details.</DialogDescription>
              </DialogHeader>
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg leading-snug">{detail.title}</DialogTitle>
                <DialogDescription>
                  {detail.event?.name ?? eventNameById.get(detail.eventId) ?? 'Unknown event'} · Created{' '}
                  {format(new Date(detail.createdAt), 'MMM d, yyyy')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Editable fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title</Label>
                    <Input id="edit-title" value={edit.title} onChange={(e) => setEdit((f) => (f ? { ...f, title: e.target.value } : f))} className="h-10" disabled={!canDeleteTask} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={edit.status}
                      onValueChange={(value) => handleDetailStatusChange(value as TaskStatus)}
                    >
                      <SelectTrigger id="edit-status" className="h-10 w-full" aria-label="Status">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={edit.description}
                    onChange={(e) => setEdit((f) => (f ? { ...f, description: e.target.value } : f))}
                    rows={2}
                    disabled={!canDeleteTask}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select value={edit.priority} onValueChange={(value) => setEdit((f) => (f ? { ...f, priority: value as TaskPriority } : f))} disabled={!canDeleteTask}>
                      <SelectTrigger id="edit-priority" className="h-10 w-full" aria-label="Priority">
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
                    <Label htmlFor="edit-assignee">Assignee</Label>
                    <Select value={edit.assignedTo} onValueChange={(value) => setEdit((f) => (f ? { ...f, assignedTo: value } : f))} disabled={!canDeleteTask}>
                      <SelectTrigger id="edit-assignee" className="h-10 w-full" aria-label="Assignee">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Task 41: hour fields restored to their natural half-width
                    (the Task 40 max-w cap and 12-col split are gone) and
                    placed BELOW the Start/Due date row on every viewport —
                    desktop included. Dates always own their full-width rows. */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 min-w-0 space-y-2">
                    <Label htmlFor="edit-start" className="flex items-center gap-1">
                      <Play className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      Start
                    </Label>
                    <DateInput id="edit-start" value={edit.startDate} onChange={(e) => setEdit((f) => (f ? { ...f, startDate: e.target.value } : f))} inputClassName="h-10 dark:[color-scheme:dark]" disabled={!canDeleteTask} />
                  </div>
                  <div className="col-span-2 min-w-0 space-y-2">
                    <Label htmlFor="edit-due">Due date</Label>
                    <DateInput id="edit-due" value={edit.dueDate} onChange={(e) => setEdit((f) => (f ? { ...f, dueDate: e.target.value } : f))} inputClassName="h-10 dark:[color-scheme:dark]" disabled={!canDeleteTask} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="edit-estimate">Est. hours</Label>
                    <Input id="edit-estimate" type="number" min="0" step="0.5" value={edit.estimatedHours} onChange={(e) => setEdit((f) => (f ? { ...f, estimatedHours: e.target.value } : f))} className="h-10" disabled={!canDeleteTask} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="edit-actual">Actual hours</Label>
                    <Input id="edit-actual" type="number" min="0" step="0.5" value={edit.actualHours} onChange={(e) => setEdit((f) => (f ? { ...f, actualHours: e.target.value } : f))} className="h-10" disabled={readOnlyEditor} />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  {readOnlyEditor ? (
                    <p className="text-xs text-muted-foreground/70">Only the assignee or a manager can edit this task.</p>
                  ) : restrictedEditor ? (
                    <p className="text-xs text-muted-foreground/70">As the assignee you can update status and actual hours.</p>
                  ) : null}
                  <Button onClick={() => void handleEditSave()} className="min-h-10 bg-emerald-600 text-white hover:bg-emerald-700" disabled={editSaving || readOnlyEditor}>
                    {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>

                {/* Dependencies — mini chain with nested upstream tasks */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Dependencies
                    </p>
                    {canEditDeps ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                        onClick={() => void openDepDialog()}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Add dependency
                      </Button>
                    ) : null}
                  </div>
                  <p className="mb-2 text-[11px] text-muted-foreground/70">
                    This task waits on its dependencies before it can be completed{user?.strictDependencyGuard ? ' (your dependency guard is on)' : ''}.
                  </p>
                  {(detail.dependencies?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground/70">No dependencies.</p>
                  ) : (
                    <DependencyChain
                      taskId={detail.id}
                      dependencies={detail.dependencies ?? []}
                      onOpenTask={(id) => setDetailId(id)}
                      onRemove={canEditDeps ? (depId) => void handleRemoveDependency(depId) : undefined}
                      removingDepId={removingDepId}
                    />
                  )}
                </div>

                <Separator />

                {/* Comments */}
                <section aria-label="Comments">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    Comments ({detail.comments?.length ?? 0})
                  </p>
                  <div className="scrollbar-thin max-h-64 space-y-3 overflow-y-auto pr-1">
                    {(detail.comments?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground/70">No comments yet — start the discussion.</p>
                    ) : (
                      detail.comments?.map((c) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-start gap-2.5"
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                              {c.user ? initialsOf(c.user.fullName) : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-stone-100">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-semibold text-foreground">{c.user?.fullName ?? 'Unknown'}</span>
                              {c.user ? (
                                <Badge variant="outline" className={cn('text-[9px]', ROLE_BADGE_CLASSES[c.user.role])}>
                                  {ROLE_LABELS[c.user.role] ?? c.user.role}
                                </Badge>
                              ) : null}
                              <span className="ml-auto text-[10px] text-muted-foreground/70">
                                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                              </span>
                              {user && c.userId === user.id ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteComment(c.id)}
                                  disabled={deletingCommentId === c.id}
                                  className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                                  aria-label={`Delete your comment`}
                                  title="Delete comment"
                                >
                                  {deletingCommentId === c.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm leading-snug text-foreground">{c.content}</p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {typers.length > 0 ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                      <span className="flex items-end gap-0.5" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" />
                      </span>
                      <span className="truncate">
                        {typers.map((t) => t.fullName).join(', ')} {typers.length === 1 ? 'is' : 'are'} typing…
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-end gap-2">
                    <Textarea
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value)
                        notifyTyping()
                      }}
                      placeholder="Write a comment…"
                      rows={2}
                      className="min-h-11 flex-1"
                      aria-label="New comment"
                    />
                    <Button
                      onClick={() => void handleAddComment()}
                      className="min-h-11 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                      disabled={commentSending || !comment.trim()}
                      aria-label="Send comment"
                    >
                      {commentSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                  </div>
                </section>
              </div>

              <DialogFooter className="border-t border-border/60 pt-3 sm:justify-between">
                {canDeleteTask ? (
                  <Button
                    variant="outline"
                    className="min-h-11 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-700"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Delete task
                  </Button>
                ) : (
                  <p className="max-w-[16rem] text-xs leading-snug text-muted-foreground/70">
                    Only the creator, the owning team leader, or an event manager can delete this task.
                  </p>
                )}
                <Button variant="ghost" className="min-h-11" onClick={() => setDetailId(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ Delete confirm ============ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{detail?.title}” will be permanently removed along with its comments. This action cannot be undone.
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
              {deleting ? 'Deleting…' : 'Delete task'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ Phase 5: blocker-reason modal (TaskStatusUpdateModal) ============ */}
      <Dialog
        open={pendingMove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMove(null)
            setMoveNote('')
            setMoveNoteError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </span>
              Why is this task blocked?
            </DialogTitle>
            <DialogDescription>
              Blocked tasks need a reason so teammates know what is wrong and who can unblock it. The note is posted as a
              comment on the task.
            </DialogDescription>
          </DialogHeader>

          {pendingMove ? (
            <div className="space-y-4">
              {/* From → To summary */}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <StatusBadge
                  label={TASK_STATUS_LABELS[pendingMove.task.status] ?? pendingMove.task.status}
                  className={cn('text-[10px]', TASK_STATUS_CLASSES[pendingMove.task.status])}
                />
                <span className="text-muted-foreground" aria-hidden="true">
                  →
                </span>
                <StatusBadge
                  label={TASK_STATUS_LABELS[pendingMove.status] ?? pendingMove.status}
                  className={cn('text-[10px]', TASK_STATUS_CLASSES[pendingMove.status])}
                />
                <span className="ml-1 line-clamp-1 min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {pendingMove.task.title}
                </span>
              </div>

              {moveNoteError ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{moveNoteError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="move-note">Reason (required)</Label>
                  <span className={cn('text-[10px] tabular-nums', moveNote.length > 450 ? 'text-red-600' : 'text-muted-foreground/60')}>
                    {moveNote.length}/500
                  </span>
                </div>
                <Textarea
                  id="move-note"
                  value={moveNote}
                  onChange={(e) => {
                    setMoveNote(e.target.value)
                    if (moveNoteError) setMoveNoteError(null)
                  }}
                  placeholder="e.g. Waiting for venue confirmation, budget not approved…"
                  rows={4}
                  maxLength={500}
                  aria-invalid={Boolean(moveNoteError)}
                  aria-describedby="move-note-hint"
                />
                <p id="move-note-hint" className="text-[11px] text-muted-foreground/70">
                  Posted as a comment from you — the task creator and assignee are notified.
                </p>
              </div>

              <DialogFooter className="gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setPendingMove(null)
                    setMoveNote('')
                    setMoveNoteError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleMoveNoteSubmit()}
                  disabled={moveNoteSaving || !moveNote.trim()}
                  className="min-h-11 bg-red-600 text-white hover:bg-red-700"
                >
                  {moveNoteSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {moveNoteSaving ? 'Moving…' : 'Mark as blocked'}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ============ Phase 5: add-dependency picker ============ */}
      <Dialog open={depDialogOpen} onOpenChange={setDepDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a dependency</DialogTitle>
            <DialogDescription>
              Pick a task from the same event that must finish first. Circular chains are rejected automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {depCandidatesLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading tasks in this event…
              </div>
            ) : (depCandidates?.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-300 px-3 py-6 text-center text-sm text-muted-foreground/70">
                Every other task in this event is already a dependency.
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="dep-select">Task this one waits on</Label>
                <Select value={depSelected} onValueChange={setDepSelected}>
                  <SelectTrigger id="dep-select" className="h-11 w-full" aria-label="Dependency task">
                    <SelectValue placeholder="Choose a task…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {depCandidates?.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        <span className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', COLUMN_DOT[candidate.status])} aria-hidden="true" />
                          <span className="line-clamp-1">{candidate.title}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {depSelected ? (
                  <p className="text-[11px] text-muted-foreground/70">
                    “{detail?.title}” cannot be completed until the selected task is completed.
                  </p>
                ) : null}
              </div>
            )}
            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setDepDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleAddDependency()}
                disabled={!depSelected || depSaving}
                className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {depSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {depSaving ? 'Adding…' : 'Add dependency'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ Bulk action bar ============ */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <AnimatePresence>
          {selectedIds.size > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-stone-700/60 bg-stone-900/95 px-3 py-2.5 text-stone-100 shadow-2xl ring-1 ring-black/10 backdrop-blur"
              role="toolbar"
              aria-label={`Bulk actions for ${selectedIds.size} selected task(s)`}
            >
              <span className="inline-flex items-center gap-2 pl-1 pr-1 text-sm font-semibold">
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-white">
                  {selectedIds.size}
                </span>
                selected
              </span>

              <span className="mx-1 hidden h-6 w-px bg-stone-700 sm:block" aria-hidden="true" />

              <Select
                value=""
                onValueChange={(value) => void runBulkAction('status', { status: value as TaskStatus })}
                disabled={bulkApplying}
              >
                <SelectTrigger
                  size="sm"
                  className="h-9 w-32 border-stone-700 bg-stone-800/80 text-stone-100 data-[size=sm]:h-9 [&>svg]:text-stone-400"
                  aria-label="Set status for selected tasks"
                >
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TASK_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value=""
                onValueChange={(value) => void runBulkAction('priority', { priority: value as TaskPriority })}
                disabled={bulkApplying}
              >
                <SelectTrigger
                  size="sm"
                  className="h-9 w-36 border-stone-700 bg-stone-800/80 text-stone-100 data-[size=sm]:h-9 [&>svg]:text-stone-400"
                  aria-label="Set priority for selected tasks"
                >
                  <SelectValue placeholder="Set priority" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value=""
                onValueChange={(value) => {
                  if (value === UNASSIGNED) void runBulkAction('unassign')
                  else void runBulkAction('assign', { assignedTo: value })
                }}
                disabled={bulkApplying}
              >
                <SelectTrigger
                  size="sm"
                  className="h-9 w-36 border-stone-700 bg-stone-800/80 text-stone-100 data-[size=sm]:h-9 [&>svg]:text-stone-400"
                  aria-label="Assign selected tasks"
                >
                  <SelectValue placeholder="Assign to…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="mx-1 hidden h-6 w-px bg-stone-700 sm:block" aria-hidden="true" />

              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-red-400 hover:bg-red-500/15 hover:text-red-300"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={bulkApplying}
                aria-label="Delete selected tasks"
              >
                {bulkApplying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                <span className="ml-1.5 hidden md:inline">Delete</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-stone-400 hover:bg-stone-800 hover:text-stone-100"
                onClick={() => setSelectedIds(new Set())}
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ============ Bulk delete confirm ============ */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} task(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected tasks and all of their comments will be permanently removed. Tasks you do not have permission
              to delete will be skipped. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void runBulkAction('delete')
              }}
              className="min-h-11 bg-red-600 text-white hover:bg-red-700"
              disabled={bulkApplying}
            >
              {bulkApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />}
              {bulkApplying ? 'Deleting…' : `Delete ${selectedIds.size} task(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
