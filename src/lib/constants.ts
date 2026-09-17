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
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  // Multi-tenant onboarding: mandatory join-or-create screen after signup.
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  EVENTS: '/events',
  TASKS: '/tasks',
  MY_TASKS: '/tasks/my',
  TEAMS: '/teams',
  CALENDAR: '/calendar',
  ACTIVITY: '/activity',
  PROFILE: '/profile',
  ADMIN: '/admin',
  // Owner-only room management (rename, regenerate code/password, members, delete).
  ROOM_SETTINGS: '/room/settings',
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

/** Short copy shown under each switch in the notification preferences dialog. */
export const NOTIFICATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  TASK_ASSIGNED: 'When someone assigns a task to you',
  TASK_STATUS_CHANGED: 'When a task you created or own changes status',
  TASK_COMPLETED: 'When a task you created or own is completed',
  TASK_BLOCKED: 'When a task you created or own becomes blocked',
  COMMENT_ADDED: 'When someone comments on your task',
  DEADLINE_APPROACHING: 'Periodic reminders for tasks due within 48 hours',
}

/** The default preference map — everything on. */
export const DEFAULT_NOTIFICATION_PREFS: Record<string, boolean> = Object.fromEntries(
  NOTIFICATION_TYPES.map((type) => [type, true])
)

export const ACTIVITY_ACTIONS = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSIONS_REVOKED_OTHERS: 'SESSIONS_REVOKED_OTHERS',
  USER_UPDATED: 'USER_UPDATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_JOINED: 'ROOM_JOINED',
  ROOM_UPDATED: 'ROOM_UPDATED',
  ROOM_CODE_REGENERATED: 'ROOM_CODE_REGENERATED',
  ROOM_PASSWORD_REGENERATED: 'ROOM_PASSWORD_REGENERATED',
  ROOM_DELETED: 'ROOM_DELETED',
  TEAM_CREATED: 'TEAM_CREATED',
  TEAM_UPDATED: 'TEAM_UPDATED',
  TEAM_DELETED: 'TEAM_DELETED',
  EVENT_CREATED: 'EVENT_CREATED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  EVENT_STATUS_CHANGED: 'EVENT_STATUS_CHANGED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  COMMENT_ADDED: 'COMMENT_ADDED',
} as const

/** Human labels for activity actions shown in the activity feed. */
export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  USER_REGISTERED: 'Joined the workspace',
  USER_LOGIN: 'Signed in',
  PASSWORD_CHANGED: 'Changed their password',
  PASSWORD_RESET_REQUESTED: 'Requested a password reset',
  PASSWORD_RESET: 'Reset their password via email link',
  SESSION_REVOKED: 'Signed out a device',
  SESSIONS_REVOKED_OTHERS: 'Signed out all other devices',
  USER_UPDATED: 'Updated a profile',
  USER_ROLE_CHANGED: 'Changed a user role',
  USER_DEACTIVATED: 'Deactivated a user',
  USER_REACTIVATED: 'Reactivated a user',
  ROOM_CREATED: 'Created an event room',
  ROOM_JOINED: 'Joined an event room',
  ROOM_UPDATED: 'Updated the room profile',
  ROOM_CODE_REGENERATED: 'Regenerated the room ID',
  ROOM_PASSWORD_REGENERATED: 'Regenerated the room password',
  ROOM_DELETED: 'Deleted the event room',
  TEAM_CREATED: 'Created a team',
  TEAM_UPDATED: 'Updated a team',
  TEAM_DELETED: 'Deleted a team',
  EVENT_CREATED: 'Created an event',
  EVENT_UPDATED: 'Updated an event',
  EVENT_STATUS_CHANGED: 'Changed event status',
  TASK_CREATED: 'Created a task',
  TASK_ASSIGNED: 'Assigned a task',
  TASK_STATUS_CHANGED: 'Updated task status',
  TASK_COMPLETED: 'Completed a task',
  TASK_BLOCKED: 'Blocked a task',
  COMMENT_ADDED: 'Commented on a task',
}

/** Coarse groups used by the activity page filter (keeps the dropdown short). */
export const ACTIVITY_FILTER_GROUPS = [
  { value: 'ALL', label: 'All activity' },
  { value: 'EVENTS', label: 'Events' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'TEAMS', label: 'Teams' },
  { value: 'USERS', label: 'Users' },
] as const

/** Maps a filter group to the concrete activity actions it includes. */
export const ACTIVITY_GROUP_ACTIONS: Record<string, string[] | null> = {
  ALL: null,
  EVENTS: ['EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_STATUS_CHANGED'],
  TASKS: ['TASK_CREATED', 'TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'TASK_COMPLETED', 'TASK_BLOCKED', 'COMMENT_ADDED'],
  TEAMS: ['TEAM_CREATED', 'TEAM_UPDATED', 'TEAM_DELETED'],
  USERS: ['USER_REGISTERED', 'USER_LOGIN', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET', 'SESSION_REVOKED', 'SESSIONS_REVOKED_OTHERS', 'USER_UPDATED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED', 'USER_REACTIVATED'],
}

// ============ PROFILE APPEARANCE ============

/** Preset profile cover backgrounds (gallery shown on the profile page). */
export const PROFILE_BACKGROUNDS = [
  { key: 'aurora', label: 'Aurora', url: '/images/profile-bgs/aurora.png' },
  { key: 'ember', label: 'Ember', url: '/images/profile-bgs/ember.png' },
  { key: 'dunes', label: 'Dunes', url: '/images/profile-bgs/dunes.png' },
  { key: 'tide', label: 'Tide', url: '/images/profile-bgs/tide.png' },
  { key: 'meadow', label: 'Meadow', url: '/images/profile-bgs/meadow.png' },
  { key: 'slate', label: 'Slate', url: '/images/profile-bgs/slate.png' },
] as const

export type ProfileBackgroundKey = (typeof PROFILE_BACKGROUNDS)[number]['key']

export const PROFILE_BG_KEYS = PROFILE_BACKGROUNDS.map((b) => b.key) as readonly string[]

/** Look up a preset background by key (null = default gradient cover). */
export function profileBackgroundByKey(key: string | null | undefined) {
  if (!key) return null
  return PROFILE_BACKGROUNDS.find((b) => b.key === key) ?? null
}
