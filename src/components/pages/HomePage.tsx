'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'
import { CustomCursor } from '@/components/landing/CustomCursor'
import { FadeIn } from '@/components/landing/FadeIn'
import { FeatureRowGrid } from '@/components/landing/FeatureRow'
import { LandingNav } from '@/components/landing/LandingNav'
import { MarqueeStrip } from '@/components/landing/MarqueeStrip'
import { NumberedList } from '@/components/landing/NumberedList'
import type { NumberedItem } from '@/components/landing/NumberedList'
import { ScrollProgress } from '@/components/landing/ScrollProgress'
import { SectionLabel } from '@/components/landing/SectionLabel'
import { scrollToSection, scrollToTop } from '@/components/landing/scroll'

/* ------------------------------------------------------------------ data */

const HERO_LINES = ['Event planning,', 'without the', 'chaos'] as const

const PROBLEMS: readonly NumberedItem[] = [
  {
    index: '001',
    title: 'No visibility into who’s doing what',
    description: 'Work spreads across chat threads, inboxes and memory. Nobody can see the whole board.',
  },
  {
    index: '002',
    title: 'Blockers go unreported until it’s too late',
    description: 'Problems surface in the final 48 hours, when there is no time left to fix them.',
  },
  {
    index: '003',
    title: 'Progress tracked in scattered spreadsheets',
    description: 'Three versions of the truth, all slightly stale, all owned by someone on vacation.',
  },
  {
    index: '004',
    title: 'Managers waste hours on follow-ups',
    description: 'Chasing status instead of removing obstacles. Meetings about the work, not the work.',
  },
]

const SOLUTION_FEATURES = [
  {
    index: '001',
    title: 'Task management',
    description: 'Assign, track and complete tasks with full visibility — priorities, due dates, owners.',
  },
  {
    index: '002',
    title: 'Blocker reporting',
    description: 'Flag problems instantly so nothing slips through. Every blocker is seen, owned, resolved.',
  },
  {
    index: '003',
    title: 'Real-time dashboard',
    description: 'Watch progress update live across your team. No refresh, no meetings, no guesswork.',
  },
] as const

const STEPS = [
  {
    title: 'Create',
    description: 'Set up your event and team. Give it a date, an owner and a plan.',
  },
  {
    title: 'Assign',
    description: 'Delegate tasks to team members with clear owners and deadlines.',
  },
  {
    title: 'Track',
    description: 'Watch progress in real time. Blockers surface the moment they appear.',
  },
  {
    title: 'Ship',
    description: 'Deliver the event on time — with a complete record of everything.',
  },
] as const

const CAPABILITIES = [
  { name: 'Role-based access', description: 'Manager, leader and employee — each role sees exactly what it owns.' },
  { name: 'Event management', description: 'Draft, plan, run and close out events through every stage.' },
  { name: 'Task board (kanban)', description: 'Drag-and-drop columns with priorities, due dates and owners.' },
  { name: 'Team management', description: 'Rosters, managers and membership in one place.' },
  { name: 'Analytics dashboard', description: 'Completion rates, workload and trends — computed live.' },
  { name: 'Dependencies', description: 'Tasks that wait on tasks, made explicit and visible.' },
  { name: 'Comments & blockers', description: 'Context where the work happens, not in another tab.' },
  { name: 'Real-time updates', description: 'Socket-powered sync — boards, dashboards and calendars move together.' },
] as const

const STATS = [
  { value: '0 hrs', label: 'Wasted on status meetings' },
  { value: '100%', label: 'Team visibility' },
  { value: '<1s', label: 'Update latency' },
  { value: '3 roles', label: 'Manager · Leader · Employee' },
] as const

const STACK = ['Next.js 16', 'TypeScript', 'Prisma', 'SQLite', 'Socket.IO', 'Tailwind CSS'] as const

const MONO_LABEL = 'font-evos-mono text-[11px] uppercase tracking-[0.2em]'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/* --------------------------------------------------------------- helpers */

