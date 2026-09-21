import { cn } from '@/lib/utils'

/**
 * The Eventship brand mark — the sailboat artwork (gradient sails, glowing
 * hull, north-star) that the favicon and app icons use (Task 36). The PNG is
 * self-contained: dark navy tile with rounded corners and transparent
 * surround, so it reads correctly on light and dark surfaces alike.
 *
 * One component so every surface (landing, auth, app header, drawer, mockups)
 * shares a single, consistent mark instead of one-off shapes. The legacy
 * `variant` prop is kept for API compatibility — both values render the same
 * artwork; only the glow tint differs slightly to stay visible on each
 * surface family.
 */

const GLOW_CLASSES = {
  emerald: 'shadow-[0_0_18px_rgba(124,108,240,0.45)]',
  indigo: 'shadow-[0_0_18px_rgba(124,108,240,0.55)]',
} as const

export type BrandMarkVariant = keyof typeof GLOW_CLASSES

interface BrandMarkProps {
  /** Kept for call-site compatibility; artwork is identical for both. */
  variant?: BrandMarkVariant
  /** Tile edge length in px — the artwork fills the tile. */
  size?: number
  /** Add the soft brand glow (used on dark/public surfaces). */
  glow?: boolean
  className?: string
}

export function BrandMark({ variant = 'emerald', size = 36, glow = false, className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center',
        size <= 20 ? 'rounded-[6px]' : size <= 30 ? 'rounded-md' : 'rounded-lg',
        glow && GLOW_CLASSES[variant],
        className
      )}
    >
      <img
        src="/brand-icon.png"
        alt=""
        width={size}
        height={size}
        className="h-full w-full rounded-[inherit] object-cover"
        draggable={false}
      />
    </span>
  )
}
