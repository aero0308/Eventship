import type { ReactNode } from 'react'
import {
  ArrowUpRight,
  BellRing,
  Flag,
  Link2,
  PieChart,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BentoCard } from '@/components/landing/BentoCard'
import { FadeIn } from '@/components/landing/FadeIn'
import { SectionLabel } from '@/components/landing/SectionLabel'

/* ------------------------------------------------------- mini visuals */

/** 2x2 hero-card visual: a compressed three-column kanban. */
function MiniKanban() {
  const columns = [
    {
      name: 'To do',
      dot: 'bg-zinc-500',
      cards: [
        { title: 'Book AV vendor', meta: 'Maya · Fri' },
        { title: 'Print badges', meta: 'Tom · Mon' },
      ],
    },
    {
      name: 'Doing',
      dot: 'bg-amber-400',
      cards: [
        { title: 'Run-of-show v2', meta: 'Priya · Wed', highlight: true },
        { title: 'Catering menu', meta: 'Leo · Thu' },
      ],
    },
    {
      name: 'Done',
      dot: 'bg-emerald-400',
      cards: [{ title: 'Venue booked', meta: 'Alex · Mon' }],
    },
  ]

  return (
    <div aria-hidden="true" className="grid h-full grid-cols-3 gap-3 rounded-xl border border-fora-border bg-fora-bg/60 p-3">
      {columns.map((column) => (
        <div key={column.name} className="min-w-0 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', column.dot)} />
            <span className="truncate text-[10px] font-medium text-fora-text-2">{column.name}</span>
          </div>
          {column.cards.map((card) => (
            <div
              key={card.title}
              className={cn(
                'rounded-md border bg-fora-surface-2 p-2',
                card.highlight ? 'border-fora-accent/50 shadow-[0_0_20px_rgba(99,102,241,0.25)]' : 'border-fora-border',
              )}
            >
              <p className="truncate text-[10px] font-medium leading-tight text-white">{card.title}</p>
              <p className="mt-1 truncate text-[9px] text-fora-muted">{card.meta}</p>
              <div className="mt-2 h-1 w-2/3 rounded-full bg-white/[0.07]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Live activity feed with a pulsing indicator. */
function MiniLiveFeed() {
  const rows = [
    { text: "Maya moved 'Badges' to Done", time: '2s' },
    { text: "Leo flagged 'Permits' blocked", time: '9s' },
    { text: "Omar joined Launch Summit", time: '31s' },
  ]
  return (
    <div aria-hidden="true" className="space-y-2 rounded-xl border border-fora-border bg-fora-bg/60 p-3">
      {rows.map((row) => (
        <div key={row.text} className="flex items-center gap-2.5 rounded-md border border-fora-border bg-fora-surface-2/70 px-2.5 py-2">
          <span className="fora-pulse-ring h-1.5 w-1.5 shrink-0 rounded-full bg-fora-accent" />
          <span className="min-w-0 flex-1 truncate text-[10px] text-fora-text-2">{row.text}</span>
          <span className="shrink-0 text-[9px] tabular-nums text-fora-muted">{row.time}</span>
        </div>
      ))}
    </div>
  )
}

/** Blocker chip visual. */
function MiniBlocker() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-2.5 rounded-xl border border-red-400/25 bg-red-400/[0.05] p-3"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-400/30 bg-red-400/10">
        <Flag className="h-3.5 w-3.5 text-red-400" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-red-200">Venue permits pending</p>
        <p className="text-[10px] text-red-300/70">Escalated to manager · 2d</p>
      </div>
    </div>
  )
}

/** Overlapping avatar stack. */
function MiniAvatars() {
  const people = [
    { initials: 'MR', tone: 'from-fora-accent to-fora-glow' },
    { initials: 'OH', tone: 'from-amber-500 to-orange-400' },
    { initials: 'PS', tone: 'from-emerald-500 to-teal-400' },
    { initials: 'DK', tone: 'from-rose-500 to-pink-400' },
    { initials: 'LS', tone: 'from-sky-500 to-cyan-400' },
  ]
  return (
    <div aria-hidden="true" className="flex items-center">
      {people.map((person, i) => (
        <span
          key={person.initials}
          className={cn(
            '-ml-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-fora-surface bg-gradient-to-br text-[10px] font-semibold text-white first:ml-0',
            person.tone,
          )}
          style={{ zIndex: people.length - i }}
        >
          {person.initials}
        </span>
      ))}
      <span className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-fora-surface bg-fora-surface-3 text-[10px] font-semibold text-fora-text-2">
        +12
      </span>
      <div className="ml-5 hidden min-w-0 flex-1 sm:block">
        <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-fora-accent to-fora-glow" />
        </div>
        <p className="mt-1.5 text-[10px] text-fora-muted">75% of assignments accepted</p>
      </div>
    </div>
  )
}

/** Tiny sparkline + number. */
function MiniSparkline() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-fora-border bg-fora-bg/60 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em] text-fora-muted">Completion</span>
        <span className="text-lg font-semibold tabular-nums text-white">87%</span>
      </div>
      <svg viewBox="0 0 160 40" className="mt-2 h-10 w-full" preserveAspectRatio="none">
        <polyline
          points="0,32 20,30 40,26 60,28 80,20 100,22 120,14 140,12 160,6"
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="160" cy="6" r="2.5" fill="#818cf8" />
      </svg>
    </div>
  )
}

/** Two connected dependency chips. */
function MiniDependencies() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 rounded-xl border border-fora-border bg-fora-bg/60 p-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-fora-border bg-fora-surface-2 px-2.5 py-1.5 text-[10px] font-medium text-white">
          Book venue
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-fora-accent/40 bg-fora-accent/10">
          <Link2 className="h-3 w-3 text-fora-glow" />
        </span>
        <span className="rounded-md border border-fora-accent/40 bg-fora-accent/10 px-2.5 py-1.5 text-[10px] font-medium text-fora-glow">
          Print badges
        </span>
      </div>
      <p className="text-[10px] text-fora-muted">"Print badges" can't start until "Book venue" completes.</p>
    </div>
  )
}

/** Role badge row. */
function MiniRoles() {
  const roles = [
    { label: 'Manager', tone: 'border-fora-accent/40 bg-fora-accent/10 text-fora-glow' },
    { label: 'Team Leader', tone: 'border-white/15 bg-white/[0.06] text-white' },
    { label: 'Employee', tone: 'border-fora-border bg-fora-surface-2 text-fora-text-2' },
  ]
  return (
    <div aria-hidden="true" className="flex flex-wrap gap-2 rounded-xl border border-fora-border bg-fora-bg/60 p-3">
      {roles.map((role) => (
        <span key={role.label} className={cn('rounded-full border px-3 py-1.5 text-[10px] font-medium', role.tone)}>
          {role.label}
        </span>
      ))}
      <p className="w-full pt-1 text-[10px] text-fora-muted">Each role sees exactly what it owns — nothing more.</p>
    </div>
  )
}

/* ----------------------------------------------------------- section */

interface BentoEntry {
  icon: ReactNode
  title: string
  description: string
  visual?: ReactNode
  span: string
}

const ENTRIES: BentoEntry[] = [
  {
    icon: <Zap className="h-4.5 w-4.5" aria-hidden="true" />,
    title: 'Kanban Task Board',
    description:
      'Drag tasks across To do, In progress and Done. Priorities, due dates and owners stay attached to every card.',
    visual: <MiniKanban />,
    span: 'md:col-span-2 lg:col-span-2 lg:row-span-2',
  },
  {
    icon: <Zap className="h-4.5 w-4.5" aria-hidden="true" />,
    title: 'Real-time Updates',
    description: 'Boards, dashboards and calendars sync the instant anything changes — no refresh.',
    visual: <MiniLiveFeed />,
    span: '',
  },
  {
    icon: <Flag className="h-4.5 w-4.5" aria-hidden="true" />,
    title: 'Blocker Reporting',
    description: 'Flag anything stuck in one click. Managers see it the second it happens.',
    visual: <MiniBlocker />,
    span: '',
  },
  {
    icon: <Users className="h-4.5 w-4.5" aria-hidden="true" />,
    title: 'Team Management',
    description: 'Rosters, roles and workload for every team — with assignment tracking built in.',
    visual: <MiniAvatars />,
    span: 'md:col-span-2 lg:col-span-2',
  },
  {
    icon: <PieChart className="h-4.5 w-4.5" aria-hidden="true" />,
    title: 'Analytics',
    description: 'Completion rates and workload trends, computed live.',
    visual: <MiniSparkline />,
    span: '',
  },
  {
    icon: <Link2 className="h-4.5 w-4.5" aria-hidden="true" />,
    title: 'Dependencies',
    description: 'Tasks that wait on tasks, made explicit — so nothing starts out of order.',
    visual: <MiniDependencies />,
    span: '',
  },
  {
    icon: <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />,
    title: 'Role-Based Access',
    description: 'Managers, team leaders and employees each get a scoped view of the work that is theirs.',
    visual: <MiniRoles />,
    span: 'md:col-span-2 lg:col-span-2',
  },
]

/**
 * Fora's signature asymmetric bento grid: 7 feature cards over a 4-column
 * desktop grid (2x2 hero card, 1x1s, 2x1 wides), stacking 2-col on tablet
 * and 1-col on mobile with staggered scroll reveals.
 */
export function BentoGrid() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionLabel>Features</SectionLabel>
        <FadeIn>
          <h2
            id="features-title"
            className="mx-auto mt-5 max-w-3xl text-center text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white"
          >
            Everything you need.
            <br />
            <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">
              Nothing you don&apos;t.
            </span>
          </h2>
        </FadeIn>

        <div className="mt-14 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 lg:grid-cols-4">
          {ENTRIES.map((entry, index) => (
            <FadeIn
              key={entry.title}
              delay={index * 0.06}
              y={32}
              className={cn('h-full', entry.span)}
            >
              <BentoCard
                icon={entry.icon}
                title={entry.title}
                description={entry.description}
                className="h-full"
              >
                {entry.visual}
              </BentoCard>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.1}>
          <p className="mt-10 flex items-center justify-center gap-2 text-sm text-fora-muted">
            <BellRing aria-hidden="true" className="h-3.5 w-3.5 text-fora-glow" />
            Plus notifications, comments, an activity log and a shared calendar.
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
