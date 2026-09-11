'use client'

import { useEffect } from 'react'
import { BenefitSection } from '@/components/landing/BenefitSection'
import { BlogCards } from '@/components/landing/BlogCards'
import { BentoGrid } from '@/components/landing/BentoGrid'
import { AnalyticsMockup } from '@/components/landing/AnalyticsMockup'
import { CommentMockup } from '@/components/landing/CommentMockup'
import { FAQ } from '@/components/landing/FAQ'
import { FadeIn } from '@/components/landing/FadeIn'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { Hero } from '@/components/landing/Hero'
import { KanbanMockup } from '@/components/landing/KanbanMockup'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingNav } from '@/components/landing/LandingNav'
import { ScrollProgress } from '@/components/landing/ScrollProgress'
import { SectionLabel } from '@/components/landing/SectionLabel'
import { StatsSection } from '@/components/landing/StatsSection'
import { Testimonials } from '@/components/landing/Testimonials'
import { TrustBar } from '@/components/landing/TrustBar'

/**
 * EVENT OS — public landing (Fora-inspired dark editorial design).
 * Assembles the twelve landing sections over a fixed-dark surface that is
 * immune to the app's light/dark theme (explicit hex tokens, fora-* scope).
 */
export function HomePage() {
  // Paint the document canvas dark while the landing is mounted so overscroll
  // rubber-banding and route transitions never flash the light app background.
  useEffect(() => {
    const previous = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#0a0a0a'
    return () => {
      document.body.style.backgroundColor = previous
    }
  }, [])

  return (
    <div className="fora-root relative flex min-h-screen flex-col overflow-x-clip bg-fora-bg font-fora-sans text-fora-text antialiased">
      <a
        href="#fora-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-full focus:bg-fora-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <div className="fora-noise" aria-hidden="true" />
      <ScrollProgress />
      <LandingNav />

      <main id="fora-main" className="flex-1">
        {/* 01 · Hero + product mockup */}
        <Hero />

        {/* 02 · Trusted-by logo marquee */}
        <TrustBar />

        {/* 03 · Bento feature grid */}
        <BentoGrid />

        {/* 04 · Benefits — three alternating mockup splits */}
        <div id="benefits" className="scroll-mt-24 border-t border-fora-border">
          <section aria-labelledby="benefits-title" className="mx-auto max-w-7xl px-6 pb-4 pt-24 md:pt-32">
            <SectionLabel>Benefits</SectionLabel>
            <FadeIn>
              <h2
                id="benefits-title"
                className="mx-auto mt-5 max-w-3xl text-center text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white"
              >
                Fewer meetings.
                <br />
                <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">
                  More shipped.
                </span>
              </h2>
            </FadeIn>
          </section>

          <div className="mx-auto max-w-7xl space-y-24 px-6 py-24 md:space-y-32 md:py-32">
            <BenefitSection
              index="01"
              title={
                <>
                  Every task. Every person.{' '}
                  <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">One board.</span>
                </>
              }
              description="A kanban board gives the whole event one shared surface. Assign work, set priorities and due dates, and drag cards across columns as the plan becomes reality."
              bullets={[
                'Drag-and-drop columns — To do, In progress, Done',
                'Priorities, due dates and owners attached to every card',
                'Reassign in one drag; everyone sees the change instantly',
              ]}
              mockup={<KanbanMockup />}
            />

            <BenefitSection
              index="02"
              reversed
              title={
                <>
                  Watch progress{' '}
                  <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">
                    happen live.
                  </span>
                </>
              }
              description="The dashboard aggregates every board into one live view — completion rates, workload and blockers. When a card moves, the chart moves with it. No refresh, no meeting."
              bullets={[
                'Stat cards that update the moment tasks change state',
                'Progress-over-time trends across every event',
                'Per-member workload bars to spot overload early',
              ]}
              mockup={<AnalyticsMockup />}
            />

            <BenefitSection
              index="03"
              title={
                <>
                  Flag blockers{' '}
                  <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">
                    instantly.
                  </span>
                </>
              }
              description="Comments and blockers live where the work happens. Anyone can flag a stuck task; managers get a live feed of what needs unblocking — before it threatens the timeline."
              bullets={[
                'One-click blocker flag with an escalation trail',
                'Threaded comments with full context on every task',
                'Managers see blocked work the second it is flagged',
              ]}
              mockup={<CommentMockup />}
            />
          </div>
        </div>

        {/* 05 · Animated stats */}
        <StatsSection />

        {/* 06 · Testimonials */}
        <Testimonials />

        {/* 07 · Blog previews */}
        <BlogCards />

        {/* 08 · FAQ accordion */}
        <FAQ />

        {/* 09 · Final CTA */}
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  )
}
