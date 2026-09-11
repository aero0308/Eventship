'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'
import { cn } from '@/lib/utils'
import { scrollToSection, scrollToTop } from '@/components/landing/scroll'

const NAV_LINKS = [
  { id: 'capabilities', label: 'Features' },
  { id: 'how', label: 'How it works' },
] as const

const MENU_LINKS = [
  { id: 'problem', label: 'The problem' },
  { id: 'solution', label: 'The solution' },
  { id: 'how', label: 'How it works' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'numbers', label: 'By the numbers' },
] as const

const MONO_LABEL = 'font-evos-mono text-[11px] uppercase tracking-[0.2em]'

/**
 * Fixed top bar: wordmark left, mono nav links right (Login →). Gains a
 * blurred paper background + hairline border once the page scrolls. On
 * mobile it collapses to a full-screen editorial overlay menu.
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const goTo = (id: string) => {
    setOpen(false)
    // Defer until after the overlay unmounts + scroll lock releases.
    window.setTimeout(() => scrollToSection(id), 30)
  }

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300',
          scrolled ? 'border-evos-line bg-[#fafaf7]/85 backdrop-blur-md' : 'border-transparent',
        )}
      >
        <nav
          aria-label="Primary"
          className="flex h-16 items-center justify-between px-5 md:h-[4.5rem] md:px-10"
        >
          <button
            type="button"
            onClick={scrollToTop}
            className="font-evos-display text-lg font-semibold uppercase tracking-[-0.02em] text-evos-ink"
          >
            Event OS&nbsp;<span className="text-evos-accent">—</span>
          </button>

          <div className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => goTo(link.id)}
                className={cn(MONO_LABEL, 'evos-underline text-evos-ink')}
              >
                {link.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigate(ROUTES.LOGIN)}
              className={cn(
                MONO_LABEL,
                'evos-underline inline-flex items-center gap-1.5 text-evos-ink',
              )}
            >
              Login <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label="Open menu"
            className="flex h-11 w-11 flex-col items-end justify-center gap-[7px] md:hidden"
          >
            <span className="block h-px w-7 bg-evos-ink" aria-hidden="true" />
            <span className="block h-px w-5 bg-evos-ink" aria-hidden="true" />
          </button>
        </nav>
      </header>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[80] flex flex-col bg-evos-bg px-5 pb-8 pt-3 md:px-10"
        >
          <div className="flex h-14 items-center justify-between">
            <span className="font-evos-display text-lg font-semibold uppercase tracking-[-0.02em] text-evos-ink">
              Event OS&nbsp;<span className="text-evos-accent">—</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center text-evos-ink"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Mobile" className="mt-8 flex flex-col border-t border-evos-line">
            {MENU_LINKS.map((link, i) => (
              <button
                key={link.id}
                type="button"
                onClick={() => goTo(link.id)}
                className="group flex items-baseline justify-between border-b border-evos-line py-5 text-left"
              >
                <span className="font-evos-display text-[2rem] font-medium uppercase leading-none tracking-[-0.02em] text-evos-ink transition-transform duration-300 group-hover:translate-x-2">
                  {link.label}
                </span>
                <span className="font-evos-mono text-xs text-evos-muted" aria-hidden="true">
                  0{i + 1}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-10">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate(ROUTES.REGISTER)
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-evos-ink px-8 py-3 font-evos-mono text-xs uppercase tracking-[0.2em] text-evos-bg transition-colors hover:bg-evos-accent"
            >
              Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate(ROUTES.LOGIN)
              }}
              className="inline-flex min-h-12 items-center justify-center border border-evos-ink px-8 py-3 font-evos-mono text-xs uppercase tracking-[0.2em] text-evos-ink transition-colors hover:bg-evos-ink hover:text-evos-bg"
            >
              Sign in
            </button>
          </div>
        </div>
      )}
    </>
  )
}
