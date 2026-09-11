import type { ReactNode } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/landing/FadeIn'
import { GlowOrb } from '@/components/landing/GlowOrb'
import { scrollToSection } from '@/components/landing/scroll'

interface BenefitSectionProps {
  index: string
  /** Headline — can embed serif-italic spans for editorial contrast. */
  title: ReactNode
  description: string
  bullets: readonly string[]
  /** Mockup / visual rendered on the opposite side of the copy. */
  mockup: ReactNode
  /** Flip to visual-left / copy-right on desktop. */
  reversed?: boolean
}

/**
 * Alternating benefit split: editorial copy block (index label, headline,
 * paragraph, check bullets, learn-more link) beside a product mockup with an
 * ambient accent glow. Order flips on desktop via `reversed`.
 */
export function BenefitSection({ index, title, description, bullets, mockup, reversed = false }: BenefitSectionProps) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-24">
      <FadeIn className={cn(reversed && 'lg:order-2')}>
        <p className="flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-fora-accent" />
          {index} — Benefits
        </p>
        <h3 className="mt-5 text-[clamp(1.85rem,3.6vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.025em] text-white">
          {title}
        </h3>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-fora-text-2">{description}</p>
        <ul className="mt-8 space-y-3.5">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-fora-text-2 md:text-[15px]">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-fora-accent/40 bg-fora-accent/10"
              >
                <Check className="h-3 w-3 text-fora-glow" />
              </span>
              {bullet}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => scrollToSection('features')}
          className="group mt-9 inline-flex items-center gap-2 text-sm font-medium text-fora-glow transition-colors duration-200 hover:text-white"
        >
          Learn more
          <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </FadeIn>

      <FadeIn delay={0.12} y={36} className={cn('relative', reversed && 'lg:order-1')}>
        <GlowOrb
          className={cn('top-1/2 h-[340px] w-[520px] -translate-y-1/2', reversed ? '-left-16' : '-right-16')}
          color="rgba(99,102,241,0.13)"
        />
        <div className="relative">{mockup}</div>
      </FadeIn>
    </div>
  )
}
