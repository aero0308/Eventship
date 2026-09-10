'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-300 bg-muted/60 px-6 py-10 text-center dark:border-stone-600',
        className
      )}
    >
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-600/20">
        <span aria-hidden="true" className="absolute inset-0 rounded-2xl ring-2 ring-emerald-500/20 ring-offset-2 ring-offset-transparent" />
        <Icon className="h-6 w-6" aria-hidden="true" />
        {/* Small amber counterpoint, echoing the brand palette. */}
        <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-amber-400" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
