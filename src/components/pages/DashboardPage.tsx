'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ListPlus,
  ListTodo,
  LogIn,
  MessageSquare,
  RefreshCw,
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
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '@/lib/constants'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  USER_REGISTERED: { icon: UserPlus, classes: 'bg-teal-100 text-teal-700' },
  USER_LOGIN: { icon: LogIn, classes: 'bg-stone-100 text-stone-600' },
  TEAM_CREATED: { icon: Users, classes: 'bg-teal-100 text-teal-700' },
  TEAM_UPDATED: { icon: Users, classes: 'bg-stone-100 text-stone-600' },
  EVENT_CREATED: { icon: CalendarPlus, classes: 'bg-emerald-100 text-emerald-700' },
  EVENT_UPDATED: { icon: CalendarDays, classes: 'bg-stone-100 text-stone-600' },
  EVENT_STATUS_CHANGED: { icon: RefreshCw, classes: 'bg-amber-100 text-amber-700' },
  TASK_CREATED: { icon: ListPlus, classes: 'bg-emerald-100 text-emerald-700' },
  TASK_ASSIGNED: { icon: UserPlus, classes: 'bg-amber-100 text-amber-700' },
  TASK_STATUS_CHANGED: { icon: RefreshCw, classes: 'bg-amber-100 text-amber-700' },
  TASK_COMPLETED: { icon: CheckCircle2, classes: 'bg-emerald-100 text-emerald-700' },
  COMMENT_ADDED: { icon: MessageSquare, classes: 'bg-stone-100 text-stone-600' },
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

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<DashboardStatsDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ stats: DashboardStatsDTO }>('/dashboard')
      .then((data) => {
        if (!cancelled) setStats(data.stats)
      })
      .catch(() => {
        // Rendered empty state handles null stats below.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(16,185,129,0.06)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 13 }} />
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
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5">
                  {priorityData.map((entry) => (
                    <li key={entry.key} className="flex items-center gap-2 text-sm text-stone-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PRIORITY_CHART_COLORS[entry.key] ?? '#a8a29e' }} aria-hidden="true" />
                      {entry.name}
                      <span className="font-semibold text-stone-900">{entry.value}</span>
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
                    <li key={event.id} className="flex items-center gap-3 rounded-lg border border-stone-200 p-3">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                        <span className="text-[10px] font-semibold uppercase leading-none">{format(start, 'MMM')}</span>
                        <span className="text-lg font-bold leading-tight">{format(start, 'd')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-900">{event.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn('text-[10px]', EVENT_STATUS_CLASSES[event.status])}>
                            {EVENT_STATUS_LABELS[event.status] ?? event.status}
                          </Badge>
                          {event.team ? <Badge variant="outline" className="border-stone-200 bg-stone-50 text-[10px] text-stone-600">{event.team.name}</Badge> : null}
                        </div>
                      </div>
                      <div className="hidden w-28 shrink-0 sm:block">
                        <div className="flex items-center justify-between text-[10px] text-stone-500">
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
          <CardHeader>
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
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
                    <li key={task.id} className="flex items-center gap-3 rounded-lg border border-stone-200 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-900">{task.title}</p>
                        <p className="mt-0.5 truncate text-xs text-stone-500">{task.event?.name ?? 'Unknown event'}</p>
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
                                : 'border-stone-200 bg-stone-50 text-stone-600'
                          )}
                        >
                          {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
                        </Badge>
                      ) : null}
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[10px] font-semibold text-stone-600"
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
                        <span className="truncate font-medium text-stone-800">{team.teamName}</span>
                        <span className="shrink-0 text-xs text-stone-500">
                          <span className="font-semibold text-amber-700">{team.openTasks} open</span>
                          {' · '}
                          <span className="font-semibold text-emerald-700">{team.completedTasks} done</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`${team.teamName}: ${team.openTasks} open, ${team.completedTasks} completed`}>
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
                        <p className="text-sm leading-snug text-stone-700">
                          <span className="font-semibold text-stone-900">{activity.user?.fullName ?? 'Someone'}</span>{' '}
                          {ACTIVITY_TEXT[activity.action] ?? activity.action.toLowerCase().replace(/_/g, ' ')}
                          {activity.details ? <span className="text-stone-500"> — {activity.details}</span> : null}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-400">
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
