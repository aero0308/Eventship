'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock,
  ListPlus,
  ListTodo,
  LogIn,
  MessageSquare,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { differenceInCalendarDays, format, formatDistanceToNow } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActivityLogDTO, DashboardStatsDTO, EventDTO, TaskDTO } from '@/types'
import {
  EVENT_STATUS_CLASSES,
  EVENT_STATUS_LABELS,
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  ROUTES,
  TASK_STATUS_LABELS,
} from '@/lib/constants'
import { api } from '@/lib/api-client'
import { navigate } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { initialsOf } from '@/components/layout/Layout'

const STATUS_CHART_COLORS: Record<string, string> = {
  NOT_STARTED: '#a8a29e', // stone-400
  IN_PROGRESS: '#f59e0b', // amber-500
  BLOCKED: '#ef4444', // red-500
  COMPLETED: '#10b981', // emerald-500
}

const PRIORITY_CHART_COLORS: Record<string, string> = {
  HIGH: '#ef4444', // red-500
  MEDIUM: '#f59e0b', // amber-500
  LOW: '#a8a29e', // stone-400
}

const ACTIVITY_ICONS: Record<string, { icon: LucideIcon; classes: string }> = {
  USER_REGISTERED: { icon: UserPlus, classes: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  USER_LOGIN: { icon: LogIn, classes: 'bg-muted text-muted-foreground' },
  TEAM_CREATED: { icon: Users, classes: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  TEAM_UPDATED: { icon: Users, classes: 'bg-muted text-muted-foreground' },
  EVENT_CREATED: { icon: CalendarPlus, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  EVENT_UPDATED: { icon: CalendarDays, classes: 'bg-muted text-muted-foreground' },
  EVENT_STATUS_CHANGED: { icon: RefreshCw, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  TASK_CREATED: { icon: ListPlus, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  TASK_ASSIGNED: { icon: UserPlus, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  TASK_STATUS_CHANGED: { icon: RefreshCw, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  TASK_COMPLETED: { icon: CheckCircle2, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  COMMENT_ADDED: { icon: MessageSquare, classes: 'bg-muted text-muted-foreground' },
}

const ACTIVITY_TEXT: Record<string, string> = {
  USER_REGISTERED: 'joined the workspace',
  USER_LOGIN: 'signed in',
  TEAM_CREATED: 'created a team',
  TEAM_UPDATED: 'updated a team',
  EVENT_CREATED: 'created an event',
  EVENT_UPDATED: 'updated an event',
  EVENT_STATUS_CHANGED: 'changed an event status',
  TASK_CREATED: 'created a task',
  TASK_ASSIGNED: 'assigned a task',
  TASK_STATUS_CHANGED: 'changed a task status',
  TASK_COMPLETED: 'completed a task',
  COMMENT_ADDED: 'added a comment',
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

type FocusKey = 'dueToday' | 'dueThisWeek' | 'overdue'

const FOCUS_META: Record<FocusKey, { label: string; hint: string; dot: string; activeChip: string }> = {
  dueToday: {
    label: 'Due today',
    hint: 'Deadline is today',
    dot: 'bg-amber-500',
    activeChip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  },
  dueThisWeek: {
    label: 'Due next 7 days',
    hint: 'Coming up this week',
    dot: 'bg-emerald-500',
    activeChip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
  overdue: {
    label: 'Overdue',
    hint: 'Past the deadline',
    dot: 'bg-red-500',
    activeChip: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
}

function focusDueLabel(dueDate: string | null): string {
  if (!dueDate) return 'No due date'
  const diff = differenceInCalendarDays(new Date(dueDate), new Date())
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (diff < 0) return `Overdue by ${Math.abs(diff)}d`
  return `Due ${format(new Date(dueDate), 'EEE, MMM d')}`
}

function FocusStrip({
  myFocus,
  scope,
  pending,
  onScopeChange,
}: {
  myFocus: DashboardStatsDTO['myFocus']
  scope: 'all' | 'mine'
  pending: boolean
  onScopeChange: (scope: 'all' | 'mine') => void
}) {
  const [open, setOpen] = useState<FocusKey | null>(null)

  const buckets: { key: FocusKey; count: number; tasks: TaskDTO[] }[] = [
    { key: 'dueToday', count: myFocus.dueToday.count, tasks: myFocus.dueToday.tasks },
    { key: 'dueThisWeek', count: myFocus.dueThisWeek.count, tasks: myFocus.dueThisWeek.tasks },
    { key: 'overdue', count: myFocus.overdue.count, tasks: myFocus.overdue.tasks },
  ]
  const active = buckets.find((b) => b.key === open) ?? null

  return (
    <section
      aria-label="My focus"
      className={cn(
        'overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 via-card to-amber-50 shadow-sm transition-opacity dark:border-emerald-500/20 dark:from-emerald-500/10 dark:via-card dark:to-amber-500/10',
        pending && 'opacity-60'
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">My focus</h2>
            <p className="text-xs text-muted-foreground">Tap a bucket to see what needs attention.</p>
          </div>
        </div>
        {/* Scope toggle: everyone's tasks vs. only mine */}
        <div
          className="inline-flex h-8 shrink-0 items-center rounded-full border border-border/70 bg-card/80 p-0.5"
          role="group"
          aria-label="Focus scope"
        >
          {(
            [
              { value: 'all', label: 'All tasks', icon: Users },
              { value: 'mine', label: 'Mine only', icon: UserCheck },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scope === option.value}
              onClick={() => onScopeChange(option.value)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-all',
                scope === option.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <option.icon className="h-3 w-3" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-start gap-2 sm:justify-end" role="group" aria-label="Focus buckets">
          {buckets.map((bucket) => {
            const meta = FOCUS_META[bucket.key]
            const isActive = open === bucket.key
            return (
              <button
                key={bucket.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setOpen(isActive ? null : bucket.key)}
                className={cn(
                  'group flex min-h-11 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition-all',
                  isActive
                    ? 'border-transparent shadow-sm ' + meta.activeChip
                    : 'border-border/70 bg-card/80 text-foreground hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:hover:border-emerald-500/40'
                )}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot, bucket.count === 0 && 'opacity-30')} aria-hidden="true" />
                <span className="text-xl font-bold leading-none tabular-nums">{bucket.count}</span>
                <span className="text-xs font-medium leading-tight">{meta.label}</span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 shrink-0 opacity-50 transition-transform', isActive && 'rotate-180 opacity-80')}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {active ? (
          <motion.div
            key={active.key}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border/60 bg-card/60"
          >
            {active.tasks.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">Nothing here right now — enjoy the calm.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto" role="list">
                {active.tasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/events/${task.eventId}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-500/10"
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', task.priority === 'HIGH' ? 'bg-red-500' : task.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-stone-400')}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{task.title}</span>
                      {task.event ? (
                        <span className="hidden max-w-44 truncate text-xs text-muted-foreground sm:block">{task.event.name}</span>
                      ) : null}
                      {task.assignee ? (
                        <span className="hidden text-xs text-muted-foreground md:block">{task.assignee.fullName}</span>
                      ) : null}
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          active.key === 'overdue'
                            ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                            : active.key === 'dueToday'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
                              : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {focusDueLabel(task.dueDate)}
                      </span>
                      <span className={cn('hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex', PRIORITY_CLASSES[task.priority] ?? '')}>
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {active.count > active.tasks.length ? (
              <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                Showing {active.tasks.length} of {active.count} — {FOCUS_META[active.key].hint.toLowerCase()}
                {' · '}
                <button type="button" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300" onClick={() => navigate(ROUTES.CALENDAR)}>
                  View calendar
                </button>
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<DashboardStatsDTO | null>(null)
  const [loading, setLoading] = useState(true)

  // Focus strip scope — "All tasks" or "Mine only". Persisted per browser.
  const [focusScope, setFocusScope] = useState<'all' | 'mine'>(() => {
    if (typeof window === 'undefined') return 'all'
    return window.localStorage.getItem('ems-focus-scope') === 'mine' ? 'mine' : 'all'
  })
  const [focusPending, setFocusPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ stats: DashboardStatsDTO }>(`/dashboard${focusScope === 'mine' ? '?focus=mine' : ''}`)
      .then((data) => {
        if (!cancelled) setStats(data.stats)
      })
      .catch(() => {
        // Rendered empty state handles null stats below.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setFocusPending(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [focusScope])

  const handleFocusScopeChange = (scope: 'all' | 'mine') => {
    if (scope === focusScope) return
    setFocusScope(scope)
    setFocusPending(true)
    try {
      window.localStorage.setItem('ems-focus-scope', scope)
    } catch {
      // Storage unavailable — the toggle still works for this session.
    }
  }

  const statusData = useMemo(
    () => (stats?.tasksByStatus ?? []).map((entry) => ({ name: TASK_STATUS_LABELS[entry.status] ?? entry.status, count: entry.count, key: entry.status })),
    [stats]
  )

  const priorityData = useMemo(
    () => (stats?.tasksByPriority ?? []).map((entry) => ({ name: PRIORITY_LABELS[entry.priority] ?? entry.priority, value: entry.count, key: entry.priority })),
    [stats]
  )

  const openTasks = stats ? stats.totals.tasks - stats.totals.completedTasks : 0

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={user ? `${greeting()}, ${user.fullName} — here's what's happening across your events.` : "Here's what's happening across your events."}
      />

      {/* ============ My focus strip ============ */}
      {loading ? (
        <Skeleton className="h-20 rounded-2xl" />
      ) : stats ? (
        <div className="mt-1 mb-4">
          <FocusStrip
            myFocus={stats.myFocus}
            scope={focusScope}
            pending={focusPending}
            onScopeChange={handleFocusScopeChange}
          />
        </div>
      ) : null}

      {/* ============ Stat cards ============ */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key statistics">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={CalendarDays}
              label="Active Events"
              value={stats.totals.activeEvents}
              sub={`${stats.totals.events} events in total`}
              tint="emerald"
            />
            <StatCard
              icon={ListTodo}
              label="Open Tasks"
              value={openTasks}
              sub={`${stats.totals.tasks} tasks tracked overall`}
              tint="amber"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats.totals.completedTasks}
              sub={`${Math.round(stats.completionRate)}% completion rate`}
              tint="stone"
              progress={stats.completionRate}
            />
            <StatCard
              icon={AlertTriangle}
              label="Blocked"
              value={stats.totals.blockedTasks}
              sub={stats.totals.blockedTasks > 0 ? 'Needs immediate attention' : 'Nothing blocked — nice!'}
              tint="red"
            />
          </>
        )}
      </section>

      {/* ============ Charts ============ */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Task charts">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : statusData.every((d) => d.count === 0) ? (
              <EmptyState icon={ListTodo} title="No tasks yet" hint="Create tasks to see the status breakdown here." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--card)',
                        color: 'var(--foreground)',
                        fontSize: 13,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                      }}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 2 }}
                      itemStyle={{ color: 'var(--muted-foreground)' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {statusData.map((entry) => (
                        <Cell key={entry.key} fill={STATUS_CHART_COLORS[entry.key] ?? '#78716c'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by priority</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : priorityData.every((d) => d.value === 0) ? (
              <EmptyState icon={ListTodo} title="No tasks yet" hint="Priorities will appear once tasks exist." />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2 sm:flex-row">
                <div className="h-52 w-full max-w-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={2}>
                        {priorityData.map((entry) => (
                          <Cell key={entry.key} fill={PRIORITY_CHART_COLORS[entry.key] ?? '#a8a29e'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--card)',
                          color: 'var(--foreground)',
                          fontSize: 13,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                        }}
                        labelStyle={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 2 }}
                        itemStyle={{ color: 'var(--muted-foreground)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5">
                  {priorityData.map((entry) => (
                    <li key={entry.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PRIORITY_CHART_COLORS[entry.key] ?? '#a8a29e' }} aria-hidden="true" />
                      {entry.name}
                      <span className="font-semibold text-foreground">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ============ Upcoming events & deadlines ============ */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Upcoming work">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming events</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !stats || stats.upcomingEvents.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No upcoming events" hint="Events starting today or later will show up here." />
            ) : (
              <ul className="scrollbar-thin max-h-80 space-y-3 overflow-y-auto pr-1">
                {stats.upcomingEvents.map((event: EventDTO) => {
                  const start = new Date(event.startDate)
                  const total = event.taskStats?.total ?? event.taskCount ?? 0
                  const completed = event.taskStats?.completed ?? 0
                  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
                  return (
                    <li key={event.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-1 ring-emerald-100">
                        <span className="text-[10px] font-semibold uppercase leading-none">{format(start, 'MMM')}</span>
                        <span className="text-lg font-bold leading-tight">{format(start, 'd')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{event.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn('text-[10px]', EVENT_STATUS_CLASSES[event.status])}>
                            {EVENT_STATUS_LABELS[event.status] ?? event.status}
                          </Badge>
                          {event.team ? <Badge variant="outline" className="border-border bg-muted/50 text-[10px] text-muted-foreground">{event.team.name}</Badge> : null}
                        </div>
                      </div>
                      <div className="hidden w-28 shrink-0 sm:block">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Tasks</span>
                          <span>
                            {completed}/{total}
                          </span>
                        </div>
                        <Progress value={percent} className="mt-1 h-1.5" aria-label={`${percent}% tasks completed`} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-300"
              onClick={() => navigate(ROUTES.CALENDAR)}
            >
              <CalendarRange className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              View calendar
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !stats || stats.upcomingDeadlines.length === 0 ? (
              <EmptyState icon={Clock} title="No deadlines ahead" hint="Tasks with due dates will appear here." />
            ) : (
              <ul className="scrollbar-thin max-h-80 space-y-3 overflow-y-auto pr-1">
                {stats.upcomingDeadlines.map((task: TaskDTO) => {
                  const days = task.dueDate ? differenceInCalendarDays(new Date(task.dueDate), new Date()) : null
                  const overdue = days !== null && days < 0
                  const urgent = days !== null && days >= 0 && days < 3
                  return (
                    <li key={task.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.event?.name ?? 'Unknown event'}</p>
                      </div>
                      {days !== null ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0 text-[11px]',
                            overdue
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : urgent
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-border bg-muted/50 text-muted-foreground'
                          )}
                        >
                          {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
                        </Badge>
                      ) : null}
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
                        title={task.assignee?.fullName ?? 'Unassigned'}
                        aria-label={task.assignee ? `Assigned to ${task.assignee.fullName}` : 'Unassigned'}
                      >
                        {task.assignee ? initialsOf(task.assignee.fullName) : '—'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ============ Team workload & activity ============ */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Team workload and activity">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team workload</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : !stats || stats.teamWorkload.length === 0 ? (
              <EmptyState icon={Users} title="No team data" hint="Create teams and assign tasks to see workload." />
            ) : (
              <ul className="space-y-4">
                {stats.teamWorkload.map((team) => {
                  const total = team.openTasks + team.completedTasks
                  const donePercent = total > 0 ? (team.completedTasks / total) * 100 : 0
                  return (
                    <li key={team.teamId}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-foreground">{team.teamName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          <span className="font-semibold text-amber-700">{team.openTasks} open</span>
                          {' · '}
                          <span className="font-semibold text-emerald-700">{team.completedTasks} done</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${team.teamName}: ${team.openTasks} open, ${team.completedTasks} completed`}>
                        <div className="h-full bg-amber-400" style={{ width: `${100 - donePercent}%` }} />
                        <div className="h-full bg-emerald-500" style={{ width: `${donePercent}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : !stats || stats.recentActivity.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="No activity yet" hint="Actions across the workspace will appear here." />
            ) : (
              <ul className="scrollbar-thin max-h-72 space-y-3 overflow-y-auto pr-1">
                {stats.recentActivity.map((activity: ActivityLogDTO) => {
                  const style = ACTIVITY_ICONS[activity.action] ?? ACTIVITY_ICONS.USER_LOGIN
                  const Icon = style.icon
                  return (
                    <li key={activity.id} className="flex items-start gap-3">
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', style.classes)}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-foreground">
                          <span className="font-semibold text-foreground">{activity.user?.fullName ?? 'Someone'}</span>{' '}
                          {ACTIVITY_TEXT[activity.action] ?? activity.action.toLowerCase().replace(/_/g, ' ')}
                          {activity.details ? <span className="text-muted-foreground"> — {activity.details}</span> : null}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
