import { cn } from '@/lib/utils'

/**
 * Subtle dot-grid backdrop (radial-gradient CSS) with a vertical fade mask —
 * layered behind the hero and final CTA for the Fora-style tech-grid wash.
 */
export function GridBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('fora-dotgrid fora-dotgrid-fade pointer-events-none absolute inset-0', className)}
    />
  )
}
