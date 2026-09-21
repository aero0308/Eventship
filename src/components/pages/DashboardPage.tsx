'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock,
  ListTodo,
  MapPin,
  RefreshCw,
  Sparkles,
  Siren,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { differenceInCalendarDays, format, formatDistanceToNow } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActivityLogDTO, DashboardStatsDTO, EventDTO, ProgressOverTimeDTO, TaskDTO } from '@/types'
import { getRealtimeSocket, type RealtimeDataEcho } from '@/lib/realtime-client'
import { useTheme } from 'next-themes'
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
import { useIsMobile } from '@/hooks/use-mobile'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { ActivityItem } from '@/components/shared/ActivityFeed'
import { initialsOf } from '@/components/layout/Layout'

const STATUS_CHART_COLORS: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    NOT_STARTED: '#a8a29e', // stone-400
    IN_PROGRESS: '#f59e0b', // amber-500
    BLOCKED: '#ef4444', // red-500
    COMPLETED: '#10b981', // emerald-500
  },
  // Dark theme: the exact sRGB equivalents of the calibrated .dark oklch
  // palette in globals.css (balance pass) — clearly lively, never neon.
  dark: {
    NOT_STARTED: '#9c9890',
    IN_PROGRESS: '#f2b100',
    BLOCKED: '#fb7570',
    COMPLETED: '#2acf94',
  },
}

/** Progress-trend series colors (created / completed / cumulative), per theme. */
const TREND_COLORS: Record<'light' | 'dark', { created: string; completed: string; cumulative: string }> = {
  light: { created: '#f59e0b', completed: '#10b981', cumulative: '#78716c' },
  dark: { created: '#f2b100', completed: '#2acf94', cumulative: '#a9a49b' },
}

const PRIORITY_CHART_COLORS: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    HIGH: '#ef4444', // red-500
    MEDIUM: '#f59e0b', // amber-500
    LOW: '#a8a29e', // stone-400
  },
  dark: {
    HIGH: '#fb7570',
    MEDIUM: '#f2b100',
    LOW: '#9c9890',
  },
}

/** Theme-aware chart palette (defaults to light until next-themes mounts). */
function useChartScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark' ? 'dark' : 'light'
}

/** Outer → inner ring order for the priority rings (most critical first). */
const PRIORITY_RING_ORDER = ['HIGH', 'MEDIUM', 'LOW'] as const

/** Deterministic avatar tone per team name (stable across renders/visits). */
const TEAM_TONES = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
]

function teamTone(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997
  return TEAM_TONES[hash % TEAM_TONES.length]
}

/** Completion pill tone: emerald when mostly done, amber when started, neutral at 0. */
function completionPill(percent: number): string {
  if (percent >= 75) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (percent > 0) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}

// ============ Priority rings (concentric activity-style donut) ============

interface RingEntry {
  key: string
  name: string
  value: number
}

/**
 * Concentric "activity rings" for the priority breakdown: one ring per
 * priority (HIGH outer → LOW inner), each filled by its share of all tasks,
 * with the total count in the middle. Animated on mount, respects colors
 * from PRIORITY_CHART_COLORS.
 */
