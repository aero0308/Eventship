'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Bell, CalendarDays, LayoutDashboard, ListTodo, Lock, Search, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIDEBAR_ITEMS: ReadonlyArray<{ icon: LucideIcon; label: string; active?: boolean }> = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: ListTodo, label: 'Tasks' },
  { icon: CalendarDays, label: 'Calendar' },
  { icon: Users, label: 'Teams' },
] as const

const STAT_CARDS = [
  { label: 'Active events', value: '12', hint: '+2 this week', accent: false },
  { label: 'Open tasks', value: '48', hint: '64% done', accent: false },
  { label: 'Blocked', value: '3', hint: 'Needs review', accent: true },
] as const

const TASK_ROWS = [
  { title: 'Confirm AV vendor', event: 'Launch Summit', status: 'In progress', tone: 'bg-amber-400', chip: 'text-amber-300 border-amber-400/25 bg-amber-400/10' },
  { title: 'Print attendee badges', event: 'Launch Summit', status: 'To do', tone: 'bg-zinc-500', chip: 'text-zinc-300 border-zinc-500/25 bg-zinc-500/10' },
  { title: 'Run-of-show v2', event: 'Founder Dinner', status: 'Blocked', tone: 'bg-red-400', chip: 'text-red-300 border-red-400/25 bg-red-400/10' },
  { title: 'Book closing band', event: 'DevConf OPS', status: 'Done', tone: 'bg-emerald-400', chip: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10' },
] as const

/** Chart geometry: two series over 12 weeks (x 0→320, y 84→8). */
const CREATED_POINTS = '0,78 29,74 58,80 87,66 116,70 145,58 174,62 203,48 232,52 261,38 290,34 320,26'
const COMPLETED_POINTS = '0,84 29,80 58,72 87,74 116,62 145,64 174,52 203,54 232,42 261,36 290,30 320,18'

/**
 * Hero product mockup: CSS-only browser frame (dots + URL bar) wrapped around
 * a mini dashboard — sidebar, KPI cards, SVG progress chart and a task list.
 * Entirely decorative (role="img"), scales down proportionally on mobile.
 */
export function DashboardMockup() {
  const reduce = useReducedMotion()

  return (
    <div
      role="img"
      aria-label="Preview of the Eventship dashboard: stat cards, live progress chart and task list"
      className="relative overflow-hidden rounded-xl border border-fora-border bg-fora-surface text-left shadow-[0_50px_140px_-30px_rgba(0,0,0,0.9)]"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-fora-border bg-fora-surface-2 px-4 py-2.5">
        <div aria-hidden="true" className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
        </div>
        <div className="mx-auto flex h-6 w-full max-w-[240px] items-center justify-center gap-1.5 rounded-md border border-fora-border bg-fora-bg px-3 text-[10px] text-fora-muted">
          <Lock className="h-2.5 w-2.5" aria-hidden="true" />
          eventship.app/dashboard
        </div>
        <div aria-hidden="true" className="hidden gap-3 text-fora-muted sm:flex">
          <Search className="h-3 w-3" />
          <Bell className="h-3 w-3" />
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          aria-hidden="true"
          className="hidden w-36 shrink-0 flex-col border-r border-fora-border bg-fora-surface-2/40 p-3 sm:flex md:w-40"
        >
          <div className="mb-4 flex items-center gap-2 px-2 pt-1">
            <span className="h-2 w-2 rotate-45 rounded-[2px] bg-fora-accent" />
            <span className="text-[11px] font-semibold tracking-tight text-white">EVENTSHIP</span>
          </div>
          <nav className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => (
              <span
                key={item.label}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[11px]',
                  item.active
                    ? 'bg-fora-accent/15 text-fora-glow'
                    : 'text-fora-muted',
                )}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </span>
            ))}
          </nav>
          <div className="mt-auto rounded-lg border border-fora-border bg-fora-surface p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="fora-pulse-ring h-1.5 w-1.5 rounded-full bg-fora-accent" />
              <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-fora-glow">Live</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-fora-muted">Realtime sync active across 3 events</p>
          </div>
        </aside>

        {/* Main panel */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          {/* Panel header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white md:text-sm">Good morning, Alex</p>
              <p className="mt-0.5 text-[10px] text-fora-muted md:text-[11px]">Tuesday · Launch Summit in 26 days</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-fora-accent/30 bg-fora-accent/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-fora-glow">
              <span className="fora-pulse-ring h-1 w-1 rounded-full bg-fora-accent" />
              Live
            </span>
          </div>

          {/* Stat cards */}
          <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
            {STAT_CARDS.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  'rounded-lg border bg-fora-surface-2/60 p-2.5 md:p-3.5',
                  stat.accent ? 'border-red-400/25' : 'border-fora-border',
                )}
              >
                <p className="text-[9px] uppercase tracking-[0.12em] text-fora-muted md:text-[10px]">{stat.label}</p>
                <p
                  className={cn(
                    'mt-1 text-lg font-semibold tabular-nums md:text-2xl',
                    stat.accent ? 'text-red-300' : 'text-white',
                  )}
                >
                  {stat.value}
                </p>
                <p className="mt-0.5 hidden text-[9px] text-fora-muted md:block">{stat.hint}</p>
              </div>
            ))}
          </div>

          {/* Chart + task list */}
          <div className="mt-3 grid gap-3 md:mt-4 md:grid-cols-[1.15fr_1fr]">
            <div className="rounded-lg border border-fora-border bg-fora-surface-2/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-white md:text-[11px]">Task completion</p>
                <p className="text-[9px] text-fora-muted md:text-[10px]">Last 12 weeks</p>
              </div>
              <svg viewBox="0 0 320 100" className="mt-2 h-24 w-full md:h-28" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[20, 45, 70].map((y) => (
                  <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                ))}
                <motion.polygon
                  points={`${COMPLETED_POINTS} 320,100 0,100`}
                  fill="url(#dash-area)"
                  initial={reduce ? false : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.6 }}
                />
                <motion.polyline
                  points={CREATED_POINTS}
                  fill="none"
                  stroke="rgba(160,160,160,0.5)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  initial={reduce ? false : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, delay: 0.3, ease: 'easeOut' }}
                />
                <motion.polyline
                  points={COMPLETED_POINTS}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, delay: 0.15, ease: 'easeOut' }}
                />
              </svg>
              <div className="mt-1 flex items-center gap-4 text-[9px] text-fora-muted md:text-[10px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-4 rounded-full bg-fora-glow" aria-hidden="true" /> Completed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-4 rounded-full bg-zinc-500" aria-hidden="true" /> Created
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-fora-border bg-fora-surface-2/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-white md:text-[11px]">Recent tasks</p>
                <p className="text-[9px] text-fora-muted md:text-[10px]">View all</p>
              </div>
              <ul className="mt-2 space-y-2">
                {TASK_ROWS.map((task) => (
                  <li key={task.title} className="flex items-center gap-2.5 rounded-md border border-fora-border/70 bg-fora-surface px-2.5 py-2">
                    <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', task.tone)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-medium text-white md:text-[11px]">{task.title}</p>
                      <p className="truncate text-[9px] text-fora-muted">{task.event}</p>
                    </div>
                    <span className={cn('shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-medium md:text-[9px]', task.chip)}>
                      {task.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
