'use client'

import { motion } from 'framer-motion'
import { CalendarRange } from 'lucide-react'
import { APP_NAME, APP_TAGLINE } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

/** Centered auth shell with a soft emerald backdrop — no header nav. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-stone-50 px-4 py-10">
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
          <span className="text-xl font-bold tracking-tight text-stone-900">{APP_NAME}</span>
          <span className="text-xs text-stone-500">{APP_TAGLINE}</span>
        </div>

        <Card className="w-full border-stone-200 shadow-lg shadow-stone-900/5">
          <CardContent className="p-6">
            <div className="mb-5">
              <h1 className="text-xl font-bold tracking-tight text-stone-900">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
            </div>
            {children}
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-stone-400">
          {APP_NAME} — Event Management System · {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  )
}
