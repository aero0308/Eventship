'use client'

import { useState, type ComponentProps, type MouseEvent } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

/**
 * A date field that behaves well on every platform (Task 36):
 *
 *  - Shows a human "DD/MM/YY" placeholder while empty — native date inputs
 *    render nothing on iOS Safari and low-contrast ghost text elsewhere,
 *    which users read as a broken field.
 *  - Renders a calendar affordance inset from the right edge (the native
 *    indicator sits flush against the border, which reads as a bug on
 *    mobile where the field spans the full sheet width).
 *  - On touch devices the whole field is a hit-target for the native picker
 *    (no fiddly tap on a tiny indicator). The native indicator itself is
 *    display:none there (Task 39) — a showPicker() fallback restores
 *    tap-to-open on engines that don't open the picker for a bare field tap;
 *    on desktop the native indicator is hidden visually but still clickable,
 *    and keyboard segment entry keeps working while the field is focused.
 *
 * The value/onChange contract is identical to `<Input type="date">`.
 */
interface DateInputProps extends Omit<ComponentProps<typeof Input>, 'type'> {
  /** Ghost text rendered while the field is empty. Pass '' to disable. */
  placeholder?: string
  /** Render the trailing calendar affordance (default true). */
  icon?: boolean
  /** Layout classes for the wrapper (flex-1, basis, w-auto…). */
  className?: string
  /** Classes forwarded to the inner <input> (height, typography…). */
  inputClassName?: string
  /** Position tweaks for the placeholder ghost (e.g. "left-1 text-[11px]"). */
  placeholderClassName?: string
  /** Position tweaks for the calendar icon (e.g. "right-1.5 h-3.5 w-3.5"). */
  iconClassName?: string
}

export function DateInput({
  placeholder = 'DD/MM/YY',
  icon = true,
  className,
  inputClassName,
  placeholderClassName,
  iconClassName,
  value,
  onChange,
  ...props
}: DateInputProps) {
  const [uncontrolled, setUncontrolled] = useState('')
  const isControlled = typeof value === 'string'
  const current = isControlled ? (value as string) : uncontrolled
  const empty = current.length === 0

  /** Task 39: touch-only tap-to-open fallback — the native indicator is
   *  display:none on coarse pointers, so engines that relied on it as the
   *  picker affordance get the picker opened programmatically instead.
   *  Engines that already open it on a bare field treat this as a no-op
   *  (errors — disabled fields, blocked calls — are swallowed). */
  const openPickerOnTouch = (e: MouseEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    if (e.defaultPrevented || input.disabled) return
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      try {
        input.showPicker?.()
      } catch {
        /* no-op */
      }
    }
  }

  return (
    <div
      data-empty={empty ? 'true' : 'false'}
      className={cn('es-date-wrap group/es-date relative w-full', className)}
    >
      <Input
        type="date"
        value={isControlled ? (value as string) : uncontrolled}
        onChange={(e) => {
          setUncontrolled(e.target.value)
          onChange?.(e)
        }}
        className={cn(
          'es-date-input text-foreground [color-scheme:light] dark:[color-scheme:dark]',
          icon && 'pr-9',
          inputClassName
        )}
        onClick={openPickerOnTouch}
        {...props}
      />
      {placeholder && empty ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70 transition-opacity group-focus-within/es-date:opacity-0',
            placeholderClassName
          )}
        >
          {placeholder}
        </span>
      ) : null}
      {icon ? (
        <CalendarDays
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80',
            iconClassName
          )}
        />
      ) : null}
    </div>
  )
}
