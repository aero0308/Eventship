/**
 * Zod validation schemas for all API route payloads.
 * Enum unions are imported from constants so backend and frontend stay in sync.
 */
import { z } from 'zod'
import { EVENT_STATUSES, NOTIFICATION_TYPES, ROLES, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants'

// ============ field helpers ============

/** Accepts anything Date.parse understands (ISO datetime, datetime-local, date-only). */
const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime, expected an ISO string')

/**
 * Optional FK / scalar fields: '' is treated as "absent" (HTML forms),
 * null is preserved so PATCH can explicitly clear a value.
 */
const nullableId = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.union([z.uuid(), z.null()]).optional()
)

const nullableDateTime = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.union([isoDateTime, z.null()]).optional()
)

const nullablePositiveNumber = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.union([z.coerce.number().positive('Must be a positive number'), z.null()]).optional()
)

/** Optional long text: '' normalizes to null (cleared). */
const nullableText = (max: number) =>
  z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().max(max, `Must be at most ${max} characters`).nullable().optional()
  )

// ============ auth ============

/** Trims + lowercases BEFORE validation so z.email() never sees padded input. */
const emailField = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email()
)

/**
 * Strong password policy (shared by register, change-password and reset-password):
 * min 8 chars with uppercase, lowercase, number and special character.
 * The demo seed password predates this policy — logins are unaffected.
 */
export const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character (e.g. ! ? #)')

export const registerSchema = z.object({
  email: emailField,
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(120, 'Full name must be at most 120 characters'),
  password: strongPassword,
  role: z.enum(ROLES).default('EMPLOYEE'),
  teamId: nullableId,
})

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPassword,
})

/** POST /api/auth/forgot-password — always answers success (never leaks accounts). */
export const forgotPasswordSchema = z.object({ email: emailField })

/** POST /api/auth/reset-password — consumes a single-use token. */
export const resetPasswordSchema = z.object({
  token: z.string().min(16, 'Reset token is missing or malformed'),
  newPassword: strongPassword,
})

/** Self-service profile/workflow updates (PATCH /api/auth/me). */
export const updateSelfSchema = z
  .object({
    strictDependencyGuard: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Nothing to update',
  })

// ============ rooms (multi-tenant onboarding) ============

/** Room join/create password: lighter than the user policy, but not trivial. */
export const roomPassword = z
  .string()
  .min(6, 'Room password must be at least 6 characters')
  .max(128, 'Room password must be at most 128 characters')

/** POST /api/rooms — create a room; the caller becomes its owner/EVENT_MANAGER. */
export const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Room name must be at least 2 characters')
    .max(80, 'Room name must be at most 80 characters'),
  password: roomPassword,
  description: nullableText(500),
})

/** POST /api/rooms/join — join an existing room with its share code + password. */
export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^EVT-[A-Z2-9]{6}$/, 'Room ID must look like EVT-7X9K2M'),
  password: z.string().min(1, 'Room password is required'),
})

/** PUT /api/rooms/[id] — owner-only room profile updates. */
export const updateRoomSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Room name must be at least 2 characters')
      .max(80, 'Room name must be at most 80 characters')
      .optional(),
    description: nullableText(500),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'Nothing to update',
  })

/** POST /api/rooms/regenerate-password — owner-only; omit password to auto-generate. */
export const regenerateRoomPasswordSchema = z.object({
  password: roomPassword.optional(),
})

// ============ teams ============

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Team name is required')
    .max(80, 'Team name must be at most 80 characters'),
  description: nullableText(500),
  managerId: nullableId,
  memberIds: z.array(z.uuid()).optional(),
})

export const updateTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Team name is required')
    .max(80, 'Team name must be at most 80 characters')
    .optional(),
  description: nullableText(500),
  managerId: nullableId,
  memberIds: z.array(z.uuid()).optional(),
})

// ============ events ============

export const createEventSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Event name is required')
    .max(120, 'Event name must be at most 120 characters'),
  description: nullableText(2000),
  location: nullableText(200),
  startDate: isoDateTime,
  endDate: isoDateTime,
  status: z.enum(EVENT_STATUSES).default('DRAFT'),
  teamId: z.uuid(),
})

export const updateEventSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Event name is required')
    .max(120, 'Event name must be at most 120 characters')
    .optional(),
  description: nullableText(2000),
  location: nullableText(200),
  startDate: isoDateTime.optional(),
  endDate: isoDateTime.optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  teamId: z.uuid().optional(),
})

// ============ tasks ============

/** Rejects a start date that lands after the due date (both present). */
const dateRange = <T extends { startDate?: string | null; dueDate?: string | null }>(data: T) => {
  if (data.startDate && data.dueDate) {
    return new Date(data.startDate).getTime() <= new Date(data.dueDate).getTime()
  }
  return true
}

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Task title is required')
      .max(160, 'Task title must be at most 160 characters'),
    description: nullableText(4000),
    priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
    status: z.enum(TASK_STATUSES).default('NOT_STARTED'),
    eventId: z.uuid(),
    assignedTo: nullableId,
    startDate: nullableDateTime,
    dueDate: nullableDateTime,
    estimatedHours: nullablePositiveNumber,
  })
  .refine(dateRange, { message: 'Start date must be on or before the due date', path: ['startDate'] })

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Task title is required')
      .max(160, 'Task title must be at most 160 characters')
      .optional(),
    description: nullableText(4000),
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    eventId: z.uuid().optional(),
    assignedTo: nullableId,
    startDate: nullableDateTime,
    dueDate: nullableDateTime,
    estimatedHours: nullablePositiveNumber,
    actualHours: nullablePositiveNumber,
    dependsOnTaskIds: z.array(z.uuid()).optional(),
    /**
     * Optional note attached to a status change (Phase 5 TaskStatusUpdate.comment).
     * Blocked reasons are the primary use — the note becomes a task comment
     * authored by the mover.
     */
    statusNote: z.string().trim().min(1, 'Status note cannot be empty').max(500, 'Status note must be at most 500 characters').optional(),
  })
  .refine(dateRange, { message: 'Start date must be on or before the due date', path: ['startDate'] })

// ============ comments & notifications ============

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters'),
})

export const notificationPatchSchema = z.object({
  id: z.uuid().optional(),
  markAll: z.boolean().optional(),
})

// ============ bulk tasks ============

export const bulkTaskActionSchema = z.object({
  ids: z.array(z.uuid()).min(1, 'Select at least one task').max(100, 'You can update up to 100 tasks at once'),
  action: z.enum(['status', 'priority', 'assign', 'unassign', 'delete']),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedTo: z.uuid().optional(),
})

// ============ admin: users ============

/** EVENT_MANAGER-only profile updates. Empty string on teamId means "clear". */
export const updateUserSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    teamId: nullableId,
    fullName: z
      .string()
      .trim()
      .min(1, 'Full name is required')
      .max(120, 'Full name must be at most 120 characters')
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Nothing to update',
  })

// ============ notification preferences ============

/** Full or partial mute map; unknown keys rejected, values must be booleans. */
export const notificationPrefsSchema = z.object({
  prefs: z.record(z.enum(NOTIFICATION_TYPES), z.boolean()),
})
