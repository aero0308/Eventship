import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiniTask {
  title: string
  meta: string
  highlight?: boolean
  blocked?: boolean
}

interface MiniColumn {
  name: string
  count: number
  dot: string
  cards: MiniTask[]
}

const COLUMNS: MiniColumn[] = [
  {
    name: 'To do',
    count: 4,
    dot: 'bg-zinc-500',
    cards: [
      { title: 'Book AV vendor', meta: 'Maya · Fri' },
      { title: 'Print badges', meta: 'Tom · Mon' },
    ],
  },
  {
    name: 'In progress',
    count: 3,
    dot: 'bg-amber-400',
    cards: [
      { title: 'Run-of-show v2', meta: 'Priya · Wed', highlight: true },
      { title: 'Catering menu', meta: 'Leo · Thu' },
    ],
  },
  {
    name: 'Blocked',
    count: 1,
    dot: 'bg-red-400',
    cards: [{ title: 'Venue access', meta: 'Waiting on security', blocked: true }],
  },
]

/**
 * CSS-only kanban board mockup: three status columns, colored status
 * indicators, and one task card highlighted with a subtle accent glow.
 * Decorative only.
 */
export function KanbanMockup() {
  return (
    <div
      role="img"
      aria-label="Preview of the kanban task board with To do, In progress and Blocked columns"
      className="grid grid-cols-3 gap-2.5 rounded-xl border border-fora-border bg-fora-surface p-3 shadow-[0_40px_120px_-32px_rgba(0,0,0,0.85)] md:gap-3 md:p-4"
    >
      {COLUMNS.map((column) => (
        <div key={column.name} className="min-w-0 rounded-lg border border-fora-border bg-fora-surface-2/50 p-2 md:p-2.5">
          <div className="flex items-center gap-1.5 px-0.5 pb-2">
            <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', column.dot)} />
            <span className="truncate text-[10px] font-medium text-white md:text-[11px]">{column.name}</span>
            <span className="ml-auto text-[9px] tabular-nums text-fora-muted md:text-[10px]">{column.count}</span>
          </div>
          <div className="space-y-2">
            {column.cards.map((card) => (
              <div
                key={card.title}
                className={cn(
                  'rounded-md border bg-fora-surface p-2 transition-shadow duration-300 md:p-2.5',
                  card.highlight && 'border-fora-accent/50 shadow-[0_0_24px_rgba(99,102,241,0.28)]',
                  card.blocked && 'border-red-400/30 bg-red-400/[0.04]',
                  !card.highlight && !card.blocked && 'border-fora-border',
                )}
              >
                <p className="truncate text-[10px] font-medium leading-tight text-white md:text-[11px]">
                  {card.blocked && <Flag aria-hidden="true" className="mr-1 inline h-2.5 w-2.5 text-red-400" />}
                  {card.title}
                </p>
                <p className="mt-1 truncate text-[9px] text-fora-muted">{card.meta}</p>
                {/* Fake content line */}
                <div aria-hidden="true" className="mt-2 h-1 w-3/4 rounded-full bg-white/[0.07]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
