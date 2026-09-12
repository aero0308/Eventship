/**
 * Hash-router-safe in-page scrolling helpers.
 *
 * The SPA routes on the URL hash (`#/dashboard` …), so plain anchor links
 * (`href="#features"`) would corrupt the route. All landing navigation goes
 * through these helpers instead.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function scrollToSection(id: string): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

export function scrollToTop(): void {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}
