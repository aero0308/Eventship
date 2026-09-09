'use client'

import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { APP_NAME, ROLE_BADGE_CLASSES, ROLE_LABELS, ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface FeatureItem {
  icon: LucideIcon
  title: string
  description: string
  tint: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: CalendarCheck,
    title: 'Event planning & status tracking',
    description: 'Draft, plan and run events through every stage — from first idea to completed debrief.',
    tint: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: Users,
    title: 'Team coordination with roles',
    description: 'Event managers, team leaders and employees — everyone sees exactly what they own.',
    tint: 'bg-teal-100 text-teal-700',
  },
  {
    icon: ListChecks,
    title: 'Task boards with priorities & dependencies',
    description: 'A drag-and-drop kanban with priorities, due dates, blockers and task dependencies.',
    tint: 'bg-amber-100 text-amber-700',
  },
  {
    icon: Bell,
    title: 'Smart notifications & activity log',
    description: 'Assignments, status changes and deadline alerts keep the whole team in sync.',
    tint: 'bg-stone-100 text-stone-600',
  },
]

const STATS: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: CalendarCheck, value: '1,200+', label: 'Events planned' },
  { icon: Users, value: '340', label: 'Teams coordinated' },
  { icon: ListChecks, value: '18k', label: 'Tasks tracked' },
  { icon: TrendingUp, value: '96%', label: 'On-time delivery' },
]

