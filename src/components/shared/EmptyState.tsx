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
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center',
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-stone-700">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-stone-500">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
