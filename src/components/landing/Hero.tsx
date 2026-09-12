'use client'

import Image from 'next/image'
import { ArrowRight, Play, Sparkles } from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'
import { DashboardMockup } from '@/components/landing/DashboardMockup'
import { FadeIn } from '@/components/landing/FadeIn'
import { GlowOrb } from '@/components/landing/GlowOrb'
import { GridBackground } from '@/components/landing/GridBackground'
import { scrollToSection } from '@/components/landing/scroll'

/**
 * Hero: pill badge → massive two-line headline (serif-italic second line for
 * the editorial contrast) → subheadline → dual CTAs → fine print → the
 * browser-framed dashboard mockup floating over an accent glow.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-44">
      {/* flow.so-style photographic backdrop — sits behind the fixed nav and
          the hero copy, then dissolves into the page black before the trust
          bar. Rendered first so the grid/orbs layer above it. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[540px] md:h-[760px]">
        <Image
          src="/images/landing/hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_65%]"
          unoptimized
        />
        {/* Contrast wash so the white headline stays readable */}
        <div className="absolute inset-0 bg-fora-bg/40" />
        {/* Dissolve into the page background at the bottom edge */}
        <div className="absolute inset-0 bg-gradient-to-b from-fora-bg/20 via-fora-bg/35 to-fora-bg" />
      </div>

      <GridBackground />
      <GlowOrb className="-top-48 left-1/2 h-[560px] w-[920px] -translate-x-1/2" color="rgba(99,102,241,0.2)" float />

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        {/* Pill badge */}
        <FadeIn y={16}>
          <span className="inline-flex items-center gap-2.5 rounded-full border border-fora-border bg-fora-surface/80 py-1.5 pl-3.5 pr-4 text-xs text-fora-text-2 backdrop-blur">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-fora-glow" />
            Now with real-time updates
            <span aria-hidden="true" className="fora-pulse-ring h-1.5 w-1.5 rounded-full bg-fora-accent" />
          </span>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={0.08}>
          <h1 className="mx-auto mt-8 max-w-4xl text-[clamp(2.75rem,7.5vw,5.75rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-white">
            Build events.
            <br />
            <span className="bg-gradient-to-r from-white via-white to-fora-muted bg-clip-text font-fora-serif font-normal italic tracking-[-0.01em] text-transparent">
              Ship on time.
            </span>
          </h1>
        </FadeIn>

        {/* Subheadline */}
        <FadeIn delay={0.16}>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fora-text-2 md:text-lg">
            The command center for event teams. Track tasks, catch blockers, and watch progress
            happen live — without the status meetings.
          </p>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={0.24} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(ROUTES.REGISTER)}
            className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-fora-accent px-7 text-sm font-medium text-white shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all duration-300 hover:bg-fora-accent-hover hover:shadow-[0_0_60px_rgba(99,102,241,0.65)]"
          >
            Start Free Trial
            <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('features')}
            className="inline-flex min-h-12 items-center gap-2.5 rounded-full border border-white/15 px-7 text-sm font-medium text-white transition-colors duration-300 hover:border-white/30 hover:bg-white/5"
          >
            <Play aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
            Watch Demo
          </button>
        </FadeIn>

        {/* Fine print */}
        <FadeIn delay={0.3}>
          <p className="mt-5 text-xs text-fora-muted">No credit card required · Free for teams up to 5</p>
        </FadeIn>

        {/* Product mockup */}
        <FadeIn delay={0.2} y={44} className="relative mt-16 md:mt-20">
          <GlowOrb
            className="left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2"
            color="rgba(99,102,241,0.17)"
          />
          <DashboardMockup />
        </FadeIn>
      </div>
    </section>
  )
}