const ROLE_CARDS: { role: keyof typeof ROLE_LABELS; description: string }[] = [
  {
    role: 'EVENT_MANAGER',
    description: 'Owns events end-to-end: creates plans, assigns teams and watches overall progress.',
  },
  {
    role: 'TEAM_LEADER',
    description: 'Leads a squad: distributes tasks, unblocks work and reports status upwards.',
  },
  {
    role: 'EMPLOYEE',
    description: 'Does the work: sees assigned tasks, updates progress and comments on details.',
  },
]

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.45, ease: 'easeOut' as const },
}

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ============ Header ============ */}
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <CalendarRange className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-stone-900">{APP_NAME}</span>
          </div>
          <nav className="flex items-center gap-2" aria-label="Landing">
            <Button variant="ghost" className="min-h-11 text-stone-600 hover:text-stone-900" onClick={() => navigate(ROUTES.LOGIN)}>
              Sign in
            </Button>
            <Button className="min-h-11 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate(ROUTES.REGISTER)}>
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ============ Hero ============ */}
        <section className="relative overflow-hidden" aria-label="Introduction">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_20%_0%,rgba(16,185,129,0.14),transparent_65%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_45%_at_90%_20%,rgba(20,184,166,0.10),transparent_65%)]" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_60%_at_50%_30%,black,transparent)] bg-[linear-gradient(to_right,rgba(28,25,23,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,25,23,0.05)_1px,transparent_1px)] bg-[size:44px_44px]"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:pt-20 lg:grid-cols-2 lg:gap-14">
            {/* Left copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <Badge variant="outline" className="mb-5 gap-1.5 border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                New · Phase 1 live
              </Badge>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
                Run flawless events{' '}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">from one place.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-stone-600 sm:text-lg">
                {APP_NAME} brings your event plans, teams, tasks and notifications together —
                so every launch day goes exactly the way you rehearsed it.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="min-h-11 bg-emerald-600 px-6 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
                  onClick={() => navigate(ROUTES.REGISTER)}
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="lg" variant="ghost" className="min-h-11 px-6 text-stone-600 hover:text-stone-900" onClick={() => navigate(ROUTES.LOGIN)}>
                  Sign in
                </Button>
              </div>
              <div className="mt-8 inline-flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm shadow-sm">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Target className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <p className="text-stone-600">
                  Try the demo — <span className="font-semibold text-stone-800">admin@eventflow.io</span> /{' '}
                  <span className="font-semibold text-stone-800">password123</span>
                </p>
              </div>
            </motion.div>

            {/* Right decorative mini-dashboard */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
              className="relative hidden justify-center lg:flex"
              aria-hidden="true"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative w-full max-w-md"
              >
                {/* Back card */}
                <div className="absolute -right-4 -top-6 h-full w-full rotate-3 rounded-xl border border-stone-200 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm" />
                {/* Front card */}
                <div className="relative rounded-xl border border-stone-200 bg-white p-5 shadow-xl shadow-stone-900/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Launch Night Gala</p>
                      <p className="mt-1 text-lg font-bold text-stone-900">Task progress</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">In Progress</Badge>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span>Completion</span>
                      <span className="font-semibold text-emerald-700">72%</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        initial={{ width: 0 }}
                        animate={{ width: '72%' }}
                        transition={{ duration: 1.1, delay: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Done', value: 18, classes: 'bg-emerald-50 text-emerald-700' },
                      { label: 'Active', value: 5, classes: 'bg-amber-50 text-amber-700' },
                      { label: 'Blocked', value: 2, classes: 'bg-red-50 text-red-600' },
                    ].map((chip) => (
                      <div key={chip.label} className={cn('rounded-lg px-3 py-2 text-center', chip.classes)}>
                        <p className="text-lg font-bold leading-none">{chip.value}</p>
                        <p className="mt-1 text-[11px] font-medium">{chip.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    {[
                      { title: 'Finalize stage layout', done: true },
                      { title: 'Confirm catering headcount', done: true },
                      { title: 'Print attendee badges', done: false },
                    ].map((task) => (
                      <div key={task.title} className="flex items-center gap-2.5 rounded-lg border border-stone-100 bg-stone-50/70 px-3 py-2">
                        <CheckCircle2
                          className={cn('h-4 w-4 shrink-0', task.done ? 'text-emerald-500' : 'text-stone-300')}
                        />
                        <span className={cn('truncate text-sm', task.done ? 'text-stone-400 line-through' : 'font-medium text-stone-700')}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ============ Stats strip ============ */}
        <section className="border-y border-stone-200 bg-stone-50/70" aria-label="Key numbers">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4">
            {STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-stone-200">
                  <stat.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-2xl font-bold tracking-tight text-stone-900">{stat.value}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ Features ============ */}
        <section className="mx-auto max-w-6xl px-4 py-16" aria-label="Features">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-stone-900">Everything an event needs</h2>
            <p className="mt-3 text-stone-600">
              One workspace for the whole lifecycle — plan the event, organize the team, track every task.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                whileHover={{ y: -4 }}
                className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className={cn('flex h-11 w-11 items-center justify-center rounded-lg', feature.tint)}>
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-stone-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ Roles ============ */}
        <section className="border-y border-stone-200 bg-stone-50/70 py-16" aria-label="Roles">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-stone-900">Built for every role</h2>
              <p className="mt-3 text-stone-600">Permissions and views adapt to how each person contributes.</p>
            </motion.div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {ROLE_CARDS.map((card, index) => (
                <motion.div
                  key={card.role}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
                >
                  <Badge variant="outline" className={cn('px-3 py-1', ROLE_BADGE_CLASSES[card.role])}>
                    {ROLE_LABELS[card.role]}
                  </Badge>
                  <p className="mt-4 text-sm leading-relaxed text-stone-600">{card.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ CTA band ============ */}
        <section className="mx-auto max-w-6xl px-4 py-16" aria-label="Call to action">
          <motion.div
            {...fadeUp}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 px-6 py-12 text-center shadow-lg shadow-emerald-600/20 sm:px-12"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(70%_70%_at_50%_0%,black,transparent)] bg-[linear-gradient(to_right,rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.35)_1px,transparent_1px)] bg-[size:36px_36px]"
            />
            <div className="relative">
              <ClipboardList className="mx-auto h-10 w-10 text-emerald-100" aria-hidden="true" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">Ready to orchestrate your next event?</h2>
              <p className="mx-auto mt-3 max-w-xl text-emerald-50">
                Create a free account, invite your team and ship your first flawless event this week.
              </p>
              <Button
                size="lg"
                className="mt-7 min-h-11 bg-white px-7 text-emerald-700 shadow-md hover:bg-emerald-50"
                onClick={() => navigate(ROUTES.REGISTER)}
              >
                Get Started — it&apos;s free
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-xs text-stone-500 sm:flex-row sm:text-left">
          <span className="font-medium text-stone-600">{APP_NAME} — Event Management System</span>
          <span>© {new Date().getFullYear()} {APP_NAME}. Plan events. Coordinate teams. Ship on time.</span>
        </div>
      </footer>
    </div>
  )
}
