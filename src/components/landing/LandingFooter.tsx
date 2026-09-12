'use client'

import { useState, type FormEvent } from 'react'
import { Check, Github, Linkedin, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scrollToSection, scrollToTop } from '@/components/landing/scroll'

interface FooterLink {
  label: string
  action: () => void
}

interface SocialLink {
  label: string
  icon: typeof Github
  href: string
}

const PRODUCT_LINKS: FooterLink[] = [
  { label: 'Features', action: () => scrollToSection('features') },
  { label: 'Pricing', action: () => scrollToSection('cta') },
  { label: 'Changelog', action: () => scrollToSection('blog') },
  { label: 'Docs', action: () => scrollToSection('faq') },
]

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About', action: () => scrollToTop() },
  { label: 'Blog', action: () => scrollToSection('blog') },
  { label: 'Testimonials', action: () => scrollToSection('testimonials') },
  { label: 'Contact', action: () => scrollToSection('faq') },
]

const LEGAL_LINKS = ['Privacy', 'Terms', 'Security'] as const

const SOCIALS: SocialLink[] = [
  { label: 'GitHub', icon: Github, href: 'https://github.com/aero0308' },
  {
    label: 'LinkedIn',
    icon: Linkedin,
    href: 'https://www.linkedin.com/in/sachin-gupta-52aa923aa/',
  },
]

/**
 * Landing footer: wordmark + tagline + socials, Product/Company/Legal link
 * columns, and a working newsletter capture (local success state), with the
 * copyright row pinned below a hairline divider.
 */
export function LandingFooter() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const onSubscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim()) return
    setSubscribed(true)
  }

  return (
    <footer className="border-t border-fora-border">
      <div className="mx-auto max-w-7xl px-6 pb-10 pt-16 md:pt-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1.4fr]">
          {/* Brand + tagline + socials + newsletter */}
          <div>
            <button type="button" onClick={scrollToTop} className="flex items-center gap-2.5" aria-label="Event OS — back to top">
              <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-fora-accent shadow-[0_0_14px_rgba(99,102,241,0.9)]" />
              <span className="text-[15px] font-semibold tracking-tight text-white">EVENT OS</span>
            </button>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-fora-text-2">
              The command center for event teams — track tasks, catch blockers, ship on time.
            </p>

            <form onSubmit={onSubscribe} className="mt-7 max-w-sm" aria-label="Newsletter signup">
              <label htmlFor="footer-newsletter" className="text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">
                Event ops, monthly
              </label>
              {subscribed ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm text-emerald-300">
                  <Check aria-hidden="true" className="h-4 w-4" />
                  You&apos;re on the list — see you next issue.
                </p>
              ) : (
                <div className="fora-newsletter mt-3 flex items-center gap-2 rounded-full border border-fora-border bg-fora-surface p-1.5 pl-4 transition-all duration-300 hover:border-fora-border-hover focus-within:border-white/25 focus-within:shadow-[0_0_0_4px_rgba(255,255,255,0.05)]">
                  <input
                    id="footer-newsletter"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@team.com"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-fora-muted focus:outline-none focus-visible:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Subscribe to the newsletter"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fora-accent text-white transition-colors duration-200 hover:bg-fora-accent-hover"
                  >
                    <Send aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </form>

            <div className="mt-7 flex items-center gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Event OS on ${social.label}`}
                  title={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-fora-border text-fora-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:text-white"
                >
                  <social.icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <nav aria-label="Product">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">Product</p>
            <ul className="mt-5 space-y-3.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <button type="button" onClick={link.action} className="text-sm text-fora-text-2 transition-colors duration-200 hover:text-white">
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">Company</p>
            <ul className="mt-5 space-y-3.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <button type="button" onClick={link.action} className="text-sm text-fora-text-2 transition-colors duration-200 hover:text-white">
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-fora-muted">Legal</p>
            <ul className="mt-5 space-y-3.5">
              {LEGAL_LINKS.map((label) => (
                <li key={label}>
                  <a href="mailto:hello@eventos.co" className={cn('text-sm text-fora-text-2 transition-colors duration-200 hover:text-white')}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-xs text-xs leading-relaxed text-fora-muted">
              Questions about data or compliance? Write to hello@eventos.co and a human replies
              within one business day.
            </p>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-fora-border pt-8 sm:flex-row">
          <p className="text-xs text-fora-muted">© {new Date().getFullYear()} Event OS · Made for event teams</p>
          <p className="flex items-center gap-2 text-xs text-fora-muted">
            <span aria-hidden="true" className="fora-pulse-ring h-1.5 w-1.5 rounded-full bg-fora-accent" />
            All systems live
          </p>
        </div>
      </div>
    </footer>
  )
}
