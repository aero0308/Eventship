'use client'

import { FadeIn } from '@/components/landing/FadeIn'

export interface Feature {
  /** Zero-padded index, e.g. "001". */
  index: string
  title: string
  description: string
}

/**
 * One solution card: number, title, description over a thin top border.
 * A hairline under the text draws out to full width (and turns accent)
 * on hover — the "minimal border, hover fill" interaction language.
 */
export function FeatureRow({ feature }: { feature: Feature }) {
  return (
    <article className="group border-t border-evos-line pt-6">
      <span
        aria-hidden="true"
        className="font-evos-mono text-xs text-evos-muted transition-colors duration-300 group-hover:text-evos-accent"
      >
        {feature.index} /
      </span>
      <h3 className="mt-14 font-evos-display text-xl font-semibold uppercase leading-tight tracking-[-0.01em] text-evos-ink md:mt-20 md:text-[1.35rem]">
        {feature.title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-evos-muted">{feature.description}</p>
      <span
        aria-hidden="true"
        className="mt-9 block h-px w-9 bg-evos-ink transition-all duration-500 ease-out group-hover:w-full group-hover:bg-evos-accent"
      />
    </article>
  )
}

/** Grid of three solution cards with a staggered reveal. */
export function FeatureRowGrid({ features }: { features: readonly Feature[] }) {
  return (
    <div className="grid gap-x-8 gap-y-14 md:grid-cols-3">
      {features.map((feature, i) => (
        <FadeIn key={feature.index} delay={i * 0.08} className="h-full">
          <FeatureRow feature={feature} />
        </FadeIn>
      ))}
    </div>
  )
}
