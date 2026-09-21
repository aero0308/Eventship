'use client'

import { useEffect, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type StatTint = 'emerald' | 'amber' | 'red' | 'stone'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number
  sub?: string
  tint?: StatTint
  /** Optional 0-100 progress bar (e.g. completion rate). */
  progress?: number
  /** Optional click-through (e.g. jump to the filtered task list). */
  onClick?: () => void
  /** Accessible description for the click action. */
  actionLabel?: string
  /** Classes for the grid-cell wrapper (e.g. col-span tweaks on mobile). */
  wrapperClassName?: string
  className?: string
}

const TINT_CLASSES: Record<StatTint, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  stone: 'bg-muted text-muted-foreground',
}

function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(target)) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

export function StatCard({ icon: Icon, label, value, sub, tint = 'emerald', progress, onClick, actionLabel, wrapperClassName, className }: StatCardProps) {
  const display = useCountUp(value)
  const interactive = typeof onClick === 'function'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('h-full', wrapperClassName)}
    >
      <div
        className={cn(
          'h-full rounded-xl border bg-card p-3.5 shadow-sm transition-all duration-200 sm:p-4',
          interactive && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60',
          !interactive && 'hover:-translate-y-0.5 hover:shadow-md',
          'hover:ring-1 hover:ring-emerald-500/20 dark:hover:ring-emerald-400/20',
          className
        )}
        {...(interactive
          ? {
              role: 'button',
              tabIndex: 0,
              onClick,
              onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onClick?.()
                }
              },
              'aria-label': actionLabel ? `${label} — ${actionLabel}` : label,
            }
          : {})}
      >
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:mt-1 sm:text-3xl">{display}</p>
          </div>
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10', TINT_CLASSES[tint])}>
            <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
          </span>
        </div>
        {typeof progress === 'number' ? (
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted sm:mt-3" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        ) : null}
        {sub ? <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground sm:mt-2 sm:text-xs">{sub}</p> : null}
      </div>
    </motion.div>
  )
}
