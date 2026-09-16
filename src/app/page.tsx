'use client'

import { useEffect, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass } from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { navigate, useHashRoute } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Layout } from '@/components/layout/Layout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { HomePage } from '@/components/pages/HomePage'
import { OnboardingPage } from '@/components/pages/OnboardingPage'
import { LoginPage } from '@/components/pages/LoginPage'
import { RegisterPage } from '@/components/pages/RegisterPage'
import { ForgotPasswordPage } from '@/components/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/components/pages/ResetPasswordPage'
import { Button } from '@/components/ui/button'

/*
 * Performance (Testing & Polish): the authenticated app is code-split per
 * page. Landing + auth stay in the entry bundle for a fast first paint;
 * each dashboard route (charts, dnd-kit, tables and all) loads on demand
 * with a centered spinner fallback.
 * NOTE: Next.js 16 requires the options argument of dynamic() to be an
 * inline object literal (a shared const is rejected at compile time).
 */
function PageLoadingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner label="Loading…" />
    </div>
  )
}

const DashboardPage = dynamic(
  () => import('@/components/pages/DashboardPage').then((m) => m.DashboardPage),
  { loading: PageLoadingFallback, ssr: false }
)
const EventsPage = dynamic(
  () => import('@/components/pages/EventsPage').then((m) => m.EventsPage),
  { loading: PageLoadingFallback, ssr: false }
)
const EventDetailPage = dynamic(
  () => import('@/components/pages/EventDetailPage').then((m) => m.EventDetailPage),
  { loading: PageLoadingFallback, ssr: false }
)
const TasksPage = dynamic(
  () => import('@/components/pages/TasksPage').then((m) => m.TasksPage),
  { loading: PageLoadingFallback, ssr: false }
)
const TeamsPage = dynamic(
  () => import('@/components/pages/TeamsPage').then((m) => m.TeamsPage),
  { loading: PageLoadingFallback, ssr: false }
)
const CalendarPage = dynamic(
  () => import('@/components/pages/CalendarPage').then((m) => m.CalendarPage),
  { loading: PageLoadingFallback, ssr: false }
)
const AdminPage = dynamic(
  () => import('@/components/pages/AdminPage').then((m) => m.AdminPage),
  { loading: PageLoadingFallback, ssr: false }
)
const ActivityPage = dynamic(
  () => import('@/components/pages/ActivityPage').then((m) => m.ActivityPage),
  { loading: PageLoadingFallback, ssr: false }
)
const ProfilePage = dynamic(
  () => import('@/components/pages/ProfilePage').then((m) => m.ProfilePage),
  { loading: PageLoadingFallback, ssr: false }
)
const BlogArticlePage = dynamic(
  () => import('@/components/landing/BlogArticlePage').then((m) => m.BlogArticlePage),
  {
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f3]">
        <LoadingSpinner label="Loading article…" />
      </div>
    ),
    ssr: false,
  }
)
const RoomSettingsPage = dynamic(
  () => import('@/components/pages/RoomSettingsPage').then((m) => m.RoomSettingsPage),
  { loading: PageLoadingFallback, ssr: false }
)

const PROTECTED_PATHS: readonly string[] = [
  ROUTES.DASHBOARD,
  ROUTES.EVENTS,
  ROUTES.TASKS,
  ROUTES.MY_TASKS,
  ROUTES.TEAMS,
  ROUTES.CALENDAR,
  ROUTES.ACTIVITY,
  ROUTES.PROFILE,
  ROUTES.ADMIN,
  ROUTES.ROOM_SETTINGS,
]

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-4 text-center">
      <LoadingSpinner label="Checking your session…" />
      <p className="max-w-sm text-sm text-muted-foreground">You need to be signed in to view this page.</p>
      <Button className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => navigate(ROUTES.LOGIN)}>
        Go to sign in
      </Button>
    </div>
  )
}

