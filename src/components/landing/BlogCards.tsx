import { ArrowRight, ArrowUpRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/landing/FadeIn'
import { SectionLabel } from '@/components/landing/SectionLabel'

const POSTS = [
  {
    category: 'Playbooks',
    readTime: '6 min read',
    title: 'How to run a 200-person event without losing your mind',
    excerpt: 'The checklist system, the comms cadence and the 72-hour runbook that keep big events calm.',
    gradient: 'from-fora-accent/45 via-fora-surface-3 to-fora-surface',
    icon: '✦',
  },
  {
    category: 'Operations',
    readTime: '4 min read',
    title: 'The 5 blockers that kill event timelines',
    excerpt: 'Vendor sign-offs, venue access, printed assets — where launches actually get stuck, and how to pre-empt them.',
    gradient: 'from-zinc-600/40 via-fora-surface-3 to-fora-surface',
    icon: '⚑',
  },
  {
    category: 'Product',
    readTime: '5 min read',
    title: 'Why real-time dashboards beat status meetings',
    excerpt: 'Status meetings are a polling loop. Live dashboards are an event stream. The math favors one of them.',
    gradient: 'from-fora-glow/35 via-fora-surface-3 to-fora-surface',
    icon: '◎',
  },
] as const

/**
 * Blog preview cards: gradient image placeholders (CSS-only), category tag,
 * title, excerpt and a coming-soon read-more affordance.
 */
export function BlogCards() {
  return (
    <section id="blog" aria-labelledby="blog-title" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <SectionLabel align="left">Blog</SectionLabel>
            <FadeIn>
              <h2
                id="blog-title"
                className="mt-5 text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white"
              >
                Get the latest{' '}
                <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">news.</span>
              </h2>
            </FadeIn>
          </div>
          <FadeIn delay={0.1}>
            <p className="max-w-sm text-sm leading-relaxed text-fora-text-2">
              Field notes on running events — planning systems, blocker patterns and product updates.
            </p>
          </FadeIn>
        </div>

        <div className="mt-14 grid gap-5 md:mt-16 md:grid-cols-3">
          {POSTS.map((post, index) => (
            <FadeIn key={post.title} delay={index * 0.08} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-fora-border bg-fora-surface transition-all duration-300 hover:-translate-y-1 hover:border-fora-border-hover">
                {/* Gradient image placeholder */}
                <div
                  aria-hidden="true"
                  className={cn('relative h-44 overflow-hidden bg-gradient-to-br', post.gradient)}
                >
                  <span className="absolute -right-3 -top-6 select-none font-fora-serif text-[7rem] italic leading-none text-white/[0.13]">
                    {post.icon}
                  </span>
                  <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_20%_120%,rgba(255,255,255,0.08),transparent_60%)]" />
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-fora-accent/30 bg-fora-accent/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-fora-glow">
                      {post.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-fora-muted">
                      <Clock aria-hidden="true" className="h-3 w-3" />
                      {post.readTime}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-white transition-colors duration-300 group-hover:text-fora-glow">
                    {post.title}
                  </h3>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-fora-text-2">{post.excerpt}</p>
                  <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-fora-text-2 transition-colors duration-300 group-hover:text-white">
                    Read more
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </p>
                </div>
              </article>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.15}>
          <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-fora-muted">
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            The full publication ships with the public beta — join the waitlist below.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
