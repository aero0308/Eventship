const LOGOS = [
  'TechSummit',
  'VenueLab',
  'MeetGrid',
  'Stagecraft',
  'EventHive',
  'Panel&Co',
  'LumaField',
  'Gatherly',
] as const

/**
 * "Trusted by" bar: an infinite, edge-faded logo marquee. Logos are
 * typographic wordmarks (gray, brighten on hover); the track holds two
 * copies for a seamless loop and pauses on hover.
 */
export function TrustBar() {
  return (
    <section aria-label="Trusted by event teams" className="mt-20 border-y border-fora-border bg-fora-surface/30 py-10 md:mt-28">
      <p className="px-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">
        Trusted by event teams at
      </p>
      <div
        className="fora-marquee relative mt-8 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 14%, black 86%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 14%, black 86%, transparent)',
        }}
      >
        <div className="fora-marquee-track flex w-max items-center gap-16 pr-16">
          {[...LOGOS, ...LOGOS].map((name, index) => (
            <span
              key={`${name}-${index}`}
              aria-hidden={index >= LOGOS.length}
              className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-zinc-600 transition-colors duration-300 hover:text-zinc-200"
            >
              <span aria-hidden="true" className="h-2 w-2 rotate-45 rounded-[1.5px] bg-current opacity-70" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
