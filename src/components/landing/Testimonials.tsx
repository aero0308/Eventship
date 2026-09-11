import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/landing/FadeIn'
import { SectionLabel } from '@/components/landing/SectionLabel'

const TESTIMONIALS = [
  {
    quote: 'We used to spend 2 hours a day on status calls. Now we just open the dashboard.',
    name: 'Sarah Chen',
    role: 'Event Director, TechSummit',
    initials: 'SC',
    tone: 'from-fora-accent to-fora-glow',
  },
  {
    quote: 'Blockers used to surface in the final 48 hours. Now they surface the second they happen.',
    name: 'Marcus Webb',
    role: 'Operations Lead, VenueLab',
    initials: 'MW',
    tone: 'from-amber-500 to-orange-400',
  },
  {
    quote: "It's the first tool our volunteers actually use. The board just makes sense to them.",
    name: 'Priya Sharma',
    role: 'Executive Producer, Stagecraft',
    initials: 'PS',
    tone: 'from-emerald-500 to-teal-400',
  },
] as const

/**
 * Testimonials: three frosted-glass quote cards (translucent border + blur)
 * over the dark canvas, with gradient initial avatars.
 */
export function Testimonials() {
  return (
    <section id="testimonials" aria-labelledby="testimonials-title" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionLabel>Testimonials</SectionLabel>
        <FadeIn>
          <h2
            id="testimonials-title"
            className="mx-auto mt-5 max-w-3xl text-center text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white"
          >
            Don&apos;t take our{' '}
            <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">word</span> for it.
          </h2>
        </FadeIn>

        <div className="mt-14 grid gap-5 md:mt-16 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <FadeIn key={testimonial.name} delay={index * 0.08} className="h-full">
              <figure className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm transition-colors duration-300 hover:border-white/20">
                <Quote aria-hidden="true" className="h-5 w-5 text-fora-accent" />
                <blockquote className="mt-5 flex-1 text-base leading-relaxed text-zinc-300 md:text-lg">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-7 flex items-center gap-3.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white',
                      testimonial.tone,
                    )}
                  >
                    {testimonial.initials}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">{testimonial.name}</span>
                    <span className="block text-xs text-fora-muted">{testimonial.role}</span>
                  </span>
                </figcaption>
              </figure>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
