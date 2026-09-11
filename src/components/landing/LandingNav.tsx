'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'
import { cn } from '@/lib/utils'
import { scrollToSection, scrollToTop } from '@/components/landing/scroll'

const NAV_LINKS = [
  { label: 'Features', id: 'features' },
  { label: 'Benefits', id: 'benefits' },
  { label: 'Pricing', id: 'cta' },
  { label: 'Blog', id: 'blog' },
  { label: 'FAQ', id: 'faq' },
] as const

const MOBILE_LINKS = NAV_LINKS.map((link, index) => ({ ...link, index }))

/**
 * Fixed landing navigation: transparent over the hero, then blurs + darkens
 * with a hairline border once the page scrolls. Collapses to a full-screen
 * slide-in menu on mobile. All links scroll in-page (hash-router safe) or
 * navigate to the auth SPA routes.
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const go = (id: string) => {
    setOpen(false)
    // Let the menu close before scrolling on mobile.
    if (reduce) {
      scrollToSection(id)
      return
    }
    window.setTimeout(() => scrollToSection(id), open ? 80 : 0)
  }

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-fora-border bg-fora-bg/80 backdrop-blur-xl' : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Wordmark */}
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            scrollToTop()
          }}
          className="flex items-center gap-2.5"
          aria-label="Event OS — back to top"
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-fora-accent shadow-[0_0_14px_rgba(99,102,241,0.9)]"
          />
          <span className="text-[15px] font-semibold tracking-tight text-white">EVENT OS</span>
        </button>

        {/* Center links (desktop) */}
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <button
                type="button"
                onClick={() => go(link.id)}
                className="text-sm text-fora-text-2 transition-colors duration-200 hover:text-white"
              >
                {link.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Right actions (desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => navigate(ROUTES.LOGIN)}
            className="rounded-full px-4 py-2 text-sm text-fora-text-2 transition-colors duration-200 hover:text-white"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.REGISTER)}
            className="rounded-full bg-fora-accent px-4.5 py-2 text-sm font-medium text-white shadow-[0_0_24px_rgba(99,102,241,0.4)] transition-all duration-200 hover:bg-fora-accent-hover hover:shadow-[0_0_36px_rgba(99,102,241,0.6)]"
          >
            Get Started
          </button>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Open navigation menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>

      {/* Mobile slide-in menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 flex flex-col bg-fora-bg/95 backdrop-blur-xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex h-16 items-center justify-between px-6">
              <span className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-fora-accent" />
                <span className="text-[15px] font-semibold tracking-tight text-white">EVENT OS</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-6 pt-8">
              <ul className="space-y-2">
                {MOBILE_LINKS.map((link) => (
                  <motion.li
                    key={link.label}
                    initial={reduce ? false : { opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 + link.index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <button
                      type="button"
                      onClick={() => go(link.id)}
                      className="group flex w-full items-center justify-between border-b border-fora-border py-4 text-left"
                    >
                      <span className="text-2xl font-semibold tracking-tight text-white">{link.label}</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-5 w-5 text-fora-muted transition-all duration-300 group-hover:translate-x-1 group-hover:text-fora-accent"
                      />
                    </button>
                  </motion.li>
                ))}
              </ul>
            </nav>

            <div className="space-y-3 border-t border-fora-border p-6">
              <button
                type="button"
                onClick={() => navigate(ROUTES.REGISTER)}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-fora-accent text-sm font-medium text-white shadow-[0_0_28px_rgba(99,102,241,0.45)]"
              >
                Get Started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.LOGIN)}
                className="flex min-h-12 w-full items-center justify-center rounded-full border border-white/15 text-sm font-medium text-white"
              >
                Sign In
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
