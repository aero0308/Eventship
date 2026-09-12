import { Flag, Paperclip, Send, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MockComment {
  initials: string
  name: string
  time: string
  text: string
  tone: string
  blocked?: boolean
}

const COMMENTS: MockComment[] = [
  {
    initials: 'MR',
    name: 'Maya Romero',
    time: '2h ago',
    text: 'Venue security needs the final attendee list before they can sign off on badge access.',
    tone: 'from-fora-accent to-fora-glow',
  },
  {
    initials: 'AW',
    name: 'Alex Wong',
    time: '1h ago',
    text: 'Flagging this as blocked — print vendor won\u2019t start without the approved list.',
    tone: 'from-amber-500 to-orange-400',
    blocked: true,
  },
  {
    initials: 'PS',
    name: 'Priya Sharma',
    time: '18m ago',
    text: 'On it. Escalating to the venue manager now — will update here the moment it clears.',
    tone: 'from-emerald-500 to-teal-400',
  },
] as const

/**
 * CSS-only task-detail mockup: blocked banner + comment thread, selling the
 * blocker-reporting + comments story. Decorative only.
 */
export function CommentMockup() {
  return (
    <div
      role="img"
      aria-label="Preview of a blocked task with its comment thread"
      className="rounded-xl border border-fora-border bg-fora-surface shadow-[0_40px_120px_-32px_rgba(0,0,0,0.85)]"
    >
      {/* Task header */}
      <div className="border-b border-fora-border p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-fora-muted md:text-[11px]">Founder Dinner · Tasks</p>
            <h4 className="mt-1.5 text-sm font-semibold text-white md:text-base">Secure venue access badges</h4>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-red-300 md:text-[10px]">
            <Flag className="h-2.5 w-2.5" aria-hidden="true" />
            Blocked
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-fora-accent to-fora-glow text-[9px] font-semibold text-white">
            AW
          </span>
          <span className="text-[10px] text-fora-muted md:text-[11px]">Assigned to Alex Wong · Due Friday</span>
        </div>
      </div>

      {/* Blocker banner */}
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-red-400/25 bg-red-400/[0.06] p-3 md:mx-5">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-400/30 bg-red-400/10">
          <Flag className="h-3.5 w-3.5 text-red-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-red-200 md:text-xs">Blocked · waiting on venue security approval</p>
          <p className="mt-0.5 text-[10px] text-red-300/70">Flagged 2 days ago — escalated to manager</p>
        </div>
        <span className="shrink-0 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-red-300">
          2d
        </span>
      </div>

      {/* Comment thread */}
      <ul className="space-y-4 p-4 md:p-5">
        {COMMENTS.map((comment) => (
          <li key={comment.name} className="flex gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-semibold text-white',
                comment.tone,
              )}
            >
              {comment.initials}
            </span>
            <div
              className={cn(
                'min-w-0 flex-1 rounded-lg border p-3',
                comment.blocked ? 'border-red-400/25 bg-red-400/[0.04]' : 'border-fora-border bg-fora-surface-2/50',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-white md:text-xs">{comment.name}</span>
                <span className="text-[9px] text-fora-muted">{comment.time}</span>
                {comment.blocked && (
                  <span className="ml-auto rounded-full border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.12em] text-red-300">
                    Blocker
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-fora-text-2 md:text-xs">{comment.text}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Reply input (fake) */}
      <div aria-hidden="true" className="mx-4 mb-4 flex items-center gap-2 rounded-full border border-fora-border bg-fora-surface-2/60 py-2 pl-4 pr-2 md:mx-5 md:mb-5">
        <span className="flex-1 text-[11px] text-fora-muted">Reply to thread…</span>
        <Paperclip className="h-3.5 w-3.5 text-fora-muted" />
        <Smile className="h-3.5 w-3.5 text-fora-muted" />
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fora-accent text-white shadow-[0_0_16px_rgba(99,102,241,0.45)]">
          <Send className="h-3 w-3" />
        </span>
      </div>
    </div>
  )
}
