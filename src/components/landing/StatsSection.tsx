import type { ReactNode } from 'react'
import { AnimatedCounter } from '@/components/landing/AnimatedCounter'
import { FadeIn } from '@/components/landing/FadeIn'
import { SectionLabel } from '@/components/landing/SectionLabel'

interface Stat {
  value: number
  suffix?: string
  prefix?: string
  decimals?: number
  display?: ReactNode
  label: string
}

const STATS: Stat[] = [
  { value: 10000, suffix: '+', label: 'Events organized' },
  { value: 500, suffix: '+', label: 'Teams onboarded' },
  { value: 0, display: '<1s', label: 'Real-time latency' },
  { value: 99.9, suffix: '%', decimals: 1, label: 'Uptime' },
]

/**
 * "By the numbers": four big stats with scroll-triggered animated counters,
 * separated by hairline dividers (gap-px grid over a border-colored canvas).
 */
export function StatsSection() {
  return (
    <section id="stats" aria-labelledby="stats-title" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionLabel>By the numbers</SectionLabel>
        <FadeIn>
          <h2
            id="stats-title"
            className="mx-auto mt-5 max-w-3xl text-center text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white"
          >
            Built for teams that{' '}
            <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">ship.</span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-14 md:mt-16">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-fora-border bg-fora-border sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-fora-bg px-6 py-12 text-center transition-colors duration-300 hover:bg-fora-surface md:py-14">
                <p className="text-5xl font-medium tracking-[-0.02em] text-white tabular-nums md:text-6xl">
                  {stat.display ?? (
                    <>
                      {stat.prefix}
                      <AnimatedCounter value={stat.value} decimals={stat.decimals ?? 0} />
                      {stat.suffix}
                    </>
                  )}
                </p>
                <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
