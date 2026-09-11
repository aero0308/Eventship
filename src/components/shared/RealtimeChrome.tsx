'use client'

/**
 * Small realtime UI chrome shared by the board and event workspace:
 * - LiveBadge: pulsing emerald "Live" pill while the socket is connected.
 * - PresenceStack: avatars of other users currently viewing the same space
 *   (an event workspace, or a global board like the tasks kanban).
 */

import { useEffect, useState } from 'react'
import { Radio, WifiOff } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  onRealtimeStatusChange,
  type PresenceUser,
  type RealtimeStatus,
} from '@/lib/realtime-client'
import { cn } from '@/lib/utils'

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Visual + a11y config per connection status (Phase 7 spec 7.5). */
const STATUS_CONFIG: Record<
  RealtimeStatus,
  { label: string; className: string; icon: 'live' | 'down'; pulse: boolean; announce: string } | null
> = {
  connected: {
    label: 'Live',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    icon: 'live',
    pulse: true,
    announce: 'Realtime connected',
  },
  // Transient states render amber with a pulsing dot; only surfaced after the
  // socket has been live at least once (see quiet rule below).
  connecting: {
    label: 'Connecting…',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    icon: 'down',
    pulse: true,
    announce: 'Realtime connecting',
  },
  reconnecting: {
    label: 'Reconnecting…',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    icon: 'down',
    pulse: true,
    announce: 'Realtime reconnecting',
  },
  // Give up visually after several failed attempts (still retrying silently).
  error: {
    label: 'Offline',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    icon: 'down',
    pulse: false,
    announce: 'Realtime connection failed',
  },
  disconnected: null, // idle before first connect — no chip
}

export function LiveBadge({ className, subtle }: { className?: string; subtle?: boolean }) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [everConnected, setEverConnected] = useState(false)

  useEffect(
    () =>
      onRealtimeStatusChange((next) => {
        if (next === 'connected') setEverConnected(true)
        setStatus(next)
      }),
    []
  )

  // Quiet rule: stay hidden until the first successful connect so offline
  // deployments never show a permanent reconnecting chip; once live, degrade
  // visibly (amber "Reconnecting…" → red "Offline") per the Phase 7 spec.
  const config = STATUS_CONFIG[status]
  if (!config) return null
  if (!everConnected && status !== 'connected') return null

  const Icon = config.icon === 'live' ? Radio : WifiOff

  return (
    <span
      role="status"
      aria-label={config.announce}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-300',
        config.className,
        className
      )}
    >
      {config.icon === 'live' ? (
        <span className="relative flex h-3 w-3" aria-hidden="true">
          {config.pulse ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          ) : null}
          <Icon className="relative h-3 w-3" />
        </span>
      ) : (
        <span className="relative flex h-3 w-3" aria-hidden="true">
          {config.pulse ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
          ) : null}
          <Icon className="relative h-3 w-3" />
        </span>
      )}
      {subtle ? null : config.label}
    </span>
  )
}

export function PresenceStack({
  viewers,
  max = 4,
  context = 'this event',
  compact = false,
}: {
  viewers: PresenceUser[]
  max?: number
  /** Where the viewers are — used for the screen-reader label + tooltip. */
  context?: string
  /** Compact variant drops the "viewing now" text (dense headers). */
  compact?: boolean
}) {
  if (viewers.length === 0) return null
  const shown = viewers.slice(0, max)
  const overflow = viewers.length - shown.length

  return (
    <span
      className="group/presence relative inline-flex items-center gap-2 rounded-full px-1.5 py-0.5 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
      aria-label={`${viewers.length} other ${viewers.length === 1 ? 'person' : 'people'} viewing ${context}`}
    >
      {/* soft emerald halo behind the stack (styling detail) */}
      <span
        className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-emerald-400/10 blur-[6px]"
        aria-hidden="true"
      />
      {!compact ? (
        <span className="hidden text-[11px] font-medium text-muted-foreground sm:inline">
          {viewers.length === 1 ? 'viewing now' : `${viewers.length} viewing now`}
        </span>
      ) : null}
      <span className="flex -space-x-1.5">
        {shown.map((viewer, index) => (
          <span key={viewer.id} className="relative" style={{ zIndex: max - index }}>
            <Avatar className="h-6 w-6 ring-2 ring-background transition-transform duration-200 group-hover/presence:scale-110">
              <AvatarFallback
                className="bg-teal-600 text-[8px] font-semibold text-white"
                title={`${viewer.fullName} is viewing ${context}`}
              >
                {initialsOf(viewer.fullName)}
              </AvatarFallback>
            </Avatar>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background bg-emerald-500"
              aria-hidden="true"
            />
          </span>
        ))}
        {overflow > 0 ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-2 ring-background">
            +{overflow}
          </span>
        ) : null}
      </span>
    </span>
  )
}
