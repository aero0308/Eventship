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
  createdAt: string
  updatedAt: string
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
  createdAt: string
  updatedAt: string
}

export interface EventDTO {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  status: EventStatus
  teamId: string
  team?: Pick<TeamDTO, 'id' | 'name'> | null
  createdBy: string
  creator?: Pick<UserDTO, 'id' | 'fullName'> | null
  taskCount?: number
  taskStats?: { total: number; completed: number; inProgress: number; blocked: number; notStarted: number }
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
  event?: Pick<EventDTO, 'id' | 'name' | 'status'> | null
  assignedTo: string | null
  assignee?: Pick<UserDTO, 'id' | 'fullName' | 'email'> | null
  createdBy: string
  creator?: Pick<UserDTO, 'id' | 'fullName'> | null
  dueDate: string | null
  estimatedHours: number | null
  actualHours: number | null
  commentCount?: number
  dependencies?: { id: string; dependsOnTaskId: string; dependsOnTaskTitle?: string }[]
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

export interface ActivityLogDTO {
  id: string
  userId: string
  user?: Pick<UserDTO, 'id' | 'fullName'> | null
  action: string
  details: string | null
  timestamp: string
}

export interface DashboardStatsDTO {
  totals: {
    events: number
    activeEvents: number
    tasks: number
    completedTasks: number
    blockedTasks: number
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
  teamWorkload: { teamId: string; teamName: string; openTasks: number; completedTasks: number }[]
  completionRate: number
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

export interface CreateEventPayload {
  name: string
  description?: string
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
  dueDate?: string | null
  estimatedHours?: number | null
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {
  actualHours?: number | null
  dependsOnTaskIds?: string[]
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
