'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CheckSquare,
  Clock,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import type { NotificationDTO, NotificationType } from '@/types'
import { ROUTES, ROLE_BADGE_CLASSES, ROLE_LABELS, TASK_STATUS_LABELS } from '@/lib/constants'
import { api } from '@/lib/api-client'
import {
  clearRealtimeRooms,
  disconnectRealtime,
  getRealtimeSocket,
  setRealtimeRooms,
  setRealtimeUser,
  type BoardChangePayload,
} from '@/lib/realtime-client'
import { useHashRoute, navigate } from '@/hooks/use-hash-route'
import { useShortcutModifier } from '@/hooks/use-platform'
import { useKeyboardShortcuts, formatShortcut } from '@/hooks/use-keyboard-shortcuts'
import { useAuthStore } from '@/stores/auth-store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { NotificationPrefsDialog } from '@/components/layout/NotificationPrefsDialog'
import { LiveBadge } from '@/components/shared/RealtimeChrome'

interface LayoutProps {
  children: React.ReactNode
}

const subscribeNoop = () => () => undefined

/** Light/dark switcher. Renders a stable placeholder until hydrated to avoid mismatch. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // subscribe-only store: false during SSR/hydration pass, true on the client after mount.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )

  const isDark = resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-11 w-11 text-muted-foreground hover:text-foreground"
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle color theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted && isDark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </Button>
  )
}

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

// "My Tasks" intentionally lives as a tab inside the Tasks page (not a separate
// nav entry) to keep the navbar uncluttered. Activity lives off the navbar on
// purpose — the dashboard's activity feed links to the full page.
const NAV_ITEMS: NavItem[] = [
  { path: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
  { path: ROUTES.EVENTS, label: 'Events', icon: CalendarDays },
  { path: ROUTES.CALENDAR, label: 'Calendar', icon: CalendarRange },
  { path: ROUTES.TASKS, label: 'Tasks', icon: CheckSquare },
  { path: ROUTES.TEAMS, label: 'Teams', icon: Users },
]

/** Manager-only nav entry, appended when the signed-in user is an EVENT_MANAGER. */
const ADMIN_NAV_ITEM: NavItem = { path: ROUTES.ADMIN, label: 'Admin', icon: ShieldCheck }

