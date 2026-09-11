'use client'

/**
 * DependencyChain — mini chain visualization for the task detail dialog.
 *
 * Renders every direct dependency as a row (status dot + title + status chip);
 * when the API provides nested upstream deps (deps-of-deps, one extra level),
 * they are drawn indented below their parent behind a dashed connector, giving
 * a small "why is this blocked" tree without leaving the dialog. Rows open the
 * referenced task when `onOpenTask` is provided.
 */

import { ArrowUpRight, CheckCircle2, Link2, Loader2, X } from 'lucide-react'
import type { TaskDTO } from '@/types'
import { cn } from '@/lib/utils'

type DepRow = NonNullable<TaskDTO['dependencies']>[number]

const STATUS_DOT: Record<string, string> = {
  COMPLETED: 'bg-emerald-500',
  IN_PROGRESS: 'bg-amber-500',
  BLOCKED: 'bg-red-500',
  NOT_STARTED: 'bg-stone-400',
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Done',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  NOT_STARTED: 'Not started',
}

/** Status-tinted chip for the row's right edge. */
function statusChip(status?: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    case 'IN_PROGRESS':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
    case 'BLOCKED':
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
    default:
      return 'bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300'
  }
}

function DepTitle({ title, done }: { title: string; done: boolean }) {
  return (
    <span
      className={cn(
        'min-w-0 flex-1 truncate text-xs font-medium',
        done ? 'text-muted-foreground/60 line-through decoration-stone-300' : 'text-foreground'
      )}
      title={title}
    >
      {title}
    </span>
  )
}

export function DependencyChain({
  taskId,
  dependencies,
  onOpenTask,
  onRemove,
  removingDepId,
}: {
  taskId: string
  dependencies: NonNullable<TaskDTO['dependencies']>
  onOpenTask?: (taskId: string) => void
  /** Phase 5: when provided, direct dependency rows get a remove affordance. */
  onRemove?: (dependsOnTaskId: string) => void
  /** Id of a dependency currently being removed (spinner state). */
  removingDepId?: string | null
}) {
  // Dedupe upstream rows per parent (and never re-show the task itself).
  const seen = new Set<string>([taskId])

  const total = dependencies.length
  const done = dependencies.filter((dep) => dep.dependsOnTaskStatus === 'COMPLETED').length
  const allDone = done === total && total > 0
  const upstreamCount = dependencies.reduce((sum, dep) => sum + (dep.upstream?.length ?? 0), 0)

  return (
    <div className="rounded-xl border border-stone-200/80 bg-gradient-to-br from-stone-50 via-white to-stone-50/60 p-3 dark:border-stone-800 dark:from-stone-900/70 dark:via-stone-900/40 dark:to-transparent">
      {/* Header: label + chain summary pill */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="h-3 w-3" aria-hidden="true" />
          Chain
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1',
            allDone
              ? 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25'
              : done === 0
                ? 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25'
                : 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25'
          )}
          aria-label={`${done} of ${total} upstream tasks done`}
        >
          {allDone ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : null}
          {done}/{total} upstream done
        </span>
      </div>

      <ul className="space-y-1.5" aria-label="Dependency chain">
        {dependencies.map((dep) => {
          const depDone = dep.dependsOnTaskStatus === 'COMPLETED'
          const depStatus = dep.dependsOnTaskStatus ?? 'NOT_STARTED'
          const upstream = (dep.upstream ?? []).filter((row) => !seen.has(row.id))
          upstream.forEach((row) => seen.add(row.id))
          const clickable = Boolean(onOpenTask && dep.dependsOnTaskId && dep.dependsOnTaskId !== taskId)

          return (
            <li key={dep.id}>
              {/* Direct dependency row */}
              <div
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onOpenTask?.(dep.dependsOnTaskId) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onOpenTask?.(dep.dependsOnTaskId)
                        }
                      }
                    : undefined
                }
                className={cn(
                  'group/dep flex items-center gap-2 rounded-lg border border-transparent bg-card/70 px-2.5 py-1.5 ring-1 ring-stone-100 transition-all duration-150 dark:ring-stone-800',
                  clickable && 'cursor-pointer hover:border-emerald-200 hover:ring-emerald-200 dark:hover:border-emerald-500/30 dark:hover:ring-emerald-500/25'
                )}
                title={clickable ? 'Open this task' : undefined}
              >
                {/* dot with soft glow while unfinished */}
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  {!depDone ? (
                    <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-40', STATUS_DOT[depStatus])} />
                  ) : null}
                  <span className={cn('relative inline-flex h-2 w-2 rounded-full', STATUS_DOT[depStatus])} />
                </span>
                <DepTitle title={dep.dependsOnTaskTitle ?? `Task ${dep.dependsOnTaskId.slice(0, 8)}`} done={depDone} />
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                    statusChip(depStatus)
                  )}
                >
                  {STATUS_LABEL[depStatus] ?? depStatus}
                </span>
                {clickable ? (
                  <ArrowUpRight
                    className="h-3 w-3 shrink-0 text-muted-foreground/30 transition-colors group-hover/dep:text-emerald-500"
                    aria-hidden="true"
                  />
                ) : null}
                {onRemove && dep.dependsOnTaskId !== taskId ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(dep.dependsOnTaskId)
                    }}
                    disabled={removingDepId === dep.dependsOnTaskId}
                    className="shrink-0 rounded p-1 text-muted-foreground/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                    aria-label={`Remove dependency ${dep.dependsOnTaskTitle ?? ''}`}
                    title="Remove dependency"
                  >
                    {removingDepId === dep.dependsOnTaskId ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <X className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>

              {/* Nested upstream rows (dep-of-dep), behind a dashed elbow */}
              {upstream.length > 0 ? (
                <ul
                  className="ml-[9px] mt-1 space-y-1 border-l-2 border-dashed border-stone-200 pl-3.5 dark:border-stone-700"
                  aria-label="Upstream dependencies"
                >
                  {upstream.map((row) => {
                    const rowDone = row.status === 'COMPLETED'
                    const rowClickable = Boolean(onOpenTask && row.id !== taskId)
                    return (
                      <li key={row.id}>
                        <div
                          role={rowClickable ? 'button' : undefined}
                          tabIndex={rowClickable ? 0 : undefined}
                          onClick={rowClickable ? () => onOpenTask?.(row.id) : undefined}
                          onKeyDown={
                            rowClickable
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onOpenTask?.(row.id)
                                  }
                                }
                              : undefined
                          }
                          className={cn(
                            'flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors',
                            rowClickable && 'cursor-pointer hover:bg-muted/70'
                          )}
                          title={rowClickable ? 'Open this task' : undefined}
                        >
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[row.status])} aria-hidden="true" />
                          <DepTitle title={row.title} done={rowDone} />
                          <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/60">
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>

      {upstreamCount > 0 ? (
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          Showing {total} direct {total === 1 ? 'dependency' : 'dependencies'} + {upstreamCount} upstream{' '}
          {upstreamCount === 1 ? 'task' : 'tasks'} — click any row to jump to it.
        </p>
      ) : (
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          {total === 1 ? '1 direct dependency' : `${total} direct dependencies`} — click a row to jump to it.
        </p>
      )}
    </div>
  )
}
