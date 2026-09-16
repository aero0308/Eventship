'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, Copy, Crown, Loader2, Settings } from 'lucide-react'
import type { RoomDTO } from '@/types'
import { ROUTES } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import { navigate } from '@/hooks/use-hash-route'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

/**
 * Profile "My Room" card — the signed-in user's tenant context: room name,
 * shareable Room ID (copy button), membership size and owner badge. Owners
 * get a shortcut to Room Settings. Loads lazily; failures render a quiet
 * note (the rest of the profile keeps working).
 */
export function MyRoomCard() {
  const user = useAuthStore((s) => s.user)
  const [room, setRoom] = useState<RoomDTO | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ room: RoomDTO }>('/rooms')
      .then((data) => {
        if (!cancelled) {
          setRoom(data.room)
          setState('ready')
        }
      })
      .catch((error) => {
        void error
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [user?.roomId])

  const copyCode = async () => {
    if (!room) return
    try {
      await navigator.clipboard.writeText(room.roomCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const isOwner = room?.ownerId === user?.id
  const memberCount = room?.memberCount ?? room?.members?.length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          My Room
        </CardTitle>
        <CardDescription>
          Your isolated workspace — every team, event and task belongs to this room.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state === 'loading' ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your room…
          </div>
        ) : state === 'error' ? (
          <p className="text-sm text-muted-foreground">Room details are unavailable right now.</p>
        ) : room ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-semibold">
                  {room.name}
                  {isOwner ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      <Crown className="h-3 w-3" aria-hidden="true" /> Owner
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {memberCount} member{memberCount === 1 ? '' : 's'}
                  {room.description ? ` · ${room.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-semibold tracking-[0.16em] text-foreground">
                  {room.roomCode}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyCode()}>
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
            {isOwner ? (
              <Button type="button" variant="outline" size="sm" onClick={() => navigate(ROUTES.ROOM_SETTINGS)}>
                <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                Room settings
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Room settings are managed by the room owner.</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
