'use client'

import { useSyncExternalStore } from 'react'

const subscribeNoop = () => () => undefined

function getClientModifier(): '\u2318' | 'Ctrl' {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '\u2318' : 'Ctrl'
}

/**
 * Platform-aware keyboard-shortcut modifier: '⌘' on Apple devices, 'Ctrl'
 * elsewhere. Renders 'Ctrl' on the server and syncs right after hydration
 * (external-store subscription — no setState-in-effect cascades).
 */
export function useShortcutModifier(): '\u2318' | 'Ctrl' {
  return useSyncExternalStore(subscribeNoop, getClientModifier, () => 'Ctrl' as const)
}
