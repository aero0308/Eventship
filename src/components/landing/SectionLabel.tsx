import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionLabelProps {
  children: ReactNode
  align?: 'left' | 'center'
  className?: string
}

/**
 * Small uppercase editorial label ("FEATURES") with an accent tick —
 * the recurring section eyebrow used across the landing.
 */
export function SectionLabel({ children, align = 'center', className }: SectionLabelProps) {
  return (
    <p
      className={cn(
        'flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.2em] text-fora-muted',
        align === 'center' && 'justify-center',
        className,
      )}
    >
      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-fora-accent" />
      {children}
    </p>
  )
}
