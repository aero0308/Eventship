'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  History,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  User,
  Users,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import type { SearchResultDTO } from '@/types'
import { EVENT_STATUS_CLASSES, EVENT_STATUS_LABELS, PRIORITY_LABELS, ROUTES, ROLE_LABELS } from '@/lib/constants'
import { api } from '@/lib/api-client'
import { navigate } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NavAction {
  label: string
  icon: LucideIcon
  run: () => void
  keywords?: string[]
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { resolvedTheme, setTheme } = useTheme()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultDTO | null>(null)
  const [searching, setSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Global ⌘K / Ctrl+K shortcut lives here so Layout stays lean.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  // Reset search state whenever the palette closes.
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(null)
      abortRef.current?.abort()
    }
  }, [open])

  // Debounced cross-entity search.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const data = await api.get<SearchResultDTO>(`/search?q=${encodeURIComponent(term)}`, controller.signal)
        setResults(data)
      } catch {
        // aborted or failed — keep previous results
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

  const go = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  const navActions = useMemo<NavAction[]>(() => {
    const actions: NavAction[] = [
      { label: 'Dashboard', icon: LayoutDashboard, run: () => go(ROUTES.DASHBOARD) },
      { label: 'Events', icon: CalendarDays, run: () => go(ROUTES.EVENTS) },
      { label: 'Calendar', icon: CalendarRange, run: () => go(ROUTES.CALENDAR), keywords: ['month', 'schedule', 'due dates'] },
      { label: 'Tasks board', icon: CheckSquare, run: () => go(ROUTES.TASKS) },
      { label: 'Teams', icon: Users, run: () => go(ROUTES.TEAMS) },
      { label: 'Activity feed', icon: History, run: () => go(ROUTES.ACTIVITY), keywords: ['log', 'audit', 'timeline'] },
    ]
    if (user?.role === 'EVENT_MANAGER') {
      actions.push({ label: 'Admin · User management', icon: ShieldCheck, run: () => go(ROUTES.ADMIN), keywords: ['users', 'roles', 'deactivate', 'accounts'] })
    }
    if (user) {
      actions.push({ label: 'My profile', icon: User, run: () => go(ROUTES.PROFILE), keywords: ['account', 'password', 'settings'] })
      actions.push({ label: 'My open tasks', icon: ListFilter, run: () => go(`${ROUTES.TASKS}?assignee=me`), keywords: ['assigned', 'mine'] })
      actions.push({ label: 'New event', icon: CalendarPlus, run: () => go(`${ROUTES.EVENTS}?new=1`), keywords: ['create', 'add'] })
    }
    actions.push({
      label: resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      icon: resolvedTheme === 'dark' ? Sun : Moon,
      run: () => {
        onOpenChange(false)
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
      },
      keywords: ['theme', 'appearance', 'toggle'],
    })
    if (user) {
      actions.push({
        label: 'Sign out',
        icon: LogOut,
        run: () => {
          onOpenChange(false)
          void logout()
        },
        keywords: ['logout', 'exit'],
      })
    }
    return actions
  }, [user, resolvedTheme, logout, setTheme])

  const hasResults =
    results !== null &&
    (results.events.length > 0 || results.tasks.length > 0 || results.teams.length > 0 || results.users.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search EventFlow</DialogTitle>
        <DialogDescription>Jump to a page or search across events, tasks, teams and people.</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <span className="sr-only">Jump to a page or search across events, tasks, teams and people.</span>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          <CommandInput placeholder="Search events, tasks, teams, people… (⌘K)" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[26rem]">
            {query.trim().length >= 2 && !hasResults ? (
              searching ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Searching…</div>
              ) : (
                <CommandEmpty>No matches for “{query.trim()}”.</CommandEmpty>
              )
            ) : null}

            {results && results.events.length > 0 ? (
              <CommandGroup heading="Events">
                {results.events.map((e) => (
                  <CommandItem key={e.id} value={`event-${e.id}`} onSelect={() => go(`${ROUTES.EVENTS}/${e.id}`)}>
                    <span className={cn('h-2 w-2 shrink-0 rounded-full border', EVENT_STATUS_CLASSES[e.status])} aria-hidden="true" />
                    <span className="truncate">{e.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{EVENT_STATUS_LABELS[e.status] ?? e.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results && results.tasks.length > 0 ? (
              <CommandGroup heading="Tasks">
                {results.tasks.map((t) => (
                  <CommandItem key={t.id} value={`task-${t.id}`} onSelect={() => go(`${ROUTES.TASKS}?event=${t.eventId}`)}>
                    <ClipboardList className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{t.title}</span>
                    <span className="ml-auto shrink-0 truncate pl-2 text-xs text-muted-foreground">
                      {t.eventName ?? ''} · {PRIORITY_LABELS[t.priority] ?? t.priority}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results && results.teams.length > 0 ? (
              <CommandGroup heading="Teams">
                {results.teams.map((t) => (
                  <CommandItem key={t.id} value={`team-${t.id}`} onSelect={() => go(ROUTES.TEAMS)}>
                    <Users className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{t.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results && results.users.length > 0 ? (
              <CommandGroup heading="People">
                {results.users.map((u) => (
                  <CommandItem key={u.id} value={`user-${u.id}`} onSelect={() => go(ROUTES.TEAMS)}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-semibold text-white">
                      {u.fullName.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                    </span>
                    <span className="truncate">{u.fullName}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {query.trim().length >= 2 && hasResults ? <CommandSeparator /> : null}

            <CommandGroup heading={query.trim().length >= 2 ? 'Actions' : 'Jump to'}>
              {navActions.map((action) => (
                <CommandItem key={action.label} value={`action-${action.label}`} keywords={action.keywords} onSelect={action.run}>
                  <action.icon className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
