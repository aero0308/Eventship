'use client'

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass } from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { navigate, useHashRoute } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Layout } from '@/components/layout/Layout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { HomePage } from '@/components/pages/HomePage'
import { LoginPage } from '@/components/pages/LoginPage'
import { RegisterPage } from '@/components/pages/RegisterPage'
import { DashboardPage } from '@/components/pages/DashboardPage'
import { EventsPage } from '@/components/pages/EventsPage'
import { TasksPage } from '@/components/pages/TasksPage'
import { TeamsPage } from '@/components/pages/TeamsPage'
import { Button } from '@/components/ui/button'

const PROTECTED_PATHS: readonly string[] = [ROUTES.DASHBOARD, ROUTES.EVENTS, ROUTES.TASKS, ROUTES.TEAMS]

const PAGE_TRANSITION = { duration: 0.25, ease: 'easeOut' as const }

function MotionPage({ transitionKey, children }: { transitionKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={PAGE_TRANSITION}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Shown on protected routes while the redirect to /login happens. */
function AuthRedirectPrompt() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-stone-50 px-4 text-center">
      <LoadingSpinner label="Checking your session…" />
      <p className="max-w-sm text-sm text-stone-500">You need to be signed in to view this page.</p>
      <Button className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => navigate(ROUTES.LOGIN)}>
        Go to sign in
      </Button>
    </div>
  )
}

function NotFoundCard({ path }: { path: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={PAGE_TRANSITION}
        className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-stone-900">Page not found</h1>
        <p className="mt-2 text-sm text-stone-500">
          Nothing lives at <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{path}</code>. Let&apos;s get you
          back on track.
        </p>
        <Button className="mt-6 min-h-11 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => navigate(ROUTES.HOME)}>
          Back to home
        </Button>
      </motion.div>
    </div>
  )
}

export default function Page() {
  const path = useHashRoute()
  const pathname = path.split('?')[0] || '/'
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // Route guards: bounce signed-in users away from public/auth pages and
  // signed-out users away from protected pages.
  useEffect(() => {
    if (!initialized) return
    if (user && (pathname === ROUTES.HOME || pathname === ROUTES.LOGIN || pathname === ROUTES.REGISTER)) {
      navigate(ROUTES.DASHBOARD, true)
      return
    }
    if (!user && PROTECTED_PATHS.includes(pathname)) {
      navigate(ROUTES.LOGIN, true)
    }
  }, [initialized, user, pathname])

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <LoadingSpinner size="h-8 w-8" label="Loading EventFlow…" />
      </div>
    )
  }

  const isHome = pathname === ROUTES.HOME
  const isAuthRoute = pathname === ROUTES.LOGIN || pathname === ROUTES.REGISTER
  const isProtectedRoute = PROTECTED_PATHS.includes(pathname)

  let content: ReactNode
  let transitionKey: string

  if (isHome) {
    content = <HomePage />
    transitionKey = 'home'
  } else if (isAuthRoute) {
    const title = pathname === ROUTES.LOGIN ? 'Welcome back' : 'Create your account'
    const subtitle =
      pathname === ROUTES.LOGIN
        ? 'Sign in to keep your events on track.'
        : 'Join EventFlow and start planning in minutes.'
    content = (
      <AuthLayout title={title} subtitle={subtitle}>
        {pathname === ROUTES.LOGIN ? <LoginPage /> : <RegisterPage />}
      </AuthLayout>
    )
    transitionKey = 'auth'
  } else if (isProtectedRoute) {
    if (!user) {
      content = <AuthRedirectPrompt />
      transitionKey = 'auth-redirect'
    } else {
      // Layout stays mounted across in-app navigation; only the inner page animates.
      content = (
        <Layout>
          <MotionPage transitionKey={pathname}>
            {pathname === ROUTES.DASHBOARD && <DashboardPage />}
            {pathname === ROUTES.EVENTS && <EventsPage />}
            {pathname === ROUTES.TASKS && <TasksPage />}
            {pathname === ROUTES.TEAMS && <TeamsPage />}
          </MotionPage>
        </Layout>
      )
      transitionKey = 'app'
    }
  } else {
    content = <NotFoundCard path={path} />
    transitionKey = 'not-found'
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={PAGE_TRANSITION}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  )
}
