'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bell,
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
  User,
  UserPlus,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { NotificationDTO, NotificationType } from '@/types'
import { ROUTES, ROLE_BADGE_CLASSES, ROLE_LABELS } from '@/lib/constants'
import { api } from '@/lib/api-client'
import { useHashRoute, navigate } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

interface LayoutProps {
  children: React.ReactNode
}

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { path: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
  { path: ROUTES.EVENTS, label: 'Events', icon: CalendarDays },
  { path: ROUTES.TASKS, label: 'Tasks', icon: CheckSquare },
  { path: ROUTES.TEAMS, label: 'Teams', icon: Users },
]

const NOTIFICATION_STYLE: Record<NotificationType, { icon: LucideIcon; classes: string }> = {
  TASK_ASSIGNED: { icon: UserPlus, classes: 'bg-amber-100 text-amber-700' },
  TASK_STATUS_CHANGED: { icon: RefreshCw, classes: 'bg-emerald-100 text-emerald-700' },
  TASK_COMPLETED: { icon: CheckCircle2, classes: 'bg-teal-100 text-teal-700' },
  TASK_BLOCKED: { icon: AlertTriangle, classes: 'bg-red-100 text-red-600' },
  COMMENT_ADDED: { icon: MessageSquare, classes: 'bg-stone-100 text-stone-600' },
  DEADLINE_APPROACHING: { icon: Clock, classes: 'bg-amber-100 text-amber-700' },
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

  const initials = useMemo(() => (user ? initialsOf(user.fullName) : ''), [user])

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
    await logout()
  }

  const handleNavigate = (target: string) => {
    setMobileOpen(false)
    navigate(target)
  }

  const isActive = (itemPath: string) => pathname === itemPath

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
          {/* Logo + desktop nav */}
          <div className="flex min-w-0 items-center">
            <button
              type="button"
              onClick={() => handleNavigate(ROUTES.DASHBOARD)}
              className="flex min-h-11 items-center gap-2.5 rounded-md"
              aria-label="EventFlow home"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <CalendarRange className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold tracking-tight text-stone-900">EventFlow</span>
            </button>

            <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavigate(item.path)}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                    isActive(item.path)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5">
            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-11 w-11 text-stone-600 hover:text-stone-900"
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
                <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
                  <p className="text-sm font-semibold text-stone-900">Notifications</p>
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
                <div className="scrollbar-thin max-h-96 overflow-y-auto">
                  {notifLoading && notifications.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-stone-400">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                      <Inbox className="h-8 w-8 text-stone-300" aria-hidden="true" />
                      <p className="text-sm text-stone-500">You&apos;re all caught up.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {notifications.map((n) => {
                        const style = NOTIFICATION_STYLE[n.type] ?? NOTIFICATION_STYLE.COMMENT_ADDED
                        const Icon = style.icon
                        return (
                          <li key={n.id}>
                            <button
                              type="button"
                              onClick={() => void markRead(n.id)}
                              className={cn(
                                'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50',
                                !n.read && 'bg-emerald-50/50'
                              )}
                              title={n.read ? undefined : 'Mark as read'}
                            >
                              <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', style.classes)}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="truncate text-xs font-semibold text-stone-700">{n.type.replace(/_/g, ' ').toLowerCase()}</span>
                                  {!n.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="unread" /> : null}
                                </span>
                                <span className="mt-0.5 block text-sm leading-snug text-stone-700">{n.message}</span>
                                <span className="mt-1 block text-xs text-stone-400">
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
                  className="flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-stone-100"
                  aria-label="Open user menu"
                >
                  <Avatar className="h-8 w-8 border border-stone-200">
                    <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm font-medium text-stone-700 sm:block">
                    {user?.fullName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold text-stone-900">{user?.fullName}</p>
                  <p className="truncate text-xs text-stone-500">{user?.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {user ? (
                      <Badge variant="outline" className={cn('text-[11px]', ROLE_BADGE_CLASSES[user.role])}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    ) : null}
                    {user?.team ? (
                      <Badge variant="outline" className="border-stone-200 bg-stone-50 text-[11px] text-stone-600">
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
                <DropdownMenuItem disabled>
                  <User className="mr-2 h-4 w-4" aria-hidden="true" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleLogout()} className="text-red-600 focus:bg-red-50 focus:text-red-700">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 text-stone-600 md:hidden" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b border-stone-200 p-4 text-left">
                  <SheetTitle className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <CalendarRange className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-lg font-bold tracking-tight">EventFlow</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Mobile">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      aria-current={isActive(item.path) ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                        isActive(item.path)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      )}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </button>
                  ))}
                </nav>
                <Separator />
                <div className="flex items-center gap-3 p-4">
                  <Avatar className="h-9 w-9 border border-stone-200">
                    <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">{user?.fullName}</p>
                    <p className="truncate text-xs text-stone-500">{user ? ROLE_LABELS[user.role] : ''}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700"
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

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      </main>

      <footer className="mt-auto border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 py-4 text-center text-xs text-stone-500 sm:flex-row sm:text-left">
          <span className="font-medium text-stone-600">EventFlow — Event Management System</span>
          <span>© {new Date().getFullYear()} EventFlow. Plan events. Coordinate teams. Ship on time.</span>
        </div>
      </footer>
    </div>
  )
}
