'use client'

import { useRef, type ChangeEvent } from 'react'
import { Camera, Check, Image as ImageIcon, Images, Loader2, Trash2 } from 'lucide-react'
import { PROFILE_BACKGROUNDS, profileBackgroundByKey } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserAvatar } from '@/components/shared/UserAvatar'

/**
 * Cover background gallery — shared by the profile hero popover and the
 * appearance settings card. `value` is a preset key or null (default).
 */
export function BackgroundGrid({
  value,
  onPick,
  disabled,
  columns = 3,
}: {
  value: string | null
  onPick: (key: string | null) => void
  disabled?: boolean
  columns?: 3 | 4
}) {
  const tiles: { key: string | null; label: string; url: string | null }[] = [
    { key: null, label: 'Default', url: null },
    ...PROFILE_BACKGROUNDS.map((b) => ({ key: b.key, label: b.label, url: b.url })),
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Cover background"
      className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-4')}
    >
      {tiles.map((tile) => {
        const selected = tile.key === value
        return (
          <button
            key={tile.key ?? 'default'}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Background: ${tile.label}`}
            title={tile.label}
            disabled={disabled}
            onClick={() => onPick(tile.key)}
            className={cn(
              'group relative aspect-[2/1] overflow-hidden rounded-lg border transition-all',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
              selected
                ? 'border-emerald-600 ring-2 ring-emerald-600/40'
                : 'border-border hover:border-emerald-400/70 hover:shadow-sm'
            )}
          >
            {tile.url ? (
              <img src={tile.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span aria-hidden="true" className="block h-full w-full bg-gradient-to-r from-emerald-600/90 via-emerald-500/80 to-teal-500/90" />
            )}
            {selected ? (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : null}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1 py-0.5 text-[9px] font-medium text-white">
              {tile.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * "Profile appearance" settings card: photo upload/remove + cover background
 * picker. The actual PATCHing is owned by the profile page (single source of
 * truth for the optimistic store update).
 */
export function ProfileAppearanceCard({
  fullName,
  avatarUrl,
  profileBg,
  busy,
  onUploadPhoto,
  onRemovePhoto,
  onPickBackground,
}: {
  fullName: string
  avatarUrl: string | null
  profileBg: string | null
  busy: boolean
  onUploadPhoto: (file: File) => void
  onRemovePhoto: () => void
  onPickBackground: (key: string | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-choosing the same file
    if (file) onUploadPhoto(file)
  }

  const bg = profileBackgroundByKey(profileBg)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Images className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Profile appearance
        </CardTitle>
        <CardDescription>Your photo and cover background — visible across the workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Photo row */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar
              fullName={fullName}
              avatarUrl={avatarUrl}
              className="h-14 w-14 border border-border"
              fallbackClassName="bg-emerald-600 text-lg font-bold text-white"
            />
            {busy ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden="true" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {avatarUrl ? 'Change photo' : 'Upload photo'}
              </Button>
              {avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  disabled={busy}
                  onClick={onRemovePhoto}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              JPG, PNG or WebP. The photo is cropped to a circle and resized automatically.
            </p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />

        {/* Cover background */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Cover background
          </p>
          <BackgroundGrid value={profileBg} onPick={onPickBackground} disabled={busy} columns={3} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {bg ? (
              <>
                Current: <span className="font-medium text-foreground">{bg.label}</span>
              </>
            ) : (
              'Using the default emerald gradient.'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
