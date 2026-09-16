'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Copy,
  Check,
  Crown,
  KeyRound,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import type { RoomDTO } from '@/types'
import { ROLE_LABELS, ROUTES } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { navigate } from '@/hooks/use-hash-route'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

/*
 * Room Settings (#/room/settings) — tenant management surface.
 * Owners: rename/describe the room, regenerate the share code, rotate the
 * join password (shown once), review members, delete the room (danger —
 * wipes the room's data and drops every member back to onboarding).
 * Non-owners get a read-only view of the same information.
 */
export function RoomSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { toast } = useToast()

  const [room, setRoom] = useState<RoomDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [regenCode, setRegenCode] = useState(false)
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [regenPasswordBusy, setRegenPasswordBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const isOwner = room ? room.ownerId === user?.id : false

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api.get<{ room: RoomDTO }>('/rooms')
      setRoom(data.room)
      setName(data.room.name)
      setDescription(data.room.description ?? '')
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : 'Unable to load your room.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveProfile = async () => {
    if (!room) return
    if (name.trim().length < 2) {
      toast({ title: 'Room name is too short', variant: 'destructive' })
      return
    }
    setSavingProfile(true)
    try {
      const data = await api.put<{ room: RoomDTO }>(`/rooms/${room.id}`, {
        name: name.trim(),
        description: description.trim() || null,
      })
      setRoom((prev) => (prev ? { ...prev, ...data.room } : data.room))
      toast({ title: 'Room updated' })
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const regenerateCode = async () => {
    if (!room || regenCode) return
    setRegenCode(true)
    try {
      const data = await api.post<{ room: RoomDTO }>('/rooms/regenerate-code')
      setRoom((prev) => (prev ? { ...prev, ...data.room } : data.room))
      toast({ title: 'Room ID regenerated', description: 'The old ID no longer works for new joins.' })
    } catch (err) {
      toast({
        title: 'Regeneration failed',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setRegenCode(false)
    }
  }

  const regeneratePassword = async () => {
    if (!room || regenPasswordBusy) return
    setRegenPasswordBusy(true)
    try {
      const data = await api.post<{ roomPassword: string }>('/rooms/regenerate-password', {})
      setNewPassword(data.roomPassword)
      setCopied(false)
      toast({ title: 'Room password rotated', description: 'Share the new password with your team.' })
    } catch (err) {
      toast({
        title: 'Rotation failed',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setRegenPasswordBusy(false)
    }
  }

  const deleteRoom = async () => {
    if (!room || deleting) return
    setDeleting(true)
    try {
      await api.del(`/rooms/${room.id}`)
      toast({ title: 'Room deleted', description: 'All room data has been removed.' })
      // Every member (this user included) is now room-less → back to the gate.
      try {
        const me = await api.get<{ user: import('@/types').UserDTO }>('/auth/me')
        setUser(me.user)
      } catch {
        setUser(null)
      }
      navigate(ROUTES.ONBOARDING)
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      })
      setDeleting(false)
    }
  }

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="Loading room settings…" />
      </div>
    )
  }

  if (loadError || !room) {
    return (
      <div className="mx-auto max-w-md py-16">
        <EmptyState
          icon={AlertTriangle}
          title="Room unavailable"
          hint={loadError ?? 'Your room could not be loaded.'}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Room Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOwner
            ? 'You own this room — manage its identity, join credentials and members.'
            : 'Read-only view. Only the room owner can change these settings.'}
        </p>
      </div>

      {/* Identity + share card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Room identity
          </CardTitle>
          <CardDescription>
            The Room ID is how teammates find your room; the password is what keeps it private.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Share code strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                Room ID (share code)
              </p>
              <p className="mt-0.5 font-mono text-2xl font-semibold tracking-[0.18em] text-emerald-900 dark:text-emerald-100">
                {room.roomCode}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void copyCode()}>
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              {isOwner && (
                <Button type="button" size="sm" variant="outline" onClick={() => void regenerateCode()} disabled={regenCode}>
                  {regenCode ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Regenerate
                </Button>
              )}
            </div>
          </div>

          {/* New-password reveal (shown once after rotation) */}
          {newPassword ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-500/25 dark:bg-amber-500/10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                  New room password — shown only once
                </p>
                <p className="mt-0.5 font-mono text-xl font-semibold tracking-wider text-amber-900 dark:text-amber-100">
                  {newPassword}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(newPassword).catch(() => undefined)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                }}
              >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                Copy
              </Button>
            </div>
          ) : null}

          {/* Profile form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room-name-input">Room name</Label>
              <Input
                id="room-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isOwner}
                maxLength={80}
                className="max-w-md"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-description-input">Description</Label>
              <Input
                id="room-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isOwner}
                maxLength={500}
                placeholder="What is this room for?"
                className="max-w-md"
              />
            </div>
            {isOwner && (
              <Button type="button" onClick={() => void saveProfile()} disabled={savingProfile}>
                {savingProfile ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Save changes
              </Button>
            )}
          </div>

          {/* Password rotation */}
          {isOwner ? (
            <>
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Room password</p>
                  <p className="text-xs text-muted-foreground">
                    Rotating immediately revokes the old password — anyone mid-join will need the new one.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => void regeneratePassword()} disabled={regenPasswordBusy}>
                  {regenPasswordBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Rotate password
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" aria-hidden="true" />
            Members {room.memberCount != null ? <span className="text-muted-foreground">({room.memberCount})</span> : null}
          </CardTitle>
          <CardDescription>Everyone with access to this room&apos;s events, teams and tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          {room.members && room.members.length > 0 ? (
            <ul className="divide-y divide-border">
              {room.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {member.fullName}
                      {member.id === room.ownerId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                          <Crown className="h-3 w-3" aria-hidden="true" /> Owner
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{ROLE_LABELS[member.role] ?? member.role}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">Member list unavailable.</p>
          )}
        </CardContent>
      </Card>

      {/* Danger zone — owners only */}
      {isOwner ? (
        <Card className="border-red-200 dark:border-red-500/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Deleting the room permanently removes its teams, events, tasks, comments and activity — and every member
              (you included) returns to onboarding. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="room-delete-confirm">
                Type <span className="font-mono font-semibold">{room.roomCode}</span> to confirm
              </Label>
              <Input
                id="room-delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={room.roomCode}
                className="max-w-xs font-mono"
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || deleteConfirm.trim().toUpperCase() !== room.roomCode.toUpperCase()}
              onClick={() => void deleteRoom()}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Delete this room permanently
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Need a different workspace? Rooms are intentionally isolated — to move, ask another room&apos;s owner for their
        Room ID and sign up with a new account, or delete this room if you own it.
      </p>
    </div>
  )
}
