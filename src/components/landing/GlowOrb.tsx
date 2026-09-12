import { cn } from '@/lib/utils'

interface GlowOrbProps {
  className?: string
  /** Core color of the radial glow (CSS color value). */
  color?: string
  /** Enable the slow ambient float animation. */
  float?: boolean
}

/**
 * Blurred radial-gradient orb used as ambient background lighting behind
 * the hero, stats and CTA sections. Purely decorative.
 */
export function GlowOrb({ className, color = 'rgba(99, 102, 241, 0.25)', float = false }: GlowOrbProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute rounded-full blur-[110px]', float && 'fora-float', className)}
      style={{ background: `radial-gradient(closest-side, ${color}, transparent 72%)` }}
    />
  )
}
