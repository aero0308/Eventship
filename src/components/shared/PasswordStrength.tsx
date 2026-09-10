'use client'

import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import { scorePassword } from '@/lib/password-strength'
import { cn } from '@/lib/utils'

interface PasswordStrengthProps {
  password: string
  /** Render nothing while empty (default true). */
  hideWhenEmpty?: boolean
  className?: string
}

/**
 * Live password strength meter: 4 segments + label + the shared-policy
 * checklist. Renders below register / reset / change-password fields.
 */
export function PasswordStrength({ password, hideWhenEmpty = true, className }: PasswordStrengthProps) {
  if (hideWhenEmpty && password.length === 0) return null

  const strength = scorePassword(password)
  // At least one segment lights up as soon as typing starts.
  const filled = password.length === 0 ? 0 : Math.max(1, strength.score + 1)

  return (
    <div className={cn('space-y-2.5', className)} aria-live="polite">
      <div className="flex items-center gap-2" aria-hidden="true">
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-500 ease-out',
                i < filled ? strength.segmentClass : 'bg-stone-200 dark:bg-stone-700/60'
              )}
            />
          ))}
        </div>
        <span className={cn('w-16 text-right text-xs font-semibold', strength.labelClass)}>
          {strength.label}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3" aria-label="Password requirements">
        {strength.checks.map((check) => (
          <li
            key={check.key}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              check.met ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground/70'
            )}
          >
            {check.met ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
            )}
            <span className={check.met ? 'font-medium' : undefined}>{check.label}</span>
            <span className="sr-only">{check.met ? 'requirement met' : 'requirement not met yet'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Tiny mismatch indicator used next to confirm-password fields. */
export function PasswordMatchHint({
  password,
  confirm,
  visible,
}: {
  password: string
  confirm: string
  visible: boolean
}) {
  if (!visible || confirm.length === 0) return null
  const matches = password === confirm
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-xs',
        matches ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}
      aria-live="polite"
    >
      {matches ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {matches ? 'Passwords match.' : 'Passwords do not match yet.'}
    </p>
  )
}
