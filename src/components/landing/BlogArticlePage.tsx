'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  Link2,
  Linkedin,
  Mail,
  Send,
} from 'lucide-react'
import { navigate } from '@/hooks/use-hash-route'
import { getBlogPost, getRelatedPosts, type BlogPost } from '@/content/blog-posts'

/*
 * Blog article page — light editorial design (warm cream canvas, Instrument
 * Serif display headlines, sticky share + table-of-contents rail) matching
 * the user's reference layout: breadcrumb, headline-left / image-right hero,
 * byline, then a two-column body with a "Share this Article" + "In this
 * Article" sidebar and a professional typeset article column.
 *
 * Scoped with .blog-article so the landing (.fora-root) and app focus rings
 * never leak in; the body canvas is painted cream while mounted (same
 * pattern HomePage uses for its dark canvas).
 */

const INK = '#1c1917'

/** Share target builders — resolved at click time so the URL is always current. */
function shareTargets(title: string) {
  return {
    x: () => {
      const url = encodeURIComponent(window.location.href)
      const text = encodeURIComponent(title)
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer')
    },
    linkedin: () => {
      const url = encodeURIComponent(window.location.href)
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener,noreferrer')
    },
    mail: () => {
      const url = window.location.href
      window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`I thought you might enjoy this article: ${url}`)}`
    },
  }
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Share rail                                                          */
/* ------------------------------------------------------------------ */

function ShareButtons({ title, layout }: { title: string; layout: 'stack' | 'row' }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    const url = window.location.href
    // Primary: async Clipboard API. Fallback: hidden-textarea execCommand for
    // contexts where clipboard-write permission is restricted (older browsers,
    // embedded webviews). Both failing stays silent — a copy button may lose.
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(true)
      } catch {
        /* clipboard unavailable — no feedback shown */
        return
      }
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2200)
  }

  const targets = shareTargets(title)
  const btn =
    'flex h-10 w-10 items-center justify-center rounded-lg bg-[#1c1917] text-[#faf8f3] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#3f3a35] hover:shadow-[0_8px_20px_-8px_rgba(28,25,23,0.5)]'

  return (
    <div className={layout === 'row' ? 'flex items-center gap-2.5' : 'flex items-center gap-2.5'}>
      <button type="button" className={btn} aria-label="Share on X (Twitter)" title="Share on X" onClick={targets.x}>
        <XIcon className="h-4 w-4" />
      </button>
      <button type="button" className={btn} aria-label="Share on LinkedIn" title="Share on LinkedIn" onClick={targets.linkedin}>
        <Linkedin aria-hidden="true" className="h-4 w-4" />
      </button>
      <button type="button" className={btn} aria-label="Share by email" title="Share by email" onClick={targets.mail}>
        <Mail aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e3dcd0] bg-transparent text-[#6e675f] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1c1917] hover:text-[#1c1917]"
        aria-label={copied ? 'Link copied' : 'Copy link'}
        title={copied ? 'Copied!' : 'Copy link'}
        onClick={() => void copy()}
      >
        {copied ? <Check aria-hidden="true" className="h-4 w-4 text-emerald-700" /> : <Link2 aria-hidden="true" className="h-4 w-4" />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Article link copied to clipboard' : ''}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Table of contents (scroll-spy)                                      */
/* ------------------------------------------------------------------ */

function TableOfContents({
  post,
  activeId,
  onNavigate,
}: {
  post: BlogPost
  activeId: string
  onNavigate: (id: string) => void
}) {
  return (
    <nav aria-label="Table of contents">
      <p className="text-sm font-semibold text-[#1c1917]">In this Article</p>
      <ol className="mt-3 space-y-0.5">
        {post.sections.map((section, index) => {
          const active = section.id === activeId
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onNavigate(section.id)}
                aria-current={active ? 'location' : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition-colors duration-150 ${
                  active ? 'bg-[#e9e2d5] font-medium text-[#1c1917]' : 'text-[#8a8177] hover:bg-[#efe9dd] hover:text-[#1c1917]'
                }`}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="flex shrink-0 items-center justify-center rounded-full bg-[#1c1917]"
                    style={{ height: 18, width: 18 }}
                  >
                    <ChevronRight className="h-2.5 w-2.5 text-[#faf8f3]" strokeWidth={3} />
                  </span>
                ) : (
                  <span aria-hidden="true" className="w-[18px] shrink-0 text-center text-[11px] tabular-nums text-[#b3a99b]">
                    {index + 1}.
                  </span>
                )}
                <span className="line-clamp-2">{section.heading}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* Newsletter mini-card (sidebar)                                      */
