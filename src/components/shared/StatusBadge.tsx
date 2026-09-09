'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  label: string
  className?: string
}

/** Outline badge tinted with one of the *_CLASSES maps from constants. */
export function StatusBadge({ label, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('font-medium', className)}>
      {label}
    </Badge>
  )
}
