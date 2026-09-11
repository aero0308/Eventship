'use client'

import { motion } from 'framer-motion'
import { CalendarRange, X } from 'lucide-react'
import { APP_NAME, APP_TAGLINE, ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'
import { Card, CardContent } from '@/components/ui/card'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

/** Centered auth shell with a soft emerald backdrop — no header nav. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-muted/50 px-4 py-10">
      {/* Close → back to landing page (top-right, thumb-friendly 44px target) */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.HOME)}
        aria-label="Close and return to home page"
        title="Back to home"
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur transition-all hover:rotate-90 hover:border-emerald-300/70 hover:bg-accent hover:text-foreground motion-reduce:hover:rotate-0 dark:hover:border-emerald-500/40 sm:right-6 sm:top-6"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Layered emerald/teal radial gradients */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(16,185,129,0.16),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_45%_at_85%_100%,rgba(20,184,166,0.12),transparent_70%)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 flex w-full max-w-md flex-col items-center"
      >
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
            <CalendarRange className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold tracking-tight text-foreground">{APP_NAME}</span>
          <span className="text-xs text-muted-foreground">{APP_TAGLINE}</span>
        </div>

        <Card className="w-full border-border shadow-lg shadow-stone-900/5">
          <CardContent className="p-6">
            <div className="mb-5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {children}
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground/70">
          {APP_NAME} — Event Management System · {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  )
}
