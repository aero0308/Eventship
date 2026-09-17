'use client'

import { Crosshair } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initialsOf } from '@/components/shared/ActivityFeed'
import { cn } from '@/lib/utils'

/**
 * User avatar with photo support: renders the self-uploaded photo when the
 * user has one, otherwise falls back to the emerald initials disc. Use this
 * everywhere a person is represented so photos propagate app-wide.
 */
export function UserAvatar({
  fullName,
  avatarUrl,
  className,
  fallbackClassName,
  ariaLabel,
}: {
  fullName: string
  avatarUrl?: string | null
  className?: string
  fallbackClassName?: string
  ariaLabel?: string
}) {
  const initials = initialsOf(fullName)
  return (
    <Avatar className={cn('relative', className)} aria-label={ariaLabel ?? `${fullName}'s avatar`}>
      {avatarUrl ? (
        <AvatarImage
          src={avatarUrl}
          alt={`${fullName}'s profile photo`}
          className="object-cover"
        />
      ) : null}
      <AvatarFallback
        className={cn('flex items-center justify-center bg-emerald-600 font-semibold text-white', fallbackClassName)}
        delayMs={avatarUrl ? 200 : 0}
      >
        {initials ? (
          initials
        ) : (
          <Crosshair className="h-1/2 w-1/2 opacity-60" aria-hidden="true" />
        )}
      </AvatarFallback>
    </Avatar>
  )
}