/* ------------------------------------------------------------------ */

function NewsletterCard() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  return (
    <div className="rounded-xl bg-[#f1ece2] p-5">
      <p className="text-sm font-semibold text-[#1c1917]">Field notes, monthly.</p>
      <p className="mt-1.5 text-xs leading-relaxed text-[#6e675f]">
        One email a month — new playbooks, blocker patterns and product updates. No noise.
      </p>
      {done ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1c1917] px-3 py-1.5 text-xs font-medium text-[#faf8f3]">
          <Check aria-hidden="true" className="h-3.5 w-3.5" /> You&apos;re on the list
        </p>
      ) : (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) setDone(true)
          }}
        >
          <div className="flex items-center gap-1.5 rounded-lg border border-[#ddd5c7] bg-white/70 p-1 transition-colors focus-within:border-[#1c1917]">
            <label htmlFor="blog-newsletter" className="sr-only">
              Email address
            </label>
            <input
              id="blog-newsletter"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-transparent px-2.5 text-xs text-[#1c1917] outline-none placeholder:text-[#b3a99b]"
            />
            <button
              type="submit"
              aria-label="Subscribe"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#1c1917] text-[#faf8f3] transition-transform hover:scale-105"
            >
              <Send aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Article page                                                        */
/* ------------------------------------------------------------------ */

export function BlogArticlePage({ slug }: { slug: string }) {
  const post = getBlogPost(slug)
  const [activeId, setActiveId] = useState('')
  const [progress, setProgress] = useState(0)

  // Paint the document canvas cream while the article is mounted (mirrors
  // HomePage's dark-canvas pattern) so overscroll never flashes the app shell.
  useEffect(() => {
    const previous = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#faf8f3'
    return () => {
      document.body.style.backgroundColor = previous
    }
  }, [])

  // Fresh article = fresh scroll position. (activeId/progress re-measure via
  // the scroll effect below; the AnimatePresence transition remounts per slug.)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  // Reading progress + scroll-spy, rAF-throttled on one passive listener.
  useEffect(() => {
    if (!post) return
    let raf = 0
    const measure = () => {
      const doc = document.documentElement
      const total = doc.scrollHeight - window.innerHeight
      setProgress(total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 0)

      const probe = window.scrollY + 168
      let current = ''
      for (const section of post.sections) {
        const el = document.getElementById(section.id)
        if (el && el.offsetTop <= probe) current = section.id
      }
      const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 8
      if (nearBottom && post.sections.length > 0) current = post.sections[post.sections.length - 1].id
      setActiveId(current)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [post])

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** Back to the landing's blog grid (hash router owns location.hash). */
  const goToBlogIndex = () => {
    navigate('/')
    // The route transition (AnimatePresence "wait") mounts the landing ~250ms
    // after navigation, so #blog may not exist yet — retry until it does.
    const tryScroll = (delay: number) => {
      window.setTimeout(() => {
        const el = document.getElementById('blog')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, delay)
    }
    tryScroll(420)
    tryScroll(950) // safety net — re-targeting an existing smooth scroll is idempotent
  }

  /* ---------------- Unknown slug ---------------- */
  if (!post) {
    return (
      <div className="blog-article flex min-h-screen flex-col items-center justify-center bg-[#faf8f3] px-6 font-fora-sans text-[#1c1917] antialiased">
        <p className="font-fora-serif text-6xl italic text-[#c9c0b0]">404</p>
        <h1 className="mt-4 text-xl font-semibold">This article does not exist (yet).</h1>
        <p className="mt-2 max-w-sm text-center text-sm text-[#6e675f]">
          The piece you are looking for may have moved, or the link is wrong.
        </p>
        <button
          type="button"
          onClick={goToBlogIndex}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1c1917] px-6 text-sm font-medium text-[#faf8f3] transition-transform hover:scale-[1.03]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to the blog
        </button>
      </div>
    )
  }

  const related = getRelatedPosts(post.slug)

  return (
    <div className="blog-article min-h-screen bg-[#faf8f3] font-fora-sans text-[#1c1917] antialiased">
      {/* Reading progress */}
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[95] h-[3px] bg-transparent">
        <div className="h-full bg-[#1c1917] transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
      </div>

      {/* Slim header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm font-bold tracking-[0.24em] text-[#1c1917] transition-opacity hover:opacity-70"
        >
          EVENT OS
        </button>
        <button
          type="button"
          onClick={goToBlogIndex}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-[#6e675f] transition-colors hover:text-[#1c1917]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to blog
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-4">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-[#8a8177]">
          <button type="button" onClick={goToBlogIndex} className="rounded transition-colors hover:text-[#1c1917]">
            Blog
          </button>
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[#c9c0b0]" />
          <span>{post.category}</span>
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[#c9c0b0]" />
          <span aria-current="page" className="max-w-[180px] truncate font-medium text-[#1c1917] sm:max-w-none">
            {post.title}
          </span>
        </nav>

        {/* Hero: headline left, editorial image right */}
        <div className="mt-8 grid items-start gap-10 md:grid-cols-[1fr_400px]">
          <div>
            <h1 className="font-fora-serif text-[clamp(2.4rem,4.8vw,3.6rem)] leading-[1.06] tracking-[-0.01em]">
              {post.title}
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Image
                src={post.author.avatar}
                alt={`Portrait of ${post.author.name}`}
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-full object-cover ring-1 ring-[#e3dcd0]"
              />
              <span className="text-sm font-medium">{post.author.name}</span>
              <span aria-hidden="true" className="h-4 w-px bg-[#ddd5c7]" />
              <span className="text-sm text-[#8a8177]">Last updated on {post.updatedOn}</span>
              <span aria-hidden="true" className="h-4 w-px bg-[#ddd5c7]" />
              <span className="inline-flex items-center gap-1.5 text-sm text-[#8a8177]">
                <Clock aria-hidden="true" className="h-3.5 w-3.5" /> {post.readTime}
              </span>
            </div>
            {/* Mobile share row (the sticky rail is desktop-only) */}
            <div className="mt-6 lg:hidden">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8177]">Share this article</p>
              <ShareButtons title={post.title} layout="row" />
            </div>
          </div>
          <figure className="relative">
            <div className="overflow-hidden rounded-2xl ring-1 ring-[#e3dcd0]">
              <Image
                src={post.image}
                alt={post.imageAlt}
                width={800}
                height={600}
                priority
                unoptimized
                sizes="(max-width: 768px) 100vw, 400px"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <figcaption className="mt-2.5 text-xs leading-relaxed text-[#a39b8f]">
              {post.category} · The EVENT OS publication
            </figcaption>
          </figure>
        </div>

        {/* Body: sticky rail + article column */}
        <div className="mt-14 grid gap-12 lg:grid-cols-[248px_1fr]">
          {/* Desktop sidebar */}
          <aside aria-label="Article sidebar" className="hidden lg:block">
            <div className="sticky top-8 space-y-6">
              <div>
                <p className="mb-3 text-sm font-semibold text-[#1c1917]">Share this Article</p>
                <ShareButtons title={post.title} layout="stack" />
              </div>
              <div className="rounded-xl bg-[#f1ece2] p-5">
                <TableOfContents post={post} activeId={activeId} onNavigate={scrollToSection} />
              </div>
              <NewsletterCard />
            </div>
          </aside>

          {/* Article */}
          <article className="max-w-[680px]">
            {/* Mobile TOC (collapsed) */}
            <details className="group mb-10 rounded-xl bg-[#f1ece2] p-5 lg:hidden">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[#1c1917] [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  In this Article
                  <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" />
                </span>
              </summary>
              <div className="mt-3">
                <TableOfContents post={post} activeId={activeId} onNavigate={scrollToSection} />
              </div>
            </details>

            {/* Intro — set slightly larger, editorial style */}
            {post.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="mt-6 text-[17px] leading-[1.8] text-[#3e3833] first:mt-0 md:text-[18px]">
                {paragraph}
              </p>
            ))}

            {post.sections.map((section, index) => (
              <section key={section.id} aria-labelledby={`heading-${section.id}`}>
                <h2
                  id={section.id}
                  className="mt-12 scroll-mt-14 text-[22px] font-semibold leading-snug tracking-tight md:text-2xl"
                >
                  <span aria-hidden="true" className="mr-3 font-fora-serif italic text-[#b3a99b]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {section.heading}
                  <span id={`heading-${section.id}`} className="sr-only">
                    — section {index + 1}
                  </span>
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)} className="mt-5 text-[16px] leading-[1.8] text-[#3e3833] md:text-[17px]">
                    {paragraph}
                  </p>
                ))}
                {section.list && (
                  <ul className="mt-6 space-y-3">
                    {section.list.map((item) => (
                      <li key={item.slice(0, 24)} className="flex gap-3 text-[16px] leading-[1.7] text-[#3e3833] md:text-[17px]">
                        <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#1c1917]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Pull quote — mid-article editorial break */}
                {index === 1 && (
                  <figure className="my-12 border-l-2 border-[#1c1917] pl-6 md:pl-8">
                    <blockquote className="font-fora-serif text-[clamp(1.5rem,2.6vw,2rem)] italic leading-[1.3] text-[#1c1917]">
                      “{post.quote.text}”
                    </blockquote>
                    <figcaption className="mt-3 text-sm text-[#8a8177]">— {post.quote.cite}</figcaption>
                  </figure>
                )}
              </section>
            ))}

            {/* Closing */}
            {post.closing.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="mt-10 border-t border-[#e8e1d6] pt-8 text-[17px] font-medium leading-[1.8] text-[#1c1917] md:text-[18px]">
                {paragraph}
              </p>
            ))}

            {/* Tags */}
            <div className="mt-10 flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#e3dcd0] px-3 py-1 text-xs font-medium text-[#6e675f] transition-colors hover:border-[#1c1917] hover:text-[#1c1917]"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* End share strip */}
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f1ece2] p-5">
              <p className="text-sm font-semibold text-[#1c1917]">Enjoyed the read? Pass it on.</p>
              <ShareButtons title={post.title} layout="row" />
            </div>

            {/* Author card */}
            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-[#e8e1d6] bg-white/50 p-6 sm:flex-row">
              <Image
                src={post.author.avatar}
                alt={`Portrait of ${post.author.name}`}
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-[#e3dcd0]"
              />
              <div>
                <p className="text-[15px] font-semibold text-[#1c1917]">{post.author.name}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-[#a39b8f]">{post.author.role}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-[#6e675f]">{post.author.bio}</p>
              </div>
            </div>
          </article>
        </div>

        {/* Related articles */}
        <section aria-labelledby="related-title" className="mt-24 border-t border-[#e8e1d6] pt-14">
          <h2 id="related-title" className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-tight">
            Keep <span className="font-fora-serif font-normal italic text-[#8a8177]">reading.</span>
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {related.map((rel) => (
              <a
                key={rel.slug}
                href={`#/blog/${rel.slug}`}
                className="group overflow-hidden rounded-2xl border border-[#e8e1d6] bg-white/50 transition-all duration-300 hover:-translate-y-1 hover:border-[#d5cbbc] hover:shadow-[0_20px_40px_-24px_rgba(28,25,23,0.35)]"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={rel.image}
                    alt={rel.imageAlt}
                    width={640}
                    height={360}
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="rounded-full border border-[#e3dcd0] px-2.5 py-1 font-medium uppercase tracking-[0.12em] text-[#6e675f]">
                      {rel.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#a39b8f]">
                      <Clock aria-hidden="true" className="h-3 w-3" /> {rel.readTime}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-[#1c1917]">{rel.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#6e675f]">{rel.excerpt}</p>
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#1c1917]">
                    Read article
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl bg-[#1c1917] px-8 py-12 text-center">
          <p className="font-fora-serif text-[clamp(1.6rem,3vw,2.4rem)] italic leading-tight text-[#faf8f3]">
            Ready to run calmer events?
          </p>
          <p className="max-w-md text-sm leading-relaxed text-[#b3a99b]">
            EventFlow gives your team the live board, the dashboards and the blocker feed — so the system does the remembering.
          </p>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#faf8f3] px-6 text-sm font-semibold text-[#1c1917] transition-transform hover:scale-[1.04]"
          >
            Start free <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-[#e8e1d6]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-[#a39b8f] sm:flex-row">
          <span className="font-bold tracking-[0.24em] text-[#1c1917]">EVENT OS</span>
          <span>© {new Date().getFullYear()} EventFlow — Field notes for event teams.</span>
          <button type="button" onClick={() => navigate('/')} className="rounded transition-colors hover:text-[#1c1917]">
            eventflow.io
          </button>
        </div>
      </footer>
    </div>
  )
}
