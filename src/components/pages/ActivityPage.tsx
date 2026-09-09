'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, RefreshCw, RotateCcw, SearchX } from 'lucide-react'
import type { ActivityFeedDTO, UserDTO } from '@/types'
import { ACTIVITY_FILTER_GROUPS, ACTIVITY_GROUP_ACTIONS, ROUTES } from '@/lib/constants'
import { api, ApiClientError, qs } from '@/lib/api-client'
import { navigate } from '@/hooks/use-hash-route'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { ActivityItem } from '@/components/shared/ActivityFeed'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

export function ActivityPage() {
  const { toast } = useToast()

  const [group, setGroup] = useState<string>('ALL')
  const [userFilter, setUserFilter] = useState<string>('everyone')
  const [users, setUsers] = useState<UserDTO[]>([])
  const [activities, setActivities] = useState<ActivityFeedDTO['activities']>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actionsParam = useMemo(() => ACTIVITY_GROUP_ACTIONS[group] ?? null, [group])

  const buildQuery = useCallback(
    (offset: number) =>
      qs({
        limit: PAGE_SIZE,
        offset,
        action: actionsParam?.join(','),
        userId: userFilter !== 'everyone' ? userFilter : undefined,
      }),
    [actionsParam, userFilter]
  )

  const load = useCallback(async () => {
    try {
      const data = await api.get<ActivityFeedDTO>(`/activity${buildQuery(0)}`)
      setActivities(data.activities)
      setTotal(data.total)
      setHasMore(data.hasMore)
      setError(null)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load the activity feed.'
      setError(message)
    }
  }, [buildQuery])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [usersData] = await Promise.all([
          api.get<{ users: UserDTO[] }>('/users'),
          load(),
        ])
        if (!cancelled) setUsers(usersData.users)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await api.get<ActivityFeedDTO>(`/activity${buildQuery(activities.length)}`)
      setActivities((list) => [...list, ...data.activities])
      setHasMore(data.hasMore)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load more activity.'
      toast({ title: 'Could not load more', description: message, variant: 'destructive' })
    } finally {
      setLoadingMore(false)
    }
  }

  const assigneeNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const u of users) map[u.id] = u.fullName
    return map
  }, [users])

  const resetFilters = () => {
    setGroup('ALL')
    setUserFilter('everyone')
  }

  const isFiltered = group !== 'ALL' || userFilter !== 'everyone'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle="A live trail of everything happening across your workspace."
        className="mb-0"
        actions={
          <Button variant="outline" onClick={() => void load()} className="min-h-11" disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="h-11 w-full sm:w-48" aria-label="Filter by activity type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_FILTER_GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="h-11 w-full sm:w-52" aria-label="Filter by person">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everyone">Everyone</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFiltered ? (
          <Button variant="ghost" onClick={resetFilters} className="h-11 text-muted-foreground">
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reset
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {loading ? 'Loading…' : `${total} entr${total === 1 ? 'y' : 'ies'}`}
        </p>
      </div>

      {/* Feed */}
      <Card className="py-0">
        <CardContent className="px-4 sm:px-6">
          {loading ? (
            <div className="space-y-5 py-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-6">
              <EmptyState
                icon={SearchX}
                title="Could not load activity"
                hint={error}
                action={
                  <Button onClick={() => void load()} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    Try again
                  </Button>
                }
              />
            </div>
          ) : activities.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={History}
                title={isFiltered ? 'No matching activity' : 'No activity yet'}
                hint={
                  isFiltered
                    ? 'Try widening the filters — nothing matches this combination yet.'
                    : 'Once you and your team start creating events and tasks, the trail shows up here.'
                }
                action={
                  isFiltered ? (
                    <Button variant="outline" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      onClick={() => navigate(ROUTES.EVENTS)}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Create your first event
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              <ul className="py-6" aria-label="Activity feed">
                {activities.map((a) => (
                  <ActivityItem key={a.id} activity={a} assigneeNames={assigneeNames} />
                ))}
              </ul>
              {hasMore ? (
                <div className="flex justify-center border-t border-border/60 py-4">
                  <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore} className="min-h-11">
                    {loadingMore ? 'Loading…' : `Load more (${total - activities.length} remaining)`}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
