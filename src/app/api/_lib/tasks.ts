/**
 * Shared serializers + include shapes for task API routes.
 * Only imported by server route handlers.
 */
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// ============ list shape ============

export const taskInclude = {
  event: { select: { id: true, name: true, status: true, teamId: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
  creator: { select: { id: true, fullName: true } },
  _count: { select: { comments: true } },
  dependencies: { include: { dependsOnTask: { select: { title: true, status: true } } } },
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
  dependencies?: { id: string; dependsOnTaskId: string; dependsOnTask: { title: string; status: string } }[]
  createdAt: Date
  updatedAt: Date
}

/** One nested upstream dependency row (dep-of-dep), used by the chain viz. */
export interface UpstreamDepRow {
  id: string
  title: string
  status: string
}

// ============ detail shape (adds comments + one nested dependency level) ============

export const taskDetailInclude = {
  ...taskInclude,
  dependencies: {
    include: {
      dependsOnTask: {
        // select-only: Prisma forbids select+include at the same level. The
        // nested relation rides INSIDE the select as its own select shape.
        select: {
          id: true,
          title: true,
          status: true,
          dependencies: {
            select: {
              dependsOnTask: { select: { id: true, title: true, status: true } },
            },
          },
        },
      },
    },
  },
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
    dependencies: (task.dependencies ?? []).map((dep) => {
      const upstreamTask = dep.dependsOnTask as {
        title: string
        status: string
        dependencies?: { dependsOnTask: UpstreamDepRow }[]
      }
      const upstream = (upstreamTask.dependencies ?? [])
        .map((nested) => nested.dependsOnTask)
        .filter((d): d is UpstreamDepRow => Boolean(d))
      return {
        id: dep.id,
        dependsOnTaskId: dep.dependsOnTaskId,
        dependsOnTaskTitle: upstreamTask.title,
        dependsOnTaskStatus: upstreamTask.status,
        ...(upstream.length > 0 ? { upstream } : {}),
      }
    }),
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

// ============ dependency graph helpers ============

/**
 * Would adding the edge `taskId → dependsOnTaskId` close a cycle?
 *
 * Walks forward from `dependsOnTaskId` along existing dependency edges
 * (BFS); reaching `taskId` means the new edge would loop back to itself
 * (Phase 5 circular-dependency check). Safe to call per new edge before a
 * replace-all write: a path from X back to taskId can never traverse
 * taskId's own outgoing edges, because the walk stops the moment it
 * arrives at taskId.
 */
export async function wouldCreateCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  const visited = new Set<string>([taskId])
  let frontier = [dependsOnTaskId]

  while (frontier.length > 0) {
    const edges = await db.taskDependency.findMany({
      where: { taskId: { in: frontier } },
      select: { taskId: true, dependsOnTaskId: true },
    })
    const next: string[] = []
    for (const edge of edges) {
      if (edge.dependsOnTaskId === taskId) return true
      if (!visited.has(edge.dependsOnTaskId)) {
        visited.add(edge.dependsOnTaskId)
        next.push(edge.dependsOnTaskId)
      }
    }
    frontier = next
  }
  return false
}
