/**
 * Shared app constants: routes, enum values, display labels and color maps.
 * Used by both API routes (validation) and frontend (rendering).
 */

export const APP_NAME = 'EventFlow'
export const APP_TAGLINE = 'Plan events. Coordinate teams. Ship on time.'
export const API_BASE = '/api'

/** Hash routes used by the in-app router (single-page app on /). */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  EVENTS: '/events',
  TASKS: '/tasks',
  TEAMS: '/teams',
} as const

export const SESSION_COOKIE = 'ems_session'

export const ROLES = ['EVENT_MANAGER', 'TEAM_LEADER', 'EMPLOYEE'] as const
export const EVENT_STATUSES = ['DRAFT', 'PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const
export const TASK_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_STATUS_CHANGED',
  'TASK_COMPLETED',
  'TASK_BLOCKED',
  'COMMENT_ADDED',
  'DEADLINE_APPROACHING',
] as const

export const ROLE_LABELS: Record<string, string> = {
  EVENT_MANAGER: 'Event Manager',
  TEAM_LEADER: 'Team Leader',
  EMPLOYEE: 'Employee',
}

export const ROLE_BADGE_CLASSES: Record<string, string> = {
  EVENT_MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
  TEAM_LEADER: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25',
  EMPLOYEE: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-500/15 dark:text-stone-300 dark:border-stone-500/25',
}

export const EVENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

/** Tailwind classes for event status badges (no indigo/blue per design policy). */
export const EVENT_STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-500/15 dark:text-stone-300 dark:border-stone-500/25',
  PLANNING: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
  COMPLETED: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/25',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
}

export const TASK_STATUS_CLASSES: Record<string, string> = {
  NOT_STARTED: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-500/15 dark:text-stone-300 dark:border-stone-500/25',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25',
  BLOCKED: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
}

export const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

export const PRIORITY_CLASSES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25',
  LOW: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-500/15 dark:text-stone-300 dark:border-stone-500/25',
}

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'Task Assigned',
  TASK_STATUS_CHANGED: 'Status Changed',
  TASK_COMPLETED: 'Task Completed',
  TASK_BLOCKED: 'Task Blocked',
  COMMENT_ADDED: 'New Comment',
  DEADLINE_APPROACHING: 'Deadline Soon',
}

export const ACTIVITY_ACTIONS = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  TEAM_CREATED: 'TEAM_CREATED',
  TEAM_UPDATED: 'TEAM_UPDATED',
  EVENT_CREATED: 'EVENT_CREATED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  EVENT_STATUS_CHANGED: 'EVENT_STATUS_CHANGED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  COMMENT_ADDED: 'COMMENT_ADDED',
} as const
