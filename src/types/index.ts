/**
 * Event Management System - API contract types shared by backend routes and frontend.
 * Enum values are stored as strings in SQLite; these unions are the source of truth.
 */

export type Role = 'EVENT_MANAGER' | 'TEAM_LEADER' | 'EMPLOYEE'
export type EventStatus = 'DRAFT' | 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED'
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_COMPLETED'
  | 'TASK_BLOCKED'
  | 'COMMENT_ADDED'
  | 'DEADLINE_APPROACHING'

export interface UserDTO {
  id: string
  email: string
  fullName: string
  role: Role
  isActive: boolean
  teamId: string | null
  team?: Pick<TeamDTO, 'id' | 'name'> | null
  /** Multi-tenant room membership. Null = onboarding pending (join or create). */
  roomId: string | null
  room?: Pick<RoomDTO, 'id' | 'roomCode' | 'name'> | null
  /** Convenience flag from the server: true while the user has no room. */
  needsOnboarding: boolean
  /** Workflow guard: block completing tasks whose dependencies are unfinished. */
  strictDependencyGuard: boolean
  /** Self-uploaded profile photo (data URL), or null for the initials fallback. */
  avatarUrl: string | null
  /** Chosen cover background key from the preset gallery, or null for default. */
  profileBg: string | null
  createdAt: string
  updatedAt: string
}

/** Multi-tenant room (GET /api/rooms, GET /api/rooms/[id]). */
export interface RoomDTO {
  id: string
  roomCode: string
  name: string
  description: string | null
  ownerId: string
  owner?: Pick<UserDTO, 'id' | 'fullName' | 'email'> | null
  isActive: boolean
  maxMembers: number | null
  memberCount?: number | null
  members?: { id: string; fullName: string; email: string; role: Role; teamId: string | null }[]
  createdAt: string
  updatedAt: string
}

/** Admin directory row: user + task workload + last sign-in. */
export interface UserWithStatsDTO extends UserDTO {
  stats: {
    openTasks: number
    overdueTasks: number
    completedTasks: number
  }
  lastLoginAt: string | null
}

export interface TeamDTO {
  id: string
  name: string
  description: string | null
  managerId: string | null
  manager?: Pick<UserDTO, 'id' | 'fullName' | 'email'> | null
  members?: { id: string; fullName: string; email?: string; role?: string }[]
  events?: EventDTO[]
  memberCount?: number
  eventCount?: number
  /** Aggregated task health across the team's events (detail responses only). */
  stats?: TeamStatsDTO
  createdAt: string
  updatedAt: string
}

/** Task rollup for a team (Phase 3 TeamStats). */
export interface TeamStatsDTO {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  blockedTasks: number
  overdueTasks: number
  /** 0–100, rounded. */
  completionRate: number
}

/** Role-scoped task statistics (Phase 5 get_task_stats, GET /api/tasks/stats). */
export interface TaskStatsDTO {
  total: number
  notStarted: number
  inProgress: number
  blocked: number
  completed: number
  /** status ≠ COMPLETED and dueDate in the past. */
  overdue: number
  /** 0–100, rounded. */
  completionRate: number
}

export interface EventDTO {
  id: string
  name: string
  description: string | null
  location: string | null
  startDate: string
  endDate: string
  status: EventStatus
  teamId: string
  team?: Pick<TeamDTO, 'id' | 'name'> | null
  createdBy: string
  creator?: Pick<UserDTO, 'id' | 'fullName'> | null
  taskCount?: number
  taskStats?: {
    total: number
    completed: number
    inProgress: number
    blocked: number
    notStarted: number
    /** 0–100 completion rate (server-computed, Phase 4 EventProgress.percentage). */
    percent: number
  }
  createdAt: string
  updatedAt: string
}

export interface TaskDTO {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  eventId: string
  event?: Pick<EventDTO, 'id' | 'name' | 'status' | 'teamId'> | null
  assignedTo: string | null
  assignee?: Pick<UserDTO, 'id' | 'fullName' | 'email'> | null
  createdBy: string
  creator?: Pick<UserDTO, 'id' | 'fullName'> | null
  startDate: string | null
  dueDate: string | null
  estimatedHours: number | null
  actualHours: number | null
  commentCount?: number
  dependencies?: {
    id: string
    dependsOnTaskId: string
    dependsOnTaskTitle?: string
    /** Status of the depended-on task — powers the board's blocked/ready chips. */
    dependsOnTaskStatus?: string
    /** Deps-of-deps (one nested level, task detail only) — powers the chain viz. */
    upstream?: { id: string; title: string; status: string }[]
  }[]
  createdAt: string
  updatedAt: string
}

export interface TaskCommentDTO {
  id: string
  content: string
  taskId: string
  userId: string
  user?: Pick<UserDTO, 'id' | 'fullName' | 'role'> | null
  createdAt: string
}

