import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Clock } from 'lucide-react'
import { FadeIn } from '@/components/landing/FadeIn'
import { SectionLabel } from '@/components/landing/SectionLabel'

const POSTS = [
  {
    category: 'Playbooks',
    readTime: '6 min read',
    title: 'How to run a 200-person event without losing your mind',
    excerpt: 'The checklist system, the comms cadence and the 72-hour runbook that keep big events calm.',
    image: '/images/landing/blog-1.png',
    alt: 'Event crew with headsets coordinating a live show from laptops on the venue floor',
  },
  {
    category: 'Operations',
    readTime: '4 min read',
    title: 'The 5 blockers that kill event timelines',
    excerpt: 'Vendor sign-offs, venue access, printed assets — where launches actually get stuck, and how to pre-empt them.',
    image: '/images/landing/blog-2.png',
    alt: 'Planning wall covered in timeline notes under desk lamps, one red flag card lit up in the middle',
  },
  {
    category: 'Product',
    readTime: '5 min read',
    title: 'Why real-time dashboards beat status meetings',
    excerpt: 'Status meetings are a polling loop. Live dashboards are an event stream. The math favors one of them.',
    image: '/images/landing/blog-3.png',
    alt: 'Live analytics dashboard with charts glowing on a monitor in a dark office at night',
  },
] as const

/**
 * Blog preview cards: AI-generated editorial photography, category tag,
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
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-fora-border bg-fora-surface transition-all duration-300 hover:-translate-y-1 hover:border-fora-border-hover hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.8)]">
                {/* Editorial photo header */}
                <div className="relative h-44 overflow-hidden md:h-48">
                  <Image
                    src={post.image}
                    alt={post.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                    unoptimized
                  />
                  {/* Darken for chip legibility + blend into the card body */}
                  <div aria-hidden="true" className="absolute inset-0 bg-fora-bg/20" />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-fora-surface via-fora-surface/10 to-transparent"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 left-6 h-px w-10 bg-gradient-to-r from-fora-accent to-transparent"
                  />
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
