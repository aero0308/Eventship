'use client'

const ITEMS = [
  'Task tracking',
  'Blocker reporting',
  'Real-time updates',
  'Team visibility',
  'Event management',
] as const

/**
 * Full-bleed infinite marquee strip. The track renders the item list twice
 * and CSS translates it -50% in a seamless loop (pauses on hover,
 * disabled under prefers-reduced-motion via globals.css).
 */
export function MarqueeStrip() {
  return (
    <section
      aria-label="What Eventship covers"
      className="evos-marquee overflow-hidden border-y border-evos-line bg-evos-bg py-7 md:py-10"
    >
      <div className="evos-marquee-track flex w-max items-center">
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex items-center">
            {ITEMS.map((item) => (
              <span
                key={item}
                className="flex items-center font-evos-display text-[clamp(2.4rem,6vw,4.75rem)] font-medium uppercase leading-none tracking-[-0.02em] text-evos-ink"
              >
                <span className="px-6 md:px-10">{item}</span>
                <span className="text-evos-muted" aria-hidden="true">
                  •
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
