'use client'

import { ArrowRight } from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'
import { FadeIn } from '@/components/landing/FadeIn'
import { GlowOrb } from '@/components/landing/GlowOrb'
import { GridBackground } from '@/components/landing/GridBackground'

/**
 * Final CTA: full-width gradient wash with dot grid, a two-line editorial
 * headline (serif-italic close), one big glowing accent button.
 */
export function FinalCTA() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-title"
      className="relative scroll-mt-24 overflow-hidden py-28 md:py-40"
    >
      <GridBackground />
      <GlowOrb className="left-1/2 top-1/2 h-[520px] w-[880px] -translate-x-1/2 -translate-y-1/2" color="rgba(99,102,241,0.2)" float />
      <GlowOrb className="-right-40 -top-40 h-[360px] w-[360px]" color="rgba(129,140,248,0.12)" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <FadeIn>
          <h2
            id="cta-title"
            className="text-[clamp(2.5rem,6.5vw,5rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white"
          >
            Ready to ship your
            <br />
            <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">
              next event?
            </span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-fora-text-2 md:text-lg">
            Join the event teams who swapped status meetings for a live board. Set up your first
            event in minutes.
          </p>
        </FadeIn>

        <FadeIn delay={0.18}>
          <button
            type="button"
            onClick={() => navigate(ROUTES.REGISTER)}
            className="group mt-10 inline-flex min-h-14 items-center gap-2.5 rounded-full bg-fora-accent px-9 text-base font-medium text-white shadow-[0_0_48px_rgba(99,102,241,0.55)] transition-all duration-300 hover:bg-fora-accent-hover hover:shadow-[0_0_72px_rgba(99,102,241,0.7)]"
          >
            Get Started Free
            <ArrowRight aria-hidden="true" className="h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </FadeIn>

        <FadeIn delay={0.24}>
          <p className="mt-6 text-xs text-fora-muted">Free forever for teams up to 5 · No credit card required</p>
        </FadeIn>
      </div>
    </section>
  )
}
