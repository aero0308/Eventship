'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Users,
} from 'lucide-react'
import type { RoomDTO, UserDTO } from '@/types'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { navigate } from '@/hooks/use-hash-route'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { PasswordInput } from '@/components/shared/PasswordInput'

/*
 * Mandatory onboarding gate ("How do you want to get started?").
 * Shown right after sign-up (and to any signed-in user without a room):
 *  - Option A: join an existing room with Room ID (EVT-XXXXXX) + password
 *  - Option B: create a new room → the user becomes its owner/EVENT_MANAGER
 * Creating a room shows a one-time share modal with a copyable Room ID +
 * password. There is no bypass — data endpoints 403 until a room exists.
 */
export function OnboardingPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const { toast } = useToast()

  const [path, setPath] = useState<'join' | 'create'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Join form
  const [roomCode, setRoomCode] = useState('')
  const [joinPassword, setJoinPassword] = useState('')

  // Create form
  const [name, setName] = useState('')
  const [roomPassword, setRoomPassword] = useState('')
  const [description, setDescription] = useState('')

  // One-time share modal after creating a room (password shown from form state)
  const [createdRoom, setCreatedRoom] = useState<RoomDTO | null>(null)
  const [copied, setCopied] = useState<'code' | 'password' | null>(null)

  // Paint the body dark to match the auth shell (restored on unmount).
  useEffect(() => {
    const previous = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#0a0a0a'
    return () => {
      document.body.style.backgroundColor = previous
    }
  }, [])

  const copy = async (text: string, which: 'code' | 'password') => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        return
      }
    }
    setCopied(which)
    window.setTimeout(() => setCopied(null), 2000)
  }

  /** Refresh the auth store (user now has a room) and enter the app. */
  const enterApp = async () => {
    try {
      const data = await api.get<{ user: UserDTO }>('/auth/me')
      setUser(data.user)
    } catch {
      // /auth/me failure shouldn't trap the user — the guards re-check anyway.
    }
    navigate(ROUTES.DASHBOARD)
  }

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!/^EVT-[A-Z2-9]{6}$/i.test(roomCode.trim())) {
      setError('Room IDs look like EVT-7X9K2M — ask your room owner for the exact code.')
      return
    }
    if (!joinPassword) {
      setError('Please enter the room password.')
      return
    }
    setSubmitting(true)
    try {
      const data = await api.post<{ room: RoomDTO }>('/rooms/join', {
        roomCode: roomCode.trim(),
        password: joinPassword,
      })
      toast({ title: `Joined ${data.room.name}`, description: 'Welcome to the room.' })
      await enterApp()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to join this room. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (name.trim().length < 2) {
      setError('Give your room a name (at least 2 characters).')
      return
    }
    if (roomPassword.length < 6) {
      setError('Room password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    try {
      const data = await api.post<{ room: RoomDTO }>('/rooms', {
        name: name.trim(),
        password: roomPassword,
        description: description.trim() || null,
      })
      setCreatedRoom(data.room)
      toast({ title: `${data.room.name} is live`, description: 'You are the room manager.' })
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to create your room. Please try again.')
      setSubmitting(false)
    }
  }

  const finishCreate = async () => {
    setCreatedRoom(null)
    await enterApp()
  }

  return (
    <div className="fora-auth relative flex min-h-svh flex-col overflow-hidden bg-fora-bg text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_0%,rgba(99,102,241,0.1),transparent_70%)]"
      />
      <div className="fora-noise" aria-hidden="true" />

      {/* Top bar: brand + signed-in identity */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-fora-accent shadow-[0_0_14px_rgba(99,102,241,0.9)]"
          />
          <span className="text-[15px] font-semibold tracking-tight text-white">EVENT OS</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-fora-muted sm:inline">
            Signed in as <span className="text-fora-text-2">{user?.fullName ?? 'you'}</span>
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-fora-text-2 transition-colors hover:border-white/25 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">Almost there</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              How do you want to{' '}
              <span className="font-fora-serif font-normal italic text-fora-text-2">get started?</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-fora-text-2">
              Every workspace lives in its own isolated event room. Join your team&apos;s room — or start a fresh one.
            </p>
          </div>

          {/* Path picker */}
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Onboarding path">
            <button
              type="button"
              role="radio"
              aria-checked={path === 'create'}
              onClick={() => {
                setPath('create')
                setError(null)
              }}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                path === 'create'
                  ? 'border-fora-accent bg-fora-accent/10 shadow-[0_0_28px_rgba(99,102,241,0.25)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25'
              }`}
            >
              <Building2 className={`h-5 w-5 ${path === 'create' ? 'text-fora-glow' : 'text-fora-text-2'}`} aria-hidden="true" />
              <p className="mt-2.5 text-sm font-semibold text-white">Create a new event room</p>
              <p className="mt-1 text-xs leading-relaxed text-fora-text-2">
                Start fresh — you become the manager and get a shareable Room ID.
              </p>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={path === 'join'}
              onClick={() => {
                setPath('join')
                setError(null)
              }}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                path === 'join'
                  ? 'border-fora-accent bg-fora-accent/10 shadow-[0_0_28px_rgba(99,102,241,0.25)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25'
              }`}
            >
              <Users className={`h-5 w-5 ${path === 'join' ? 'text-fora-glow' : 'text-fora-text-2'}`} aria-hidden="true" />
              <p className="mt-2.5 text-sm font-semibold text-white">Join an existing event room</p>
              <p className="mt-1 text-xs leading-relaxed text-fora-text-2">
                Enter the Room ID and password your team shared with you.
              </p>
            </button>
          </div>

          {/* Forms */}
          <Card className="mt-4 rounded-2xl border-white/10 bg-fora-surface/90 py-0 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur">
            <CardContent className="p-6 sm:p-7">
              {error ? (
                <Alert variant="destructive" role="alert" className="mb-4">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {path === 'create' ? (
                <form onSubmit={handleCreate} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="room-name">Room / organization name</Label>
                    <Input
                      id="room-name"
                      type="text"
                      placeholder="TechSummit 2026 Team"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11"
                      maxLength={80}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-password">Room password</Label>
                    <PasswordInput
                      id="room-password"
                      placeholder="At least 6 characters — share with your team"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-description">
                      Description <span className="text-fora-muted">(optional)</span>
                    </Label>
                    <Input
                      id="room-description"
                      type="text"
                      placeholder="What is this room for?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="h-11"
                      maxLength={500}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-11 w-full bg-fora-accent text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] transition-shadow hover:bg-fora-accent-hover hover:shadow-[0_0_36px_rgba(99,102,241,0.5)]"
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {submitting ? 'Creating room…' : 'Create room & continue'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="join-code">Room ID</Label>
                    <Input
                      id="join-code"
                      type="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="EVT-7X9K2M"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      className="h-11 font-mono tracking-widest"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-password">Room password</Label>
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fora-muted"
                        aria-hidden="true"
                      />
                      <Input
                        id="join-password"
                        type="password"
                        placeholder="The room's join password"
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        className="h-11 pl-9"
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-11 w-full bg-fora-accent text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] transition-shadow hover:bg-fora-accent-hover hover:shadow-[0_0_36px_rgba(99,102,241,0.5)]"
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {submitting ? 'Joining room…' : 'Join room & continue'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="mt-5 text-center text-xs text-fora-muted">
            {APP_NAME} — Event Management System · {new Date().getFullYear()}
          </p>
        </motion.div>
      </main>

      {/* ---- Room-created share modal (one-time) ---- */}
      {createdRoom ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-created-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-fora-surface p-7 shadow-[0_32px_120px_-24px_rgba(0,0,0,0.95)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fora-accent/15">
                <Check className="h-5 w-5 text-fora-glow" aria-hidden="true" />
              </span>
              <div>
                <h2 id="room-created-title" className="text-lg font-semibold text-white">
                  {createdRoom.name} is live
                </h2>
                <p className="text-xs text-fora-text-2">You are the room manager.</p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-fora-text-2">
              Share this <span className="font-medium text-white">Room ID</span> and password with your team — they&apos;ll use
              it to join on sign-up.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-fora-muted">Room ID</p>
                  <p className="font-mono text-xl tracking-[0.2em] text-white">{createdRoom.roomCode}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copy(createdRoom.roomCode, 'code')}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/15"
                >
                  {copied === 'code' ? (
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied === 'code' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-fora-muted">Room password</p>
                  <p className="font-mono text-lg tracking-wider text-white">{roomPassword}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copy(roomPassword, 'password')}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/15"
                >
                  {copied === 'password' ? (
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied === 'password' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-fora-muted">
              You can regenerate the ID or password anytime in Room Settings — regenerating the password revokes the old one.
            </p>

            <Button
              type="button"
              onClick={() => void finishCreate()}
              className="mt-5 h-11 w-full bg-fora-accent text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] hover:bg-fora-accent-hover"
            >
              I&apos;ve saved it — go to dashboard
            </Button>
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}
