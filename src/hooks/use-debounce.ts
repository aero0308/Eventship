'use client'

import { useEffect, useState } from 'react'

/**
 * Debounce a fast-changing value (Testing & Polish performance pass).
 * Typical use: text inputs that drive server queries — the input stays
 * responsive while the expensive effect (API request) only sees the settled
 * value.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
