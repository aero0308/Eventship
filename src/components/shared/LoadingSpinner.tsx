'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  /** Tailwind size class for the icon, e.g. 'h-4 w-4'. */
  size?: string
  className?: string
  label?: string
}

export function LoadingSpinner({ size = 'h-6 w-6', className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-muted-foreground', className)} role="status" aria-live="polite">
      <Loader2 className={cn('animate-spin', size)} aria-hidden="true" />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Loading</span>}
    </div>
  )
}
