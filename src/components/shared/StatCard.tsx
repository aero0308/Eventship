'use client'

import { useEffect, useState } from 'react'
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
  className?: string
}

const TINT_CLASSES: Record<StatTint, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-600',
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

export function StatCard({ icon: Icon, label, value, sub, tint = 'emerald', progress, className }: StatCardProps) {
  const display = useCountUp(value)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={cn('h-full rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-emerald-500/20 dark:hover:ring-emerald-400/20', className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{display}</p>
          </div>
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TINT_CLASSES[tint])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        {typeof progress === 'number' ? (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        ) : null}
        {sub ? <p className="mt-2 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
    </motion.div>
  )
}