function PriorityRings({ data, compact = false }: { data: RingEntry[]; compact?: boolean }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0)
  // Smaller canvas on phones so the rings + legend stack stays inside the card.
  const size = compact ? 168 : 208
  const stroke = compact ? 13 : 15
  const ringGap = compact ? 8 : 9
  const scheme = useChartScheme()
  const colors = PRIORITY_CHART_COLORS[scheme]

  const rings = data.map((entry, index) => {
    const radius = size / 2 - stroke / 2 - index * (stroke + ringGap)
    const circumference = 2 * Math.PI * radius
    return {
      ...entry,
      radius,
      circumference,
      share: total > 0 ? entry.value / total : 0,
    }
  })

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full -rotate-90"
        role="img"
        aria-label={`Priority breakdown of ${total} tasks: ${data
          .map((entry) => `${entry.value} ${entry.name.toLowerCase()}`)
          .join(', ')}`}
      >
        {rings.map((ring) => (
          <g key={ring.key}>
            {/* Track */}
            <circle cx={size / 2} cy={size / 2} r={ring.radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
            {/* Value arc — starts at 12 o'clock (svg rotated -90°) */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={ring.radius}
              fill="none"
              stroke={colors[ring.key] ?? '#a8a29e'}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={ring.circumference}
              initial={{ strokeDashoffset: ring.circumference }}
              animate={{ strokeDashoffset: ring.circumference * (1 - ring.share) }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
            />
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className={cn('font-bold leading-none tabular-nums text-foreground', compact ? 'text-[1.65rem]' : 'text-[2rem]')}>{total}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">tasks</span>
      </div>
    </div>
  )
}

/** Legend row for the priority rings: dot, label, count, share % and a mini bar. */
function PriorityLegendRow({ entry, total }: { entry: RingEntry; total: number }) {
  const share = total > 0 ? Math.round((entry.value / total) * 100) : 0
  const scheme = useChartScheme()
  const color = PRIORITY_CHART_COLORS[scheme][entry.key] ?? '#a8a29e'
  return (
    <li className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="text-muted-foreground">{entry.name}</span>
        <span className="ml-auto font-semibold tabular-nums text-foreground">{entry.value}</span>
        <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{share}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${share}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </li>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// ============ Phase 6: 30-day progress trend chart ============

const TREND_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--card)',
  color: 'var(--foreground)',
  fontSize: 13,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

/**
 * Created vs. completed per day over the last 30 days, plus the cumulative
 * completed line (Phase 6 "progress over time"). Series colors follow the
 * active theme so nothing glows on the dark canvas.
 */
function ProgressTrendChart({ data, scheme }: { data: ProgressOverTimeDTO[]; scheme: 'light' | 'dark' }) {
  const colors = TREND_COLORS[scheme]
  const isMobile = useIsMobile()
  const chartData = data.map((day) => ({
    date: format(new Date(`${day.date}T00:00:00`), 'MMM d'),
    Created: day.created,
    Completed: day.completed,
    'Total done': day.cumulativeCompleted,
  }))

  const totalCreated = data.reduce((sum, day) => sum + day.created, 0)
  const totalCompleted = data.reduce((sum, day) => sum + day.completed, 0)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.created }} /> Created ({totalCreated})</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.completed }} /> Completed ({totalCompleted})</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: colors.cumulative }} /> Total done</span>
      </div>
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: isMobile ? 14 : 8, left: isMobile ? -8 : -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            {/* Mobile: sparser ticks (every 9th day), smaller type and a slim
                Y-axis so 30 data points breathe instead of colliding. */}
            <XAxis
              dataKey="date"
              tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval={isMobile ? 9 : 4}
            />
            <YAxis
              allowDecimals={false}
              width={isMobile ? 30 : 40}
              tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={TREND_TOOLTIP_STYLE} labelStyle={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 2 }} itemStyle={{ color: 'var(--muted-foreground)' }} />
            <Line type="monotone" dataKey="Created" stroke={colors.created} strokeWidth={isMobile ? 1.8 : 2} dot={false} activeDot={{ r: 3 }} />
            <Line type="monotone" dataKey="Completed" stroke={colors.completed} strokeWidth={isMobile ? 1.8 : 2} dot={false} activeDot={{ r: 3 }} />
            <Line type="monotone" dataKey="Total done" stroke={colors.cumulative} strokeWidth={isMobile ? 1.8 : 2} strokeDasharray="5 5" dot={false} activeDot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
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
        {/* Mobile: header + scope toggle share one row (the sm:contents trick
            restores the original side-by-side flow on larger screens). */}
        <div className="flex items-center justify-between gap-3 sm:contents">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">My focus</h2>
              <p className="hidden text-xs text-muted-foreground sm:block">Tap a bucket to see what needs attention.</p>
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
        </div>
        {/* Mobile: three equal buckets on one row; sm+: inline chips, end-aligned */}
        <div className="grid flex-1 grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-2" role="group" aria-label="Focus buckets">
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
                  'group flex min-h-11 flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2 text-left transition-all sm:flex-row sm:items-center sm:gap-2.5 sm:px-3.5',
                  isActive
                    ? 'border-transparent shadow-sm ' + meta.activeChip
                    : 'border-border/70 bg-card/80 text-foreground hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:hover:border-emerald-500/40'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot, bucket.count === 0 && 'opacity-30')} aria-hidden="true" />
                  <span className="text-lg font-bold leading-none tabular-nums sm:text-xl">{bucket.count}</span>
                </span>
                <span className="w-full text-[11px] font-medium leading-tight sm:w-auto sm:truncate sm:text-xs">{meta.label}</span>
                <ChevronDown
                  className={cn('hidden h-3.5 w-3.5 shrink-0 opacity-50 transition-transform sm:block', isActive && 'rotate-180 opacity-80')}
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
  const isMobile = useIsMobile()
  const [stats, setStats] = useState<DashboardStatsDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [, setTick] = useState(0) // re-render loop for the "updated X ago" label
  const scheme = useChartScheme()

  // Phase 6 role gating: only managers/leaders get the performance widgets.
  const canSeePerformance = user?.role === 'EVENT_MANAGER' || user?.role === 'TEAM_LEADER'

  // Focus strip scope — "All tasks" or "Mine only". Persisted per browser.
  const [focusScope, setFocusScope] = useState<'all' | 'mine'>(() => {
    if (typeof window === 'undefined') return 'all'
    return window.localStorage.getItem('ems-focus-scope') === 'mine' ? 'mine' : 'all'
  })
  const [focusPending, setFocusPending] = useState(false)

  const loadDashboard = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true)
      try {
        const data = await api.get<{ stats: DashboardStatsDTO }>(
          `/dashboard${focusScope === 'mine' ? '?focus=mine' : ''}`
        )
        setStats(data.stats)
        setLastUpdated(Date.now())
      } catch {
        // Rendered empty state handles null stats below; silent refresh keeps last data.
      } finally {
        if (!options?.silent) setLoading(false)
        setFocusPending(false)
      }
    },
    [focusScope]
  )

  // Initial load + refetch when the focus scope flips.
  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  // Phase 6: auto-refresh every 30s (skips hidden tabs) + refresh on tab return.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void loadDashboard({ silent: true })
    }, 30000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadDashboard({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadDashboard])

  // Phase 7: LIVE dashboard — the realtime service echoes every board change
  // site-wide as a minimal {room, event} hint (never the payload, so nothing
  // role-restricted leaks). Bursts are debounced into a single silent refresh;
  // the refetch goes through the role-scoped REST API.
  useEffect(() => {
    const socket = getRealtimeSocket()
    if (!socket) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const LIVE_EVENTS = new Set([
      'task:created',
      'task:updated',
      'task:deleted',
      'comment:added',
      'comment:deleted',
      'event:updated',
    ])
    const onEcho = (payload: RealtimeDataEcho) => {
      if (!LIVE_EVENTS.has(payload.event)) return
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        if (document.visibilityState === 'visible') void loadDashboard({ silent: true })
      }, 900)
    }
    socket.on('data:echo', onEcho)
    return () => {
      socket.off('data:echo', onEcho)
      if (timer) clearTimeout(timer)
    }
  }, [loadDashboard])

  // Ticker so the "Updated …" label stays honest between refreshes.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 20000)
    return () => clearInterval(timer)
  }, [])

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
    () =>
      (stats?.tasksByPriority ?? [])
        .map((entry) => ({ name: PRIORITY_LABELS[entry.priority] ?? entry.priority, value: entry.count, key: entry.priority }))
        .sort((a, b) => {
          const rank = (key: string) => {
            const index = PRIORITY_RING_ORDER.indexOf(key as (typeof PRIORITY_RING_ORDER)[number])
            return index === -1 ? PRIORITY_RING_ORDER.length : index
          }
          return rank(a.key) - rank(b.key)
        }),
    [stats]
  )

  const openTasks = stats ? stats.totals.tasks - stats.totals.completedTasks : 0
  const updatedLabel = lastUpdated
    ? Date.now() - lastUpdated < 20000
      ? 'just now'
      : `${formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}`
    : null

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          user
            ? `${greeting()}, ${user.fullName} — here's what's happening across your events.`
            : "Here's what's happening across your events."
        }
        actions={
          <>
            {updatedLabel ? (
              <span className="hidden text-xs text-muted-foreground sm:inline" title="Auto-refreshes every 30 seconds">
                Updated {updatedLabel}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => void loadDashboard()}
              disabled={loading}
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
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

      {/* ============ Stat cards (Phase 6: click-through to filtered views).
          Mobile: two compact columns (Overdue spans both) instead of five
          stacked full-width cards. ============ */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Key statistics">
        {loading || !stats ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl sm:h-32" />)}
            <Skeleton className="col-span-2 h-24 rounded-xl sm:col-span-1 sm:h-32" />
          </>
        ) : (
          <>
            <StatCard
              icon={CalendarDays}
              label="Active Events"
              value={stats.totals.activeEvents}
              sub={`${stats.totals.events} events in total`}
              tint="emerald"
              onClick={() => navigate(ROUTES.EVENTS)}
              actionLabel="View all events"
            />
            <StatCard
              icon={ListTodo}
              label="Open Tasks"
              value={openTasks}
              sub={`${stats.totals.tasks} tasks tracked overall`}
              tint="amber"
              onClick={() => navigate(ROUTES.TASKS)}
              actionLabel="Open the task board"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats.totals.completedTasks}
              sub={`${Math.round(stats.completionRate)}% completion rate`}
              tint="stone"
              progress={stats.completionRate}
              onClick={() => navigate(`${ROUTES.TASKS}?status=COMPLETED`)}
              actionLabel="View completed tasks"
            />
            <StatCard
              icon={AlertTriangle}
              label="Blocked"
              value={stats.totals.blockedTasks}
              sub={stats.totals.blockedTasks > 0 ? 'Needs immediate attention' : 'Nothing blocked — nice!'}
              tint="red"
              onClick={() => navigate(`${ROUTES.TASKS}?status=BLOCKED`)}
              actionLabel="View blocked tasks"
            />
            <StatCard
              icon={Clock}
              label="Overdue"
              value={stats.totals.overdueTasks}
              sub={stats.totals.overdueTasks > 0 ? 'Past their due date' : 'Everything on schedule'}
              tint="red"
              onClick={() => navigate(`${ROUTES.TASKS}?overdue=true`)}
              actionLabel="View overdue tasks"
              wrapperClassName="col-span-2 sm:col-span-1"
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
                  <BarChart data={statusData} margin={{ top: 8, right: 8, left: -16, bottom: isMobile ? 4 : 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    {/* Mobile: angled ticks so the four status names never collide. */}
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: isMobile ? 10 : 12, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                      interval={0}
                      angle={isMobile ? -32 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                      height={isMobile ? 56 : 30}
                    />
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
                        <Cell key={entry.key} fill={STATUS_CHART_COLORS[scheme][entry.key] ?? '#78716c'} />
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
            <CardDescription>Share of all tasks per priority level.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : priorityData.every((d) => d.value === 0) ? (
              <EmptyState icon={ListTodo} title="No tasks yet" hint="Priorities will appear once tasks exist." />
            ) : (
              <div className="flex flex-col items-center justify-center gap-5 py-2 sm:h-64 sm:flex-row sm:gap-10 sm:py-0">
                <PriorityRings data={priorityData} compact={isMobile} />
                <ul className="w-full max-w-72 space-y-3 sm:space-y-4" aria-label="Priority legend">
                  {priorityData.map((entry) => (
                    <PriorityLegendRow key={entry.key} entry={entry} total={priorityData.reduce((sum, d) => sum + d.value, 0)} />
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ============ Phase 6: progress trend & blockers ============ */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Progress and blockers">
        <Card>
          <CardHeader className="gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Progress over time
            </CardTitle>
            <CardDescription>Daily created vs. completed tasks over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !stats || stats.progressOverTime.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No trend yet" hint="Task activity over the last 30 days will appear here." />
            ) : (
              <ProgressTrendChart data={stats.progressOverTime} scheme={scheme} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Siren className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
              Blockers
              {stats && stats.blockers.length > 0 ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                  {stats.blockers.length}
                </span>
              ) : null}
            </CardTitle>
            {stats && stats.blockers.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-300"
                onClick={() => navigate(`${ROUTES.TASKS}?status=BLOCKED`)}
              >
                View board
                <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : !stats || stats.blockers.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No blockers"
                hint="Everything is running smoothly — blocked tasks would land here."
              />
            ) : (
              <ul className="scrollbar-thin max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {stats.blockers.map((blocker) => (
                  <li key={blocker.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/events/${blocker.eventId}`)}
                      className="w-full rounded-xl border border-red-200/70 bg-red-50/60 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 dark:border-red-500/20 dark:bg-red-500/[0.07] dark:hover:border-red-500/40"
                      aria-label={`Blocked task ${blocker.title}. Open its event.`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{blocker.title}</p>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                            blocker.daysBlocked >= 3
                              ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                          )}
                        >
                          {blocker.daysBlocked === 0 ? 'Just now' : `${blocker.daysBlocked}d blocked`}
                        </span>
                      </div>
                      {blocker.latestComment ? (
                        <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
                          “{blocker.latestComment.content}”
                          {blocker.latestComment.authorName ? <span className="not-italic"> — {blocker.latestComment.authorName}</span> : null}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs italic text-muted-foreground/70">No blocker reason recorded yet.</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            blocker.priority === 'HIGH' ? 'bg-red-500' : blocker.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-stone-400'
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{blocker.eventName ?? 'Unknown event'}</span>
                        {blocker.assigneeName ? <span className="truncate">· {blocker.assigneeName}</span> : <span>· Unassigned</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
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
                        {event.location ? (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground" title={event.location}>
                            <MapPin className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                            <span className="truncate">{event.location}</span>
                          </p>
                        ) : null}
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
          <CardHeader className="gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Team workload</CardTitle>
              <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground" aria-hidden="true">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Done
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  Blocked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Open
                </span>
              </div>
            </div>
            <CardDescription>Completion, blockers and membership for every team.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[86px] w-full rounded-xl" />
                ))}
              </div>
            ) : !stats || stats.teamWorkload.length === 0 ? (
              <EmptyState icon={Users} title="No team data" hint="Create teams and assign tasks to see workload." />
            ) : (
              <ul className="space-y-3">
                {stats.teamWorkload.map((team) => {
                  const total = team.openTasks + team.completedTasks + team.blockedTasks
                  const donePercent = total > 0 ? Math.round((team.completedTasks / total) * 100) : 0
                  const blockedPercent = total > 0 ? Math.round((team.blockedTasks / total) * 100) : 0
                  const openPercent = Math.max(0, 100 - donePercent - blockedPercent)
                  return (
                    <li key={team.teamId}>
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.TEAMS)}
                        title={`Open ${team.teamName} in Teams`}
                        className="group w-full rounded-xl border border-border bg-card p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:shadow-md hover:shadow-emerald-600/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:hover:border-emerald-500/40"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                              teamTone(team.teamName)
                            )}
                            aria-hidden="true"
                          >
                            {initialsOf(team.teamName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{team.teamName}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{team.completedTasks} done</span>
                              {' · '}
                              <span className="font-semibold text-amber-700 dark:text-amber-300">{team.openTasks} open</span>
                              {team.blockedTasks > 0 ? (
                                <>
                                  {' · '}
                                  <span className="font-semibold text-red-700 dark:text-red-300">{team.blockedTasks} blocked</span>
                                </>
                              ) : null}
                              {' · '}
                              <span className="inline-flex items-center gap-0.5">
                                <Users className="h-3 w-3" aria-hidden="true" />
                                {team.memberCount}
                              </span>
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                              completionPill(donePercent)
                            )}
                          >
                            {donePercent}%
                          </span>
                          <ArrowUpRight
                            className="h-4 w-4 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden="true"
                          />
                        </div>
                        <div
                          className="mt-3 flex h-2 gap-0.5"
                          role="img"
                          aria-label={`${team.teamName}: ${donePercent}% complete — ${team.completedTasks} done, ${team.blockedTasks} blocked, ${team.openTasks} open, ${team.memberCount} members`}
                        >
                          {total > 0 ? (
                            <>
                              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${donePercent}%` }} />
                              {blockedPercent > 0 ? (
                                <div className="h-full rounded-full bg-red-400/90 transition-all duration-500" style={{ width: `${blockedPercent}%` }} />
                              ) : null}
                              <div className="h-full rounded-full bg-amber-400/90 transition-all duration-500" style={{ width: `${openPercent}%` }} />
                            </>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <ActivityIcon className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Recent activity
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                onClick={() => navigate(ROUTES.ACTIVITY)}
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
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
              <ul className="scrollbar-thin max-h-80 overflow-y-auto pr-1">
                {stats.recentActivity.map((activity: ActivityLogDTO) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ============ Phase 6: top performers (managers & leaders only) ============ */}
      {canSeePerformance ? (
        <section className="mt-6" aria-label="Top performers">
          <Card>
            <CardHeader className="gap-1.5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                Top performers
              </CardTitle>
              <CardDescription>
                {user?.role === 'TEAM_LEADER' && user.teamId
                  ? 'Completion leaderboard for your team, over all assigned tasks.'
                  : 'Completion leaderboard across everyone with assigned tasks.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              ) : !stats || stats.topPerformers.length === 0 ? (
                <EmptyState icon={Trophy} title="No assigned tasks yet" hint="Assign tasks to team members to build the leaderboard." />
              ) : (
                <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {stats.topPerformers.map((performer, index) => {
                    const rank = index + 1
                    const rankStyles =
                      rank === 1
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 ring-amber-300/60 dark:ring-amber-500/30'
                        : rank === 2
                          ? 'bg-stone-100 text-stone-700 dark:bg-stone-500/15 dark:text-stone-300 ring-stone-300/60 dark:ring-stone-500/30'
                          : rank === 3
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300 ring-orange-300/60 dark:ring-orange-500/30'
                            : 'bg-muted text-muted-foreground ring-border'
                    return (
                      <li key={performer.userId}>
                        <button
                          type="button"
                          onClick={() => navigate(`${ROUTES.TASKS}?assignee=${performer.userId}`)}
                          title={`View ${performer.fullName}'s tasks`}
                          className="group w-full rounded-xl border border-border bg-card p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:shadow-md hover:shadow-emerald-600/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:hover:border-emerald-500/40"
                          aria-label={`Rank ${rank}: ${performer.fullName}, ${performer.completionRate}% completion`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" aria-hidden="true">
                              {initialsOf(performer.fullName)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{performer.fullName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {performer.completedTasks}/{performer.totalTasks} done
                                {performer.blockedTasks > 0 ? (
                                  <span className="ml-1 font-semibold text-red-700 dark:text-red-300">· {performer.blockedTasks} blocked</span>
                                ) : null}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1',
                                rankStyles
                              )}
                              aria-hidden="true"
                            >
                              {rank}
                            </span>
                          </div>
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Completion</span>
                              <span className="font-bold tabular-nums text-foreground">{performer.completionRate}%</span>
                            </div>
                            <Progress value={performer.completionRate} className="mt-1 h-1.5" aria-hidden="true" />
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
