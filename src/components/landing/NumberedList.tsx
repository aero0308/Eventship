'use client'

import { FadeIn } from '@/components/landing/FadeIn'

export interface NumberedItem {
  /** Zero-padded index, e.g. "001". */
  index: string
  title: string
  description: string
}

/**
 * Editorial numbered list — hairline-divided rows with a mono index that
 * warms to the accent color on hover, plus a slight indent lift.
 */
export function NumberedList({ items }: { items: readonly NumberedItem[] }) {
  return (
    <ol className="border-t border-evos-line">
      {items.map((item, i) => (
        <li key={item.index}>
          <FadeIn delay={i * 0.06}>
            <div className="group grid grid-cols-[3.5rem_1fr] gap-x-5 border-b border-evos-line py-8 transition-colors duration-300 hover:bg-evos-line/40 sm:grid-cols-[5.5rem_1fr] md:py-10">
              <span
                aria-hidden="true"
                className="font-evos-mono text-xs leading-none text-evos-muted transition-colors duration-300 group-hover:text-evos-accent sm:text-sm"
              >
                {item.index}
              </span>
              <div className="transition-transform duration-300 group-hover:translate-x-1.5">
                <h3 className="font-evos-display text-2xl font-medium leading-tight tracking-[-0.02em] text-evos-ink md:text-[1.75rem]">
                  {item.title}
                </h3>
                <p className="mt-2.5 max-w-md text-sm leading-relaxed text-evos-muted md:text-base">
                  {item.description}
                </p>
              </div>
            </div>
          </FadeIn>
        </li>
      ))}
    </ol>
  )
}