function HeroLine({
  line,
  index,
  reduce,
  children,
}: {
  line: string
  index: number
  reduce: boolean
  children?: ReactNode
}) {
  return (
    <span className="-mb-[0.06em] block overflow-hidden pb-[0.06em]">
      <motion.span
        className="block"
        initial={reduce ? false : { y: '112%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.9, delay: 0.12 + index * 0.1, ease: EASE }}
      >
        {children ?? line}
      </motion.span>
    </span>
  )
}

/* ------------------------------------------------------------- component */

export function HomePage() {
  const reduce = useReducedMotion()

  return (
    <div className="evos-root relative flex min-h-screen flex-col bg-evos-bg font-evos-body text-evos-ink antialiased">
      <a
        href="#evos-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:bg-evos-ink focus:px-4 focus:py-2 focus:font-evos-mono focus:text-[11px] focus:uppercase focus:tracking-[0.2em] focus:text-evos-bg"
      >
        Skip to content
      </a>

      <div className="evos-noise" aria-hidden="true" />
      <ScrollProgress />
      <CustomCursor />
      <LandingNav />

      <main id="evos-main" className="flex-1">
        {/* ---------------------------------------------------- 01 · hero */}
        <header className="relative flex min-h-svh flex-col justify-end px-5 pb-8 pt-28 md:px-10 md:pb-12">
          <h1
            aria-label="Event planning, without the chaos."
            className="font-evos-display text-[clamp(3rem,10vw,9.5rem)] font-medium uppercase leading-[0.88] tracking-[-0.045em] text-evos-ink"
          >
            <span aria-hidden="true" className="block">
              {HERO_LINES.map((line, i) => (
                <HeroLine key={line} line={line} index={i} reduce={reduce ?? false}>
                  {i === HERO_LINES.length - 1 ? (
                    <>
                      {line}
                      <span className="text-evos-accent">.</span>
                    </>
                  ) : (
                    line
                  )}
                </HeroLine>
              ))}
            </span>
          </h1>

          <div className="mt-14 grid gap-10 border-t border-evos-line pt-8 md:mt-20 md:grid-cols-2 md:gap-16">
            <FadeIn>
              <SectionLabel index="001" title="What we do" />
              <p className="mt-5 max-w-md text-base leading-relaxed text-evos-muted md:text-lg">
                Event OS is an operating system for event teams — plan events, assign work, surface
                blockers and watch progress update live on one shared board.
              </p>
            </FadeIn>
            <FadeIn delay={0.08}>
              <SectionLabel index="002" title="For teams" />
              <p className="mt-5 max-w-md text-base leading-relaxed text-evos-muted md:text-lg">
                Built for managers, team leads and the people doing the work. Three roles, one
                source of truth, zero status meetings.
              </p>
            </FadeIn>
          </div>

          <FadeIn
            delay={0.1}
            className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-3 border-t border-evos-line pt-5 md:justify-between"
          >
            <span className={MONO_LABEL}>
              Availability <span className="text-evos-accent">—</span> 2025
            </span>
            <span className={MONO_LABEL}>
              Built for <span className="text-evos-accent">—</span> Event teams
            </span>
            <span className={`${MONO_LABEL} inline-flex items-center gap-2.5`}>
              Status <span className="text-evos-accent">—</span> Live
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-evos-accent opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-evos-accent" />
              </span>
            </span>
          </FadeIn>
        </header>

        {/* ------------------------------------------------- 02 · marquee */}
        <MarqueeStrip />

        {/* ------------------------------------------------- 03 · problem */}
        <section id="problem" className="scroll-mt-20 px-5 py-24 md:px-10 md:py-40" aria-labelledby="problem-title">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="self-start lg:sticky lg:top-24">
              <SectionLabel index="003" title="The problem" />
              <FadeIn>
                <h2
                  id="problem-title"
                  className="mt-8 font-evos-display text-[clamp(2.5rem,5.5vw,4.75rem)] font-medium leading-[0.98] tracking-[-0.03em] text-evos-ink"
                >
                  Events fail
                  <br />
                  in the gaps
                  <br />
                  between people<span className="text-evos-accent">.</span>
                </h2>
              </FadeIn>
            </div>
            <div>
              <NumberedList items={PROBLEMS} />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ 04 · solution */}
        <section
          id="solution"
          className="scroll-mt-20 border-t border-evos-line px-5 py-24 md:px-10 md:py-40"
          aria-labelledby="solution-title"
        >
          <SectionLabel index="004" title="The solution" />
          <FadeIn>
            <h2
              id="solution-title"
              className="mt-8 font-evos-display text-[clamp(2.5rem,6.5vw,5.5rem)] font-medium leading-[0.98] tracking-[-0.03em] text-evos-ink"
            >
              One system<span className="text-evos-accent">.</span>
              <br />
              Total clarity<span className="text-evos-accent">.</span>
            </h2>
          </FadeIn>
          <FadeIn className="mt-16 md:mt-24">
            <FeatureRowGrid features={SOLUTION_FEATURES} />
          </FadeIn>
        </section>

        {/* --------------------------------------------- 05 · how it works */}
        <section
          id="how"
          className="scroll-mt-20 border-t border-evos-line px-5 py-24 md:px-10 md:py-40"
          aria-labelledby="how-title"
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <div className="self-start lg:sticky lg:top-24">
              <SectionLabel index="005" title="How it works" />
              <FadeIn>
                <h2
                  id="how-title"
                  className="mt-8 font-evos-display text-[clamp(2rem,4vw,3.25rem)] font-medium leading-[1.02] tracking-[-0.025em] text-evos-ink"
                >
                  Four steps.
                  <br />
                  Zero chaos<span className="text-evos-accent">.</span>
                </h2>
              </FadeIn>
            </div>

            <div className="relative border-t border-evos-line">
              {/* Vertical rail — draws itself downward as the steps scroll in. */}
              <motion.span
                aria-hidden="true"
                className="absolute left-[2.15rem] top-0 hidden h-full w-px origin-top bg-evos-ink sm:block md:left-[2.9rem]"
                initial={reduce ? false : { scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease: EASE }}
              />
              {STEPS.map((step, i) => (
                <FadeIn key={step.title} delay={i * 0.05}>
                  <div className="group relative grid gap-3 border-b border-evos-line py-10 transition-colors duration-300 hover:bg-evos-line/40 sm:grid-cols-[4.5rem_1fr] sm:gap-x-6 md:grid-cols-[6rem_1fr_1.1fr] md:items-baseline md:gap-x-10 md:py-12">
                    <span
                      aria-hidden="true"
                      className="relative z-10 bg-evos-bg font-evos-mono text-sm text-evos-ink transition-colors duration-300 group-hover:text-evos-accent md:text-base"
                    >
                      0{i + 1}
                    </span>
                    <h3 className="font-evos-display text-3xl font-medium uppercase leading-none tracking-[-0.02em] text-evos-ink transition-transform duration-300 group-hover:translate-x-2 md:text-[2.75rem]">
                      {step.title}
                    </h3>
                    <p className="max-w-md text-sm leading-relaxed text-evos-muted md:justify-self-end md:text-base">
                      {step.description}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------- 06 · capabilities */}
        <section
          id="capabilities"
          className="scroll-mt-20 border-t border-evos-line px-5 py-24 md:px-10 md:py-40"
          aria-labelledby="capabilities-title"
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <div className="self-start lg:sticky lg:top-24">
              <SectionLabel index="006" title="Capabilities" />
              <FadeIn>
                <h2
                  id="capabilities-title"
                  className="mt-8 font-evos-display text-[clamp(2rem,4vw,3.25rem)] font-medium leading-[1.02] tracking-[-0.025em] text-evos-ink"
                >
                  Everything
                  <br />
                  included<span className="text-evos-accent">.</span>
                </h2>
                <p className="mt-6 max-w-xs text-sm leading-relaxed text-evos-muted md:text-base">
                  Eight capabilities, one subscription of attention. No plugins, no add-ons, no
                  integrations to babysit.
                </p>
              </FadeIn>
            </div>

            <ul className="border-t border-evos-line">
              {CAPABILITIES.map((cap, i) => (
                <li key={cap.name}>
                  <FadeIn delay={i * 0.04}>
                    <div className="group grid items-baseline gap-2 border-b border-evos-line py-6 transition-colors duration-300 hover:bg-evos-line/40 md:grid-cols-[1.1fr_1fr] md:gap-10 md:py-7">
                      <div className="flex items-baseline gap-5">
                        <span
                          aria-hidden="true"
                          className="font-evos-mono text-[11px] text-evos-muted transition-colors duration-300 group-hover:text-evos-accent"
                        >
                          0{i + 1}
                        </span>
                        <h3 className="font-evos-display text-xl font-medium tracking-[-0.015em] text-evos-ink transition-transform duration-300 group-hover:translate-x-1.5 md:text-2xl">
                          {cap.name}
                        </h3>
                      </div>
                      <div className="flex items-baseline justify-between gap-6 md:justify-end">
                        <p className="max-w-sm text-sm leading-relaxed text-evos-muted">
                          {cap.description}
                        </p>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 self-center text-evos-muted opacity-0 transition-all duration-300 group-hover:text-evos-accent group-hover:opacity-100"
                        />
                      </div>
                    </div>
                  </FadeIn>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------- 07 · numbers */}
        <section
          id="numbers"
          className="scroll-mt-20 border-t border-evos-line px-5 py-24 md:px-10 md:py-40"
          aria-labelledby="numbers-title"
        >
          <SectionLabel index="007" title="By the numbers" />
          <FadeIn>
            <h2 id="numbers-title" className="sr-only">
              By the numbers
            </h2>
          </FadeIn>
          <FadeIn className="mt-12 md:mt-16">
            <div className="grid grid-cols-1 gap-px border border-evos-line bg-evos-line sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="group bg-evos-bg px-6 py-12 transition-colors duration-300 hover:bg-evos-ink md:py-16"
                >
                  <p className="font-evos-display text-[clamp(3rem,6.5vw,6rem)] font-medium leading-none tracking-[-0.03em] text-evos-ink tabular-nums transition-colors duration-300 group-hover:text-evos-bg">
                    {stat.value}
                  </p>
                  <p
                    className={`mt-5 ${MONO_LABEL} text-evos-muted transition-colors duration-300 group-hover:text-evos-bg/60`}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* ----------------------------------------------- 08 · built with */}
        <section
          id="stack"
          className="scroll-mt-20 border-t border-evos-line px-5 py-24 md:px-10 md:py-32"
          aria-labelledby="stack-title"
        >
          <div className="grid items-baseline gap-8 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <SectionLabel index="008" title="Built with" sticky />
            <FadeIn>
              <h2 id="stack-title" className="sr-only">
                Built with
              </h2>
              <div className="grid grid-cols-2 gap-px border border-evos-line bg-evos-line md:grid-cols-3 lg:grid-cols-6">
                {STACK.map((name) => (
                  <div
                    key={name}
                    className="flex h-20 items-center justify-center bg-evos-bg px-3 text-center font-evos-mono text-[11px] uppercase tracking-[0.15em] text-evos-muted transition-colors duration-300 hover:bg-evos-ink hover:text-evos-bg md:h-24"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ------------------------------------------------------- 09 · cta */}
        <section
          id="cta"
          className="flex min-h-[80vh] flex-col items-center justify-center border-t border-evos-line px-5 py-32 text-center md:px-10"
          aria-labelledby="cta-title"
        >
          <FadeIn>
            <p className={MONO_LABEL}>
              009 <span className="text-evos-accent">—</span> Begin
            </p>
          </FadeIn>
          <FadeIn delay={0.06}>
            <h2
              id="cta-title"
              className="mt-8 font-evos-display text-[clamp(3rem,9.5vw,8.5rem)] font-medium uppercase leading-[0.9] tracking-[-0.04em] text-evos-ink"
            >
              Ready to
              <br />
              organize<span className="text-evos-accent">?</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.12} className="mt-14 flex flex-col items-center gap-5 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(ROUTES.REGISTER)}
              className="group inline-flex min-h-12 items-center gap-3 bg-evos-ink px-9 py-3.5 font-evos-mono text-xs uppercase tracking-[0.2em] text-evos-bg transition-colors duration-300 hover:bg-evos-accent"
            >
              Get started
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.LOGIN)}
              className={`${MONO_LABEL} evos-underline inline-flex min-h-12 items-center text-evos-ink`}
            >
              Sign in
            </button>
          </FadeIn>
          <FadeIn delay={0.18}>
            <p className="mt-8 font-evos-mono text-[11px] uppercase tracking-[0.18em] text-evos-muted">
              Free to try. No credit card required.
            </p>
          </FadeIn>
        </section>
      </main>

      {/* ------------------------------------------------------- footer */}
      <footer className="mt-auto border-t border-evos-line px-5 pb-8 pt-16 md:px-10 md:pt-24">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-8">
          <div>
            <button
              type="button"
              onClick={scrollToTop}
              className="text-left font-evos-display text-4xl font-medium uppercase leading-none tracking-[-0.03em] text-evos-ink md:text-6xl"
            >
              Event OS<span className="text-evos-accent">.</span>
            </button>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-evos-muted">
              The operating system for event teams — plan, assign, track, ship.
            </p>
          </div>

          <nav aria-label="Footer index">
            <p className={`${MONO_LABEL} text-evos-muted`}>Index</p>
            <ul className="mt-5 space-y-3">
              {[
                { id: 'capabilities', label: 'Features' },
                { id: 'how', label: 'How it works' },
                { id: 'numbers', label: 'By the numbers' },
                { id: 'cta', label: 'Get started' },
              ].map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(link.id)}
                    className="evos-underline text-sm text-evos-ink"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className={`${MONO_LABEL} text-evos-muted`}>Account</p>
            <ul className="mt-5 space-y-3">
              <li>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.LOGIN)}
                  className="evos-underline text-sm text-evos-ink"
                >
                  Login
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="evos-underline text-sm text-evos-ink"
                >
                  Register
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className={`${MONO_LABEL} text-evos-muted`}>Contact</p>
            <ul className="mt-5 space-y-3">
              <li>
                <a
                  href="mailto:hello@eventos.co"
                  className="evos-underline text-sm text-evos-ink"
                >
                  hello@eventos.co
                </a>
              </li>
              <li>
                <span className="text-sm text-evos-muted">Mon–Fri, 9–17 PT</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-evos-line pt-6 md:flex-row md:items-center md:justify-between">
          <span className={MONO_LABEL}>© 2025 Event OS</span>
          <span className={MONO_LABEL}>Portland, OR</span>
          <span className={MONO_LABEL}>Type — Space Grotesk / IBM Plex Mono</span>
        </div>
      </footer>
    </div>
  )
}
