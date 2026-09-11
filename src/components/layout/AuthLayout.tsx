'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { APP_NAME, ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'
import { Card, CardContent } from '@/components/ui/card'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

const PANEL_BULLETS = [
  'One live board for every task, team and venue',
  'Blockers flagged — and resolved — in minutes',
  'Progress the whole crew watches in real time',
]

const PANEL_STATS = [
  { value: '10,000+', label: 'Events organized' },
  { value: '500+', label: 'Teams onboarded' },
  { value: '<1s', label: 'Real-time sync' },
] as const

/**
 * Fora-style dark auth shell: an editorial photographic panel on the left
 * (desktop) that mirrors the landing hero, and a centered form column on the
 * right. The `.fora-auth` scope remaps the shadcn CSS variables to the dark
 * fora palette, so Input/Label/Button/Select/Alert re-skin without touching
 * the shared primitives. Height-aware: on short viewports the `.auth-*` rules
 * in globals.css tighten the shell so the forms fit without scrolling.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  // Paint the body dark for the whole auth route (restored on unmount) so
  // overscroll and route transitions never flash the light app background.
  useEffect(() => {
    const previous = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#0a0a0a'
    return () => {
      document.body.style.backgroundColor = previous
    }
  }, [])

  return (
    <div className="fora-auth auth-shell relative flex min-h-svh flex-col overflow-hidden bg-fora-bg text-white lg:grid lg:grid-cols-[1.08fr_1fr] lg:flex-row">
      {/* ---- Left editorial panel (desktop only) --------------------------- */}
      <aside className="auth-aside relative hidden overflow-hidden lg:flex lg:flex-col">
        <Image
          src="/images/landing/hero-bg.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 54vw, 0vw"
          className="object-cover"
          unoptimized
        />
        {/* Legibility washes over the photo */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-fora-bg/75 via-fora-bg/45 to-fora-bg/85" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(55%_45%_at_25%_18%,rgba(99,102,241,0.16),transparent_70%)]"
        />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-fora-accent shadow-[0_0_14px_rgba(99,102,241,0.9)]"
            />
            <span className="text-[15px] font-semibold tracking-tight text-white">EVENT OS</span>
          </div>

          {/* Editorial pitch */}
          <div className="max-w-md py-10">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">
              The command center for event teams
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-white xl:text-5xl">
              Build events.
              <br />
              <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">
                Ship on time.
              </span>
            </h2>
            <ul className="mt-8 space-y-3.5">
              {PANEL_BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-fora-text-2">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-fora-accent/40 bg-fora-accent/15"
                  >
                    <Check className="h-3 w-3 text-fora-glow" />
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          {/* Stats strip */}
          <dl className="flex gap-10 xl:gap-12">
            {PANEL_STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-semibold tracking-tight text-white">{stat.value}</dd>
                <dd className="mt-1 text-[11px] uppercase tracking-[0.16em] text-fora-muted">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      {/* ---- Right form column -------------------------------------------- */}
      <main className="relative flex flex-1 flex-col px-5 pb-8 pt-6 sm:px-10 sm:pb-10">
        {/* Soft indigo wash behind the card (echoes the landing glow) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(99,102,241,0.08),transparent_70%)]"
        />

        {/* Close → back to landing (thumb-friendly 44px target) */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.HOME)}
          aria-label="Close and return to home page"
          title="Back to home"
          className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-fora-text-2 backdrop-blur transition-all hover:rotate-90 hover:border-white/25 hover:text-white motion-reduce:hover:rotate-0 sm:right-6 sm:top-6"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Mobile brand row (the aside is desktop-only) */}
        <div className="auth-brand relative z-10 mb-5 flex items-center gap-2.5 lg:hidden">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-fora-accent shadow-[0_0_14px_rgba(99,102,241,0.9)]"
          />
          <span className="auth-brand-name text-[15px] font-semibold tracking-tight text-white">EVENT OS</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center"
        >
          <Card className="auth-card w-full rounded-2xl border-white/10 bg-fora-surface/90 py-0 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur">
            <CardContent className="auth-card-content p-6 sm:p-8">
              <div className="auth-title-block mb-5">
                <h1 className="auth-title text-2xl font-semibold tracking-tight text-white">{title}</h1>
                {subtitle ? <p className="auth-subtitle mt-1.5 text-sm leading-relaxed text-fora-text-2">{subtitle}</p> : null}
              </div>
              {children}
            </CardContent>
          </Card>

          <p className="auth-footer mt-6 text-center text-xs text-fora-muted">
            {APP_NAME} — Event Management System · {new Date().getFullYear()}
          </p>
        </motion.div>
      </main>
    </div>
  )
}