function NotFoundCard({ path }: { path: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={PAGE_TRANSITION}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing lives at <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{path}</code>. Let&apos;s get you
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
  const eventDetailId = pathname.match(/^\/events\/([^/]+)$/)?.[1] ?? null
  const blogSlug = pathname.match(/^\/blog\/([^/?]+)$/)?.[1] ?? null
  const isMyTasks = pathname === ROUTES.MY_TASKS
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // Route guards: bounce signed-in users away from public/auth pages and
  // signed-out users away from protected pages. Multi-tenant: room-less users
  // are held at the onboarding gate instead of the dashboard.
  useEffect(() => {
    if (!initialized) return
    const isProtected = PROTECTED_PATHS.includes(pathname) || eventDetailId !== null
    if (user && (pathname === ROUTES.HOME || pathname === ROUTES.LOGIN || pathname === ROUTES.REGISTER)) {
      navigate(user.needsOnboarding ? ROUTES.ONBOARDING : ROUTES.DASHBOARD, true)
      return
    }
    if (!user && (isProtected || pathname === ROUTES.ONBOARDING)) {
      navigate(ROUTES.LOGIN, true)
      return
    }
    if (user && isProtected && user.needsOnboarding) {
      // Authenticated but no room yet — join/create before any data route.
      navigate(ROUTES.ONBOARDING, true)
      return
    }
    if (user && !user.needsOnboarding && pathname === ROUTES.ONBOARDING) {
      navigate(ROUTES.DASHBOARD, true)
    }
  }, [initialized, user, pathname, eventDetailId])

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="h-8 w-8" label="Loading EventFlow…" />
      </div>
    )
  }

  const isHome = pathname === ROUTES.HOME
  const isOnboarding = pathname === ROUTES.ONBOARDING
  const isAuthRoute =
    pathname === ROUTES.LOGIN ||
    pathname === ROUTES.REGISTER ||
    pathname === ROUTES.FORGOT_PASSWORD ||
    pathname === ROUTES.RESET_PASSWORD
  const isProtectedRoute = PROTECTED_PATHS.includes(pathname) || eventDetailId !== null

  let content: ReactNode
  let transitionKey: string

  if (isHome) {
    content = <HomePage />
    transitionKey = 'home'
  } else if (blogSlug !== null) {
    // Public editorial route: #/blog/<slug>. Visible signed-in or not.
    content = <BlogArticlePage slug={blogSlug} />
    transitionKey = `blog-${blogSlug}`
  } else if (isOnboarding) {
    // Mandatory multi-tenant gate: requires auth, forbids an existing room
    // (those users are redirected to the dashboard by the guard above).
    if (!user) {
      content = <AuthRedirectPrompt />
      transitionKey = 'auth-redirect'
    } else if (user.needsOnboarding) {
      content = <OnboardingPage />
      transitionKey = 'onboarding'
    } else {
      content = (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <LoadingSpinner label="Entering your room…" />
        </div>
      )
      transitionKey = 'onboarding-redirect'
    }
  } else if (isAuthRoute) {
    const authMeta: Record<string, { title: string; subtitle: string }> = {
      [ROUTES.LOGIN]: { title: 'Welcome back', subtitle: 'Sign in to keep your events on track.' },
      [ROUTES.REGISTER]: { title: 'Create your account', subtitle: 'Join EventFlow and start planning in minutes.' },
      [ROUTES.FORGOT_PASSWORD]: { title: 'Reset your password', subtitle: "We'll help you get back into your account." },
      [ROUTES.RESET_PASSWORD]: { title: 'Choose a new password', subtitle: 'Pick something strong — you will use it to sign back in.' },
    }
    const meta = authMeta[pathname] ?? authMeta[ROUTES.LOGIN]
    content = (
      <AuthLayout title={meta.title} subtitle={meta.subtitle}>
        {pathname === ROUTES.LOGIN && <LoginPage />}
        {pathname === ROUTES.REGISTER && <RegisterPage />}
        {pathname === ROUTES.FORGOT_PASSWORD && <ForgotPasswordPage />}
        {pathname === ROUTES.RESET_PASSWORD && <ResetPasswordPage />}
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
            {eventDetailId !== null && <EventDetailPage eventId={eventDetailId} />}
            {eventDetailId === null && pathname === ROUTES.DASHBOARD && <DashboardPage />}
            {eventDetailId === null && pathname === ROUTES.EVENTS && <EventsPage />}
            {eventDetailId === null && pathname === ROUTES.TASKS && <TasksPage scope="all" />}
            {eventDetailId === null && isMyTasks && <TasksPage scope="mine" key="my-tasks" />}
            {eventDetailId === null && pathname === ROUTES.TEAMS && <TeamsPage />}
            {eventDetailId === null && pathname === ROUTES.CALENDAR && <CalendarPage />}
            {eventDetailId === null && pathname === ROUTES.ACTIVITY && <ActivityPage />}
            {eventDetailId === null && pathname === ROUTES.PROFILE && <ProfilePage />}
            {eventDetailId === null && pathname === ROUTES.ADMIN && <AdminPage />}
            {eventDetailId === null && pathname === ROUTES.ROOM_SETTINGS && <RoomSettingsPage />}
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
