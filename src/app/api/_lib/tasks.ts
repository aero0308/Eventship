/**
 * Shared serializers + include shapes for task API routes.
 * Only imported by server route handlers.
 */
import type { Prisma } from '@prisma/client'

// ============ list shape ============

export const taskInclude = {
  event: { select: { id: true, name: true, status: true, teamId: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
  creator: { select: { id: true, fullName: true } },
  _count: { select: { comments: true } },
  dependencies: { include: { dependsOnTask: { select: { title: true } } } },
} as const satisfies Prisma.TaskInclude

export interface TaskWithRelations {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  eventId: string
  event: { id: string; name: string; status: string; teamId: string } | null
  assignedTo: string | null
  assignee: { id: string; fullName: string; email: string } | null
  createdBy: string
  creator: { id: string; fullName: string } | null
  startDate: Date | null
  dueDate: Date | null
  estimatedHours: number | null
  actualHours: number | null
  _count?: { comments: number }
  dependencies?: { id: string; dependsOnTaskId: string; dependsOnTask: { title: string } }[]
  createdAt: Date
  updatedAt: Date
}

// ============ detail shape (adds comments) ============

export const taskDetailInclude = {
  ...taskInclude,
  comments: {
    include: { user: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  },
} as const satisfies Prisma.TaskInclude

export interface TaskWithComments extends TaskWithRelations {
  comments: {
    id: string
    content: string
    taskId: string
    userId: string
    user: { id: string; fullName: string; role: string } | null
    createdAt: Date
  }[]
}

// ============ serializers ============

export function serializeTask(task: TaskWithRelations) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    eventId: task.eventId,
    event: task.event ?? null,
    assignedTo: task.assignedTo,
    assignee: task.assignee ?? null,
    createdBy: task.createdBy,
    creator: task.creator ?? null,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    estimatedHours: task.estimatedHours ?? null,
    actualHours: task.actualHours ?? null,
    commentCount: task._count?.comments ?? 0,
    dependencies: (task.dependencies ?? []).map((dep) => ({
      id: dep.id,
      dependsOnTaskId: dep.dependsOnTaskId,
      dependsOnTaskTitle: dep.dependsOnTask.title,
    })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export function serializeTaskDetail(task: TaskWithComments) {
  return {
    ...serializeTask(task),
    comments: task.comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      taskId: comment.taskId,
      userId: comment.userId,
      user: comment.user ?? null,
      createdAt: comment.createdAt.toISOString(),
    })),
  }
}
