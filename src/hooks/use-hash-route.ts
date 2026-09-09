'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * Tiny hash-based router for the single-page app.
 * The sandbox preview only exposes the `/` route, so in-app navigation
 * is done via location.hash (e.g. #/dashboard) which works everywhere.
 */

function currentPath(): string {
  if (typeof window === 'undefined') return '/'
  const hash = window.location.hash.replace(/^#/, '')
  return hash === '' ? '/' : hash
}

export function navigate(path: string, replace = false) {
  if (typeof window === 'undefined') return
  const target = `#${path.startsWith('/') ? path : `/${path}`}`
  if (replace) {
    const url = `${window.location.pathname}${window.location.search}${target}`
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = target
  }
}

export function useHashRoute(): string {
  const [path, setPath] = useState<string>(currentPath)

  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return path
}

/** Programmatic navigation helper as a hook (stable identity). */
export function useRouter() {
  const go = useCallback((path: string) => navigate(path), [])
  return { go, path: undefined as string | undefined }
}