const NOTIFICATION_STYLE: Record<NotificationType, { icon: LucideIcon; classes: string }> = {
  TASK_ASSIGNED: { icon: UserPlus, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  TASK_STATUS_CHANGED: { icon: RefreshCw, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  TASK_COMPLETED: { icon: CheckCircle2, classes: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  TASK_BLOCKED: { icon: AlertTriangle, classes: 'bg-red-100 text-red-600' },
  COMMENT_ADDED: { icon: MessageSquare, classes: 'bg-muted text-muted-foreground' },
  DEADLINE_APPROACHING: { icon: Clock, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
}

/** Friendly label for live notification toasts (Phase 7). */
const NOTIF_TOAST_CONTEXT: Record<string, string> = {
  TASK_ASSIGNED: 'Assigned to you',
  TASK_STATUS_CHANGED: 'Task status changed',
  TASK_COMPLETED: 'Task completed',
  TASK_BLOCKED: 'Task blocked',
  COMMENT_ADDED: 'New comment',
  DEADLINE_APPROACHING: 'Deadline approaching',
}

/** Left-accent color per target status for the remote status-move toasts. */
function statusToastClass(status: string): string {
  if (status === 'BLOCKED') return 'border-l-4 border-l-red-500'
  if (status === 'COMPLETED') return 'border-l-4 border-l-emerald-500'
  return 'border-l-4 border-l-amber-500'
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function Layout({ children }: LayoutProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const path = useHashRoute()
  const pathname = path.split('?')[0] || '/'
  const { toast } = useToast()

  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifLoading, setNotifLoading] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const shortcutMod = useShortcutModifier()

  const navItems = useMemo(
    () => (user?.role === 'EVENT_MANAGER' ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS),
    [user]
  )

  // A11y: Alt+1…6 jump straight to nav destinations without a pointer.
  // The palette (Ctrl/Cmd+K) stays the discoverable “search everything” path.
  const handleNavigateRef = useRef<(target: string) => void>(() => {})
  useKeyboardShortcuts(
    useMemo(
      () =>
        navItems.map((item, index) => ({
          key: String(index + 1),
          alt: true,
          action: () => handleNavigateRef.current(item.path),
        })),
      [navItems]
    )
  )

  const loadNotifications = useCallback(async () => {
    try {
      setNotifLoading(true)
      const data = await api.get<{ notifications: NotificationDTO[]; unreadCount: number }>('/notifications')
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // Silent — the bell will simply keep the previous state.
    } finally {
      setNotifLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void loadNotifications()
    const interval = setInterval(() => void loadNotifications(), 30_000)
    return () => clearInterval(interval)
  }, [user, loadNotifications])

  // Realtime bell: join the user's personal room and refresh instantly when a
  // notification is pushed (the 30s poll above stays as a fallback).
  const loadNotificationsRef = useRef(loadNotifications)
  loadNotificationsRef.current = loadNotifications
  useEffect(() => {
    if (!user) return
    setRealtimeUser({ id: user.id, fullName: user.fullName, role: user.role })
    setRealtimeRooms('notifications', [`user:${user.id}`])
    const socket = getRealtimeSocket()
    if (!socket) return
    const handler = () => void loadNotificationsRef.current()
    socket.on('notification:new', handler)
    return () => {
      socket.off('notification:new', handler)
      clearRealtimeRooms('notifications')
    }
  }, [user])

  // Phase 7: global toast layer for REMOTE realtime events. The shared socket
  // delivers board changes for every room a mounted page scope joined, plus
  // personal notifications — remote actions become live toasts here while the
  // pages themselves apply the data changes. Own actions are skipped (the
  // acting page already gives feedback) and a tiny per-entity throttle
  // protects against duplicate/bursty broadcasts.
  const recentToastAtRef = useRef(new Map<string, number>())
  useEffect(() => {
    if (!user) return
    const socket = getRealtimeSocket()
    if (!socket) return
    const recent = recentToastAtRef.current
    const shouldToast = (key: string) => {
      const now = Date.now()
      const last = recent.get(key) ?? 0
      recent.set(key, now)
      return now - last > 1500
    }
    const titleOf = (payload: BoardChangePayload): string | undefined => {
      if (payload.taskTitle) return payload.taskTitle
      const task = payload.task as { title?: string } | undefined
      return typeof task?.title === 'string' ? task.title : undefined
    }
    const onBoardChange = (payload: BoardChangePayload) => {
      if (!payload || payload.actorId === user.id) return
      const title = titleOf(payload)
      if (payload.type === 'task:created') {
        if (!shouldToast(`created:${payload.taskId ?? ''}`)) return
        toast({
          title: 'New task created',
          description: title ? `“${title}” was just added to the board.` : 'Someone added a task.',
          className: 'border-l-4 border-l-emerald-500',
        })
      } else if (payload.type === 'task:updated' && payload.statusChange) {
        if (!shouldToast(`status:${payload.taskId ?? ''}:${payload.statusChange.to}`)) return
        const label = TASK_STATUS_LABELS[payload.statusChange.to] ?? payload.statusChange.to.toLowerCase()
        toast({
          title: `Task moved to ${label}`,
          description: title ? `“${title}” is now ${label.toLowerCase()}.` : undefined,
          className: statusToastClass(payload.statusChange.to),
        })
      } else if (payload.type === 'task:deleted') {
        if (!shouldToast(`deleted:${payload.taskId ?? ''}`)) return
        toast({
          title: 'Task deleted',
          description: title ? `“${title}” was removed from the board.` : undefined,
          className: 'border-l-4 border-l-red-500',
        })
      } else if (payload.bulk) {
        if (!shouldToast(`bulk:${payload.type}`)) return
        const parts = [`${payload.updated ?? 0} updated`, ...(payload.deleted ? [`${payload.deleted} deleted`] : [])]
        toast({
          title: 'Bulk update applied',
          description: parts.join(' · '),
          className: 'border-l-4 border-l-amber-500',
        })
      }
    }
    const onNotificationNew = (payload: { message?: string; type?: string }) => {
      if (!payload?.message) return
      if (!shouldToast(`notif:${payload.message}`)) return
      toast({
        title: payload.message,
        description: NOTIF_TOAST_CONTEXT[payload.type ?? ''] ?? 'New notification',
        className: 'border-l-4 border-l-emerald-500',
      })
    }
    socket.on('board:changed', onBoardChange)
    socket.on('notification:new', onNotificationNew)
    return () => {
      socket.off('board:changed', onBoardChange)
      socket.off('notification:new', onNotificationNew)
    }
  }, [user, toast])

  const markRead = async (id: string) => {
    const previous = notifications
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((count) => Math.max(0, count - (previous.find((n) => n.id === id && !n.read) ? 1 : 0)))
    try {
      await api.patch('/notifications', { id })
    } catch {
      setNotifications(previous)
      void loadNotifications()
    }
  }

  const markAllRead = async () => {
    const previous = notifications
    setNotifications((list) => list.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await api.patch('/notifications', { markAll: true })
    } catch {
      setNotifications(previous)
      void loadNotifications()
    }
  }

  const handleLogout = async () => {
    toast({ title: 'Signed out', description: 'See you soon!' })
    // Drop the authenticated socket so a signed-out browser holds no session.
    disconnectRealtime()
    await logout()
  }

  const handleNavigate = (target: string) => {
    setMobileOpen(false)
    navigate(target)
  }

  useEffect(() => {
    handleNavigateRef.current = handleNavigate
  })

  const isActive = (itemPath: string) => pathname === itemPath

  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      {/* A11y: bypass link — navigates programmatically so the SPA hash route is untouched. */}
      <a
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          const main = document.getElementById('main-content')
          main?.focus()
          main?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 min-[1400px]:max-w-[1400px]">
          {/* Logo + desktop nav */}
          <div className="flex min-w-0 items-center">
            <button
              type="button"
              onClick={() => handleNavigate(ROUTES.DASHBOARD)}
              className="flex min-h-11 items-center gap-2.5 rounded-md"
              aria-label="Eventship home"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <CalendarRange className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold tracking-tight text-foreground">Eventship</span>
            </button>

            <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavigate(item.path)}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  aria-keyshortcuts={`Alt+${navItems.indexOf(item) + 1}`}
                  title={`${item.label} (${formatShortcut({ key: String(navItems.indexOf(item) + 1), alt: true })})`}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium transition-colors min-[1400px]:px-3',
                    isActive(item.path)
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="hidden whitespace-nowrap min-[1400px]:inline" aria-hidden="true">{item.label}</span>
                  <span className="sr-only">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5">
            {/* Command palette trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-10 w-48 items-center gap-2 rounded-full border border-border bg-muted/50 pl-3.5 pr-2 text-sm text-muted-foreground transition-colors hover:border-emerald-300/70 hover:bg-accent hover:text-foreground dark:hover:border-emerald-500/40 lg:inline-flex"
              aria-label="Open search (Command K)"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Search…</span>
              <span className="ml-auto flex shrink-0 items-center gap-1" aria-hidden="true">
                <kbd className="inline-flex h-5 min-w-6 select-none items-center justify-center rounded-md border border-border border-b-2 bg-background px-1.5 font-sans text-[10px] font-semibold text-muted-foreground shadow-sm">
                  {shortcutMod}
                </kbd>
                <kbd className="inline-flex h-5 min-w-5 select-none items-center justify-center rounded-md border border-border border-b-2 bg-background px-1.5 font-sans text-[10px] font-semibold text-muted-foreground shadow-sm">
                  K
                </kbd>
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-muted-foreground hover:text-foreground lg:hidden"
              aria-label="Open search"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Button>
            {/* Realtime connection indicator (Phase 7: visible app-wide) */}
            <LiveBadge className="hidden sm:inline-flex" />
            {/* Theme toggle */}
            <ThemeToggle />
            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-11 w-11 text-muted-foreground hover:text-foreground"
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[22rem] p-0">
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label="Notification preferences"
                      onClick={() => setPrefsOpen(true)}
                    >
                      <Settings2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-emerald-700 hover:text-emerald-800"
                      onClick={() => void markAllRead()}
                      disabled={unreadCount === 0}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Mark all read
                    </Button>
                  </div>
                </div>
                <div className="scrollbar-thin max-h-96 overflow-y-auto">
                  {notifLoading && notifications.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground/70">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                      <Inbox className="h-8 w-8 text-stone-300" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {notifications.map((n) => {
                        const style = NOTIFICATION_STYLE[n.type] ?? NOTIFICATION_STYLE.COMMENT_ADDED
                        const Icon = style.icon
                        return (
                          <li key={n.id}>
                            <button
                              type="button"
                              onClick={() => void markRead(n.id)}
                              className={cn(
                                'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                                !n.read && 'bg-emerald-50/50'
                              )}
                              title={n.read ? undefined : 'Mark as read'}
                            >
                              <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', style.classes)}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">{n.type.replace(/_/g, ' ').toLowerCase()}</span>
                                  {!n.read ? (
                                    <span className="relative flex h-1.5 w-1.5 shrink-0" aria-label="unread">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" aria-hidden="true" />
                                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-sm leading-snug text-foreground">{n.message}</span>
                                <span className="mt-1 block text-xs text-muted-foreground/70">
                                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-accent"
                  aria-label="Open user menu"
                >
                  <UserAvatar
                    fullName={user?.fullName ?? ''}
                    avatarUrl={user?.avatarUrl}
                    className="h-8 w-8 border border-border"
                    fallbackClassName="bg-emerald-600 text-xs font-semibold text-white"
                  />
                  <span className="hidden max-w-32 truncate text-sm font-medium text-foreground lg:block">
                    {user?.fullName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold text-foreground">{user?.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {user ? (
                      <Badge variant="outline" className={cn('text-[11px]', ROLE_BADGE_CLASSES[user.role])}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    ) : null}
                    {user?.team ? (
                      <Badge variant="outline" className="border-border bg-muted/50 text-[11px] text-muted-foreground">
                        <Users className="mr-1 h-3 w-3" aria-hidden="true" />
                        {user.team.name}
                      </Badge>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigate(ROUTES.DASHBOARD)}>
                  <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden="true" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate(ROUTES.CALENDAR)}>
                  <CalendarRange className="mr-2 h-4 w-4" aria-hidden="true" />
                  Calendar
                </DropdownMenuItem>
                {user?.role === 'EVENT_MANAGER' ? (
                  <DropdownMenuItem onClick={() => handleNavigate(ROUTES.ADMIN)}>
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    Admin · Users
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => handleNavigate(ROUTES.PROFILE)}>
                  <User className="mr-2 h-4 w-4" aria-hidden="true" />
                  Profile &amp; settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate(ROUTES.ROOM_SETTINGS)}>
                  <Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  My Room
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void handleLogout()}
                  className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-500/10 dark:focus:text-red-300"
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground md:hidden" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b border-border p-4 text-left">
                  <SheetTitle className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <CalendarRange className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-lg font-bold tracking-tight">Eventship</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Mobile">
                  {navItems.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      aria-current={isActive(item.path) ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                        isActive(item.path)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </button>
                  ))}
                </nav>
                <Separator />
                <div className="flex items-center gap-3 p-4">
                  <UserAvatar
                    fullName={user?.fullName ?? ''}
                    avatarUrl={user?.avatarUrl}
                    className="h-9 w-9 border border-border"
                    fallbackClassName="bg-emerald-600 text-xs font-semibold text-white"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{user?.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{user ? ROLE_LABELS[user.role] : ''}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    onClick={() => void handleLogout()}
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <NotificationPrefsDialog open={prefsOpen} onOpenChange={setPrefsOpen} />

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      </main>

      <footer className="mt-auto border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <span className="font-medium text-muted-foreground">Eventship — Event Management System</span>
          <span>© {new Date().getFullYear()} Eventship. Plan events. Coordinate teams. Ship on time.</span>
        </div>
      </footer>
    </div>
  )
}
