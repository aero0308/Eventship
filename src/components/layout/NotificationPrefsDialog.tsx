'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  UserPlus,
} from 'lucide-react'
import type { NotificationType } from '@/types'
import { NOTIFICATION_TYPE_DESCRIPTIONS, NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from '@/lib/constants'
import { api, ApiClientError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

const TYPE_ICONS: Record<NotificationType, { icon: LucideIcon; classes: string }> = {
  TASK_ASSIGNED: { icon: UserPlus, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  TASK_STATUS_CHANGED: { icon: RefreshCw, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  TASK_COMPLETED: { icon: CheckCircle2, classes: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  TASK_BLOCKED: { icon: AlertTriangle, classes: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300' },
  COMMENT_ADDED: { icon: MessageSquare, classes: 'bg-muted text-muted-foreground' },
  DEADLINE_APPROACHING: { icon: Clock, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
}

interface NotificationPrefsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Per-type notification mute switches. Preferences are persisted server-side
 * (User.notificationPrefs) and respected by every notify* path in the backend.
 */
export function NotificationPrefsDialog({ open, onOpenChange }: NotificationPrefsDialogProps) {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    api
      .get<{ prefs: Record<string, boolean> }>('/notifications/preferences')
      .then((data) => {
        if (!cancelled) setPrefs(data.prefs)
      })
      .catch(() => {
        if (!cancelled) {
          toast({ title: 'Could not load preferences', variant: 'destructive' })
          onOpenChange(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, onOpenChange, toast])

  const save = async (next: Record<string, boolean>) => {
    setSaving(true)
    try {
      const data = await api.patch<{ prefs: Record<string, boolean> }>('/notifications/preferences', { prefs: next })
      setPrefs(data.prefs)
      const muted = Object.values(data.prefs).filter((enabled) => !enabled).length
      toast({
        title: 'Preferences saved',
        description: muted === 0 ? 'All notifications are on.' : `${muted} notification type(s) muted.`,
      })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Failed to save preferences.'
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggle = (type: string, enabled: boolean) => {
    setPrefs((prev) => (prev ? { ...prev, [type]: enabled } : prev))
  }

  const mutedCount = prefs ? Object.values(prefs).filter((enabled) => !enabled).length : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4.5 w-4.5 text-emerald-600" aria-hidden="true" />
            Notification preferences
          </DialogTitle>
          <DialogDescription>Choose which events should reach your notification bell.</DialogDescription>
        </DialogHeader>

        {loading || !prefs ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground/70">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        ) : (
          <div className="space-y-1">
            {NOTIFICATION_TYPES.map((type) => {
              const style = TYPE_ICONS[type]
              const Icon = style.icon
              const enabled = prefs[type] !== false
              return (
                <div
                  key={type}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', style.classes)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{NOTIFICATION_TYPE_LABELS[type] ?? type}</p>
                    <p className="text-xs text-muted-foreground">{NOTIFICATION_TYPE_DESCRIPTIONS[type] ?? ''}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => toggle(type, checked)}
                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${NOTIFICATION_TYPE_LABELS[type] ?? type} notifications`}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              )
            })}
          </div>
        )}

        <Separator />

        <DialogFooter className="gap-2 pt-1 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-10 text-xs text-muted-foreground"
            onClick={() => {
              if (prefs) {
                setPrefs(Object.fromEntries(Object.keys(prefs).map((key) => [key, true])))
              }
            }}
            disabled={loading || mutedCount === 0}
          >
            Enable all
          </Button>
          <Button
            type="button"
            onClick={() => prefs && void save(prefs)}
            disabled={loading || saving}
            className="min-h-10 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Save preferences'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