export interface NotificationDTO {
  id: string
  userId: string
  message: string
  type: NotificationType
  read: boolean
  createdAt: string
}

/** Per-type mute map — every NotificationType key present, true = enabled. */
export type NotificationPrefsMap = Record<NotificationType, boolean>

export interface ActivityLogDTO {
  id: string
  userId: string
  user?: Pick<UserDTO, 'id' | 'fullName'> | null
  action: string
  details: string | null
  timestamp: string
}

export interface ActivityFeedDTO {
  activities: ActivityLogDTO[]
  total: number
  hasMore: boolean
}

export interface SearchResultEventDTO {
  id: string
  name: string
  status: EventStatus
  startDate: string
}

export interface SearchResultTaskDTO {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  eventId: string
  eventName: string | null
}

export interface SearchResultTeamDTO {
  id: string
  name: string
}

export interface SearchResultUserDTO {
  id: string
  fullName: string
  role: Role
}

export interface SearchResultDTO {
  events: SearchResultEventDTO[]
  tasks: SearchResultTaskDTO[]
  teams: SearchResultTeamDTO[]
  users: SearchResultUserDTO[]
}

/** GET /api/calendar — one month of due tasks + overlapping events. */
export interface CalendarResponseDTO {
  month: string
  rangeStart: string
  rangeEnd: string
  tasks: TaskDTO[]
  events: EventDTO[]
  summary: { dueTasks: number; completed: number; overdue: number; events: number }
}

/** GET /api/dashboard — one bucket of the "my focus" strip (count + preview tasks). */
export interface DashboardFocusBucketDTO {
  count: number
  tasks: TaskDTO[]
}

export interface DashboardMyFocusDTO {
  dueToday: DashboardFocusBucketDTO
  dueThisWeek: DashboardFocusBucketDTO
  overdue: DashboardFocusBucketDTO
}

/** Phase 6: a blocked task in the dashboard "Blockers" widget. */
export interface DashboardBlockerDTO {
  id: string
  title: string
  priority: TaskPriority
  eventId: string
  eventName: string | null
  assigneeName: string | null
  dueDate: string | null
  daysBlocked: number
  latestComment: { content: string; authorName: string | null; createdAt: string } | null
}

/** Phase 6: one day of the 30-day progress trend. */
export interface ProgressOverTimeDTO {
  date: string
  created: number
  completed: number
  cumulativeCompleted: number
}

/** Phase 6: per-person performance row (managers/leaders only). */
export interface TopPerformerDTO {
  userId: string
  fullName: string
  email: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  blockedTasks: number
  completionRate: number
}

export interface DashboardStatsDTO {
  totals: {
    events: number
    activeEvents: number
    tasks: number
    completedTasks: number
    blockedTasks: number
    overdueTasks: number
    teams: number
    members: number
    upcomingDeadlines: number
  }
  tasksByStatus: { status: TaskStatus; count: number }[]
  tasksByPriority: { priority: TaskPriority; count: number }[]
  eventsByStatus: { status: EventStatus; count: number }[]
  upcomingEvents: EventDTO[]
  upcomingDeadlines: TaskDTO[]
  recentActivity: ActivityLogDTO[]
  teamWorkload: {
    teamId: string
    teamName: string
    openTasks: number
    completedTasks: number
    blockedTasks: number
    memberCount: number
    completionRate: number
  }[]
  completionRate: number
  myFocus: DashboardMyFocusDTO
  blockers: DashboardBlockerDTO[]
  progressOverTime: ProgressOverTimeDTO[]
  topPerformers: TopPerformerDTO[]
}

export interface AuthResponse {
  user: UserDTO
}

export interface ApiError {
  error: string
}

// ============ Request payloads ============

export interface RegisterPayload {
  email: string
  fullName: string
  password: string
  role?: Role
  teamId?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface CreateEventPayload {
  name: string
  description?: string
  location?: string | null
  startDate: string
  endDate: string
  status?: EventStatus
  teamId: string
}

export type UpdateEventPayload = Partial<CreateEventPayload>

export interface CreateTaskPayload {
  title: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  eventId: string
  assignedTo?: string | null
  startDate?: string | null
  dueDate?: string | null
  estimatedHours?: number | null
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {
  actualHours?: number | null
  dependsOnTaskIds?: string[]
  /** Optional note attached to a status change — becomes a task comment. */
  statusNote?: string
}

export interface CreateTeamPayload {
  name: string
  description?: string
  managerId?: string | null
  memberIds?: string[]
}

export interface CreateCommentPayload {
  content: string
}

export interface UpdateUserPayload {
  role?: Role
  isActive?: boolean
  teamId?: string | null
  fullName?: string
}
