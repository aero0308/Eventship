'use client'

import { useEffect, useRef } from 'react'

export interface Shortcut {
  /** Lowercase key, e.g. '1', 'k', '/'. */
  key: string
  alt?: boolean
  ctrl?: boolean
  shift?: boolean
  /** Fired when the combo matches. Receives the raw event (already preventDefault-ed). */
  action: (event: KeyboardEvent) => void
  /** Skip this shortcut (e.g. when a dialog captures input). */
  enabled?: () => boolean
}

/**
 * Global keyboard shortcut listener (Testing & Polish a11y pass).
 * - Never fires while the user is typing in an input/textarea/select or a
 *   contenteditable region (unless `allowInInputs` is set on the shortcut).
 * - Re-registers only when the shortcut list identity changes; callers should
 *   memoize or define the array at module/render-stable scope.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[], allowInInputs = false) {
  const shortcutsRef = useRef(shortcuts)

  // Keep the listener stable; mirror the latest shortcuts into the ref from
  // an effect (never during render).
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        !!target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable)

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled && !shortcut.enabled()) continue
        if (isTyping && !allowInInputs) continue

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        if (!keyMatch) continue

        const altMatch = shortcut.alt ? event.altKey : !event.altKey
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !(event.ctrlKey || event.metaKey)
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        if (!altMatch || !ctrlMatch || !shiftMatch) continue

        event.preventDefault()
        shortcut.action(event)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [allowInInputs])
}

/** Human-readable label for a shortcut, used in tooltips/help surfaces. */
export function formatShortcut(shortcut: Pick<Shortcut, 'key' | 'alt' | 'ctrl' | 'shift'>): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')
  parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase())
  return parts.join(' + ')
}
