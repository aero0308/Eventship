'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BentoCardProps {
  icon?: ReactNode
  title: string
  description: string
  /** Visual slot (mini mockup / illustration) rendered between icon and copy. */
  children?: ReactNode
  className?: string
}

/**
 * Reusable Fora-style bento card: layered dark surface, subtle border that
 * brightens on hover, radial accent glow bleeding in from the top edge, and
 * a gentle -4px lift.
 */
export function BentoCard({ icon, title, description, children, className }: BentoCardProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-fora-border bg-fora-surface p-6 transition-colors duration-300 hover:border-fora-border-hover md:p-7',
        className,
      )}
    >
      {/* Hover accent glow — bleeds in from the top edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(560px circle at 50% -12%, rgba(99,102,241,0.15), transparent 62%)' }}
      />

      {icon && (
        <div
          aria-hidden="true"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-fora-border bg-fora-surface-2 text-fora-glow"
        >
          {icon}
        </div>
      )}

      {children && <div className="relative my-6 flex-1">{children}</div>}

      <div className={cn('relative', !children && icon && 'mt-5')}>
        <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-fora-text-2">{description}</p>
      </div>
    </motion.div>
  )
}
