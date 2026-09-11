import { cn } from '@/lib/utils'

interface SectionLabelProps {
  /** Zero-padded section number, e.g. "003". Decorative. */
  index: string
  /** Uppercase label text, e.g. "THE PROBLEM". */
  title: string
  /** Stick the label while its section scrolls (desktop only). */
  sticky?: boolean
  className?: string
}

/**
 * "001 — LABEL" — the recurring editorial index marker used across the
 * landing page. Mono, uppercase, wide tracking, accent em-dash.
 */
export function SectionLabel({ index, title, sticky = false, className }: SectionLabelProps) {
  return (
    <p
      className={cn(
        'font-evos-mono text-[11px] uppercase leading-none tracking-[0.22em]',
        sticky && 'lg:sticky lg:top-24',
        className,
      )}
    >
      <span className="text-evos-muted" aria-hidden="true">
        {index}
      </span>
      <span className="mx-2.5 text-evos-accent" aria-hidden="true">
        —
      </span>
      <span className="text-evos-ink">{title}</span>
    </p>
  )
}
