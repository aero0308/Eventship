import Image from 'next/image'
import { ArrowUpRight, Clock } from 'lucide-react'
import { FadeIn } from '@/components/landing/FadeIn'
import { SectionLabel } from '@/components/landing/SectionLabel'
import { BLOG_POSTS } from '@/content/blog-posts'

/**
 * Blog preview cards. Content comes from the single editorial source
 * (src/content/blog-posts.ts) so the landing grid and the article routes can
 * never drift apart. Each card is a real link to #/blog/<slug> — native
 * anchor navigation means keyboard focus and middle-click work for free.
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
          {BLOG_POSTS.map((post, index) => (
            <FadeIn key={post.slug} delay={index * 0.08} className="h-full">
              <a
                href={`#/blog/${post.slug}`}
                aria-label={`Read article: ${post.title}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-fora-border bg-fora-surface transition-all duration-300 hover:-translate-y-1 hover:border-fora-border-hover hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.8)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fora-accent"
              >
                {/* Editorial photo header */}
                <div className="relative h-44 overflow-hidden md:h-48">
                  <Image
                    src={post.image}
                    alt={post.imageAlt}
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
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </p>
                </div>
              </a>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.15}>
          <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-fora-muted">
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            Every article is live — more field notes ship every week.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
