'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowRightLeft,
  CalendarPlus,
  CheckCircle2,
  KeyRound,
  LifeBuoy,
  ListPlus,
  LogIn,
  LogOut,
  MessageSquare,
  MonitorSmartphone,
  Pencil,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ActivityLogDTO, EventStatus, TaskStatus } from '@/types'
import {
  ACTIVITY_ACTION_LABELS,
  EVENT_STATUS_CLASSES,
  EVENT_STATUS_LABELS,
  PRIORITY_LABELS,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  TASK_STATUS_CLASSES,
  TASK_STATUS_LABELS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

/** Icon + chip styling per activity action (falls back to a neutral pulse). */
export const ACTIVITY_META: Record<string, { icon: LucideIcon; classes: string }> = {
  USER_REGISTERED: { icon: UserPlus, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  USER_LOGIN: { icon: LogIn, classes: 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300' },
  PASSWORD_CHANGED: { icon: KeyRound, classes: 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300' },
  PASSWORD_RESET_REQUESTED: { icon: LifeBuoy, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  PASSWORD_RESET: { icon: KeyRound, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  SESSION_REVOKED: { icon: LogOut, classes: 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300' },
  SESSIONS_REVOKED_OTHERS: { icon: MonitorSmartphone, classes: 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300' },
  USER_UPDATED: { icon: UserCog, classes: 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300' },
  USER_ROLE_CHANGED: { icon: ShieldQuestion, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  USER_DEACTIVATED: { icon: ShieldOff, classes: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300' },
  USER_REACTIVATED: { icon: ShieldCheck, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  TEAM_CREATED: { icon: Users, classes: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  TEAM_UPDATED: { icon: Users, classes: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  TEAM_DELETED: { icon: Trash2, classes: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300' },
  EVENT_CREATED: { icon: CalendarPlus, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  EVENT_UPDATED: { icon: Pencil, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  EVENT_STATUS_CHANGED: { icon: RefreshCw, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  TASK_CREATED: { icon: ListPlus, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  TASK_ASSIGNED: { icon: UserPlus, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  TASK_STATUS_CHANGED: { icon: ArrowRightLeft, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  TASK_COMPLETED: { icon: CheckCircle2, classes: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  COMMENT_ADDED: { icon: MessageSquare, classes: 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300' },
}

const FALLBACK_META = { icon: Activity, classes: 'bg-muted text-muted-foreground' }

interface ParsedDetails {
  name?: string
  eventName?: string
  teamName?: string
  title?: string
  taskTitle?: string
  email?: string
  assignedTo?: string
  from?: string
  to?: string
  eventId?: string
  taskId?: string
  fullName?: string
}

function parseDetails(raw: string | null): ParsedDetails {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as ParsedDetails) : {}
  } catch {
    return {}
  }
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        className
      )}
    >
      {children}
    </span>
  )
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Secondary line for an activity entry: entity names, status transitions, emails. */
export function ActivityDetails({ activity }: { activity: ActivityLogDTO }) {
  const d = parseDetails(activity.details)
  const entityName = d.eventName ?? d.teamName ?? d.taskTitle ?? d.title ?? null

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {entityName ? (
        <span className="max-w-[22rem] truncate font-medium text-foreground/80">{entityName}</span>
      ) : null}
      {activity.action === 'EVENT_STATUS_CHANGED' && d.from && d.to ? (
        <span className="inline-flex items-center gap-1.5">
          <Chip className={EVENT_STATUS_CLASSES[d.from as EventStatus] ?? ''}>
            {EVENT_STATUS_LABELS[d.from] ?? d.from}
          </Chip>
          <span aria-hidden="true">→</span>
          <Chip className={EVENT_STATUS_CLASSES[d.to as EventStatus] ?? ''}>
            {EVENT_STATUS_LABELS[d.to] ?? d.to}
          </Chip>
        </span>
      ) : null}
      {(activity.action === 'TASK_STATUS_CHANGED' || activity.action === 'TASK_COMPLETED') && d.from && d.to ? (
        <span className="inline-flex items-center gap-1.5">
          <Chip className={TASK_STATUS_CLASSES[d.from as TaskStatus] ?? ''}>
            {TASK_STATUS_LABELS[d.from] ?? d.from}
          </Chip>
          <span aria-hidden="true">→</span>
          <Chip className={TASK_STATUS_CLASSES[d.to as TaskStatus] ?? ''}>
            {TASK_STATUS_LABELS[d.to] ?? d.to}
          </Chip>
        </span>
      ) : null}
      {activity.action === 'USER_ROLE_CHANGED' && d.from && d.to ? (
        <span className="inline-flex items-center gap-1.5">
          <Chip className={ROLE_BADGE_CLASSES[d.from] ?? ''}>
            {ROLE_LABELS[d.from] ?? d.from}
          </Chip>
          <span aria-hidden="true">→</span>
          <Chip className={ROLE_BADGE_CLASSES[d.to] ?? ''}>
            {ROLE_LABELS[d.to] ?? d.to}
          </Chip>
        </span>
      ) : null}
      {(activity.action === 'USER_DEACTIVATED' || activity.action === 'USER_REACTIVATED' || activity.action === 'USER_ROLE_CHANGED' || activity.action === 'USER_UPDATED') && d.fullName ? (
        <span className="max-w-[16rem] truncate font-medium text-foreground/80">{d.fullName}</span>
      ) : null}
      {d.assignedTo ? <span>to a team member</span> : null}
      {d.email ? <span className="truncate">{d.email}</span> : null}
    </span>
  )
}

export interface ActivityItemProps {
  activity: ActivityLogDTO
  assigneeNames?: Record<string, string>
}

/** One timeline row: icon chip, actor avatar, action label, details, relative time. */
export function ActivityItem({ activity, assigneeNames }: ActivityItemProps) {
  const meta = ACTIVITY_META[activity.action] ?? FALLBACK_META
  const Icon = meta.icon
  const actorName = activity.user?.fullName ?? 'Someone'
  const assigneeName =
    activity.action === 'TASK_ASSIGNED' && parseDetails(activity.details).assignedTo
      ? (assigneeNames?.[parseDetails(activity.details).assignedTo as string] ?? null)
      : null

  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      {/* timeline connector */}
      <span
        aria-hidden="true"
        className="absolute left-[1.125rem] top-10 h-[calc(100%-2.25rem)] w-px bg-border group-last:hidden"
      />
      <span
        className={cn(
          'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
          meta.classes
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm leading-snug">
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <Avatar className="h-5 w-5 border border-border">
              <AvatarFallback className="bg-emerald-600 text-[8px] font-semibold text-white">
                {initialsOf(actorName)}
              </AvatarFallback>
            </Avatar>
            {actorName}
          </span>
          <span className="text-muted-foreground">
            {ACTIVITY_ACTION_LABELS[activity.action] ?? activity.action.replace(/_/g, ' ').toLowerCase()}
          </span>
          {assigneeName ? <span className="text-muted-foreground">→ {assigneeName}</span> : null}
        </p>
        <ActivityDetails activity={activity} />
      </div>
      <time
        dateTime={activity.timestamp}
        title={new Date(activity.timestamp).toLocaleString()}
        className="shrink-0 pt-1.5 text-[11px] text-muted-foreground/70"
      >
        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
      </time>
    </li>
  )
}
